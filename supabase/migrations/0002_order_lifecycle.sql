-- =============================================================================
-- Migration 0002: Order lifecycle — server-enforced transitions + ledger
-- =============================================================================
-- Money/status transitions live in SECURITY DEFINER functions so the browser
-- can NEVER flip a status, change a price, or forge a ledger row. The client
-- functions below verify *who is calling* via auth.uid() inside the database.
--
-- v2 fixes:
--   * `confirm_payment` no longer does `insert into
--     public.notification_and_audit_defaults(...) values (...)` — that treated
--     a FUNCTION as a TABLE (runtime 42P01/class-A bug). The notification is
--     now inserted directly.
--   * All destructive statements are guarded (drop trigger if exists etc.) so
--     the file can be re-run after any partial failure.
--   * A hard prerequisite guard fails EARLY with a clear message when 0001
--     hasn't completed (previously you got a cryptic 42P01 mid-file instead).
--   * NEW anti-forgery trigger: because RLS lets the buyer insert order rows,
--     the database now verifies the money math matches the live product price
--     and the platform commission — a direct REST call can no longer insert an
--     order with a forged 0.01 unit price or commission rate.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PREREQUISITE GUARD — orders (and its money helpers) belong to migration 0001.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.orders') is null then
    raise exception
      'PREREQUISITE MISSING: public.orders does not exist. %',
      'Migration 0001_marketplace_schema.sql did not complete — run it first (it is re-runnable), then run this file.';
  end if;
end;
$$;

-- enum value added by this migration (idempotent; PG14 allows in-transaction)
alter type public.order_status add value if not exists 'pending_verification';

-- -----------------------------------------------------------------------------
-- ANTI-FORGERY: every order's money fields must match the LIVE product price
-- and the DB-configured commission — computed here, server-side.
-- -----------------------------------------------------------------------------
create or replace function public.assert_order_money()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  product_row public.products%rowtype;
  expected_fee numeric(12,2);
begin
  select * into product_row from public.products where id = new.product_id for update;

  if not found then
    raise exception 'Product not found';
  end if;

  -- can only order a LIVE listing
  if product_row.is_deleted or product_row.status <> 'approved' then
    raise exception 'This offer is not purchasable right now';
  end if;

  -- unit price = the seller's CURRENT price (no client-sent discounts)
  if new.unit_price <> product_row.price_usd then
    raise exception 'Unit price does not match the offer price';
  end if;

  -- subtotal = unit_price x quantity
  if new.subtotal <> new.unit_price * new.quantity then
    raise exception 'Subtotal does not match price x quantity';
  end if;

  -- commission rate must be the platform's configured rate
  if new.commission_rate <> public.get_platform_commission_rate() then
    raise exception 'Commission rate is not the current platform rate';
  end if;

  expected_fee := round(new.subtotal * new.commission_rate, 2);
  if new.platform_fee <> expected_fee then
    raise exception 'Platform fee does not match the commission (expected %)', expected_fee;
  end if;

  if new.seller_proceeds <> new.subtotal - new.platform_fee then
    raise exception 'Seller proceeds do not match subtotal minus commission';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_money_check on public.orders;
create trigger orders_money_check
  before insert on public.orders
  for each row execute function public.assert_order_money();

-- stock decrements atomically when an order row is created
create or replace function public.decrement_stock_on_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  product_row public.products%rowtype;
begin
  select * into product_row from public.products where id = new.product_id for update;

  if not found then
    raise exception 'Product not found';
  end if;

  if not product_row.stock_is_unlimited then
    if product_row.stock < new.quantity then
      raise exception 'Not enough stock';
    end if;
    update public.products
      set stock = stock - new.quantity, sold_count = sold_count + new.quantity
      where id = new.product_id;
  else
    update public.products
      set sold_count = sold_count + new.quantity
      where id = new.product_id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_order_created on public.orders;
create trigger on_order_created
  after insert on public.orders
  for each row execute function public.decrement_stock_on_order();

-- ---------------------------------------------------------------------------
-- Buyer: "I have paid" (manual KHQR pilot). Only flips
-- pending_payment -> pending_verification and opens a payment attempt row.
-- Admins later confirm IN THE ADMIN UI — never the buyer's word.
-- (0008 replaces this with the `in_escrow` variant — same function name.)
-- ---------------------------------------------------------------------------
create or replace function public.submit_payment_claim(p_order_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
begin
  select * into order_row from public.orders where id = p_order_id for update;

  if not found or order_row.buyer_id <> auth.uid() then
    raise exception 'Order not found';                    -- don't leak existence
  end if;

  if order_row.status <> 'pending_payment' then
    raise exception 'This order is not awaiting payment';
  end if;

  update public.orders
    set status = 'pending_verification'
    where id = p_order_id;

  insert into public.payment_attempts (order_id, provider, amount, currency, status, provider_ref)
  values (
    p_order_id,
    'khqr_manual_pilot',
    order_row.subtotal,
    order_row.currency,
    'pending',
    'CLAIM-' || p_order_id || '-' || extract(epoch from now())::int
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff: confirm a claimed payment after checking the ABA/Bakong statement.
-- provider_ref should be the transaction reference seen in the bank statement.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_payment(
  p_order_id bigint,
  p_reference text,
  p_amount numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
begin
  if not public.is_staff() or public.current_role() <> 'admin' then
    raise exception 'Only administrators can confirm payments';
  end if;

  select * into order_row from public.orders where id = p_order_id for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if order_row.status <> 'pending_verification' then
    raise exception 'Order is not in verification state (current: %)', order_row.status;
  end if;

  update public.orders set status = 'paid' where id = p_order_id;

  update public.payment_attempts
    set status = 'confirmed', confirmed_at = now(),
        provider_ref = coalesce(p_reference, provider_ref)
    where order_id = p_order_id and status = 'pending';

  insert into public.notifications (user_id, type, title, link)
  select buyer_id, 'payment_confirmed',
         'Payment verified for order #' || p_order_id || ' — seller will deliver now.',
         '/orders/' || p_order_id
  from public.orders where id = p_order_id;
end;
$$;

-- the old helper function from v1 is no longer used — remove it cleanly
drop function if exists public.notification_and_audit_defaults(bigint);

-- ---------------------------------------------------------------------------
-- Seller: submit delivery evidence
-- ---------------------------------------------------------------------------
create or replace function public.submit_delivery(p_order_id bigint, p_payload text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  seller_id_of bigint;
begin
  select s.id into seller_id_of
  from public.orders o
  join public.products p on p.id = o.product_id
  join public.sellers s on s.id = p.seller_id
  where o.id = p_order_id and s.user_id = auth.uid();

  if not found then
    raise exception 'Only the seller of this order can submit delivery';
  end if;

  select * into order_row from public.orders where id = p_order_id for update;

  if order_row.status not in ('paid', 'processing') then
    raise exception 'Order is not awaiting delivery (current: %)', order_row.status;
  end if;

  if p_payload is null or char_length(btrim(p_payload)) = 0 then
    raise exception 'Delivery details are required';
  end if;

  update public.orders
    set status = 'delivering', delivery_payload = left(btrim(p_payload), 4000),
        delivered_at = now()
    where id = p_order_id;

  insert into public.notifications (user_id, type, title, link)
  values (order_row.buyer_id, 'order_delivered',
          'Your order #' || p_order_id || ' has been delivered — please confirm.', '/orders/' || p_order_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Buyer (or admin): confirm completion → writes the AUDITABLE LEDGER rows
-- (seller proceeds + platform commission) and bumps seller stats.
-- ---------------------------------------------------------------------------
create or replace function public.complete_order(p_order_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  seller_id_of bigint;
  seller_user uuid;
begin
  select * into order_row from public.orders where id = p_order_id for update;

  if not found then
    raise exception 'Order not found';
  end if;

  select p.seller_id, s.user_id into seller_id_of, seller_user
  from public.products p join public.sellers s on s.id = p.seller_id
  where p.id = order_row.product_id;

  if order_row.buyer_id <> auth.uid() and not public.is_staff() then
    raise exception 'Only the buyer or staff can confirm completion';
  end if;

  if order_row.status not in ('delivering', 'completed') then
    raise exception 'Order is not in delivering state (current: %)', order_row.status;
  end if;

  if order_row.status = 'completed' then
    return; -- idempotent: double-confirm is a no-op
  end if;

  update public.orders
    set status = 'completed', completed_at = now()
    where id = p_order_id;

  -- LEDGER: platform commission + seller proceeds (auditable, never regenerated)
  insert into public.transaction_ledger (order_id, seller_id, entry_type, amount_khr_usd, direction, note, created_by)
  values
    (p_order_id, seller_id_of, 'sale', order_row.seller_proceeds, 'seller_earned',
     'Seller proceeds for order #' || p_order_id, auth.uid()),
    (p_order_id, seller_id_of, 'platform_commission', order_row.platform_fee, 'platform_earned',
     'Platform commission for order #' || p_order_id, auth.uid());

  update public.sellers
    set completed_sales = completed_sales + 1
    where id = seller_id_of;

  insert into public.notifications (user_id, type, title, link)
  values (seller_user, 'order_completed', 'Order #' || p_order_id || ' completed — proceeds added to your balance.', '/seller/dashboard');

  -- audit log
  insert into public.admin_audit_log (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'complete_order', 'orders', p_order_id::text,
          jsonb_build_object('platform_fee', order_row.platform_fee, 'seller_proceeds', order_row.seller_proceeds));
end;
$$;

-- ---------------------------------------------------------------------------
-- Refund: admin-only. Reverses stock & credits buyer, ledger-adjusts the
-- seller's balance back.
-- ---------------------------------------------------------------------------
create or replace function public.refund_order(p_order_id bigint, p_note text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  seller_id_of bigint;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Only administrators can refund orders';
  end if;

  -- restock only makes sense for finite-stock products
  select * into order_row from public.orders where id = p_order_id for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if order_row.status = 'refunded' then
    return; -- idempotent
  end if;
  if order_row.status = 'completed' then
    raise exception 'Completed orders must go through the dispute flow first';
  end if;

  select p.seller_id into seller_id_of
  from public.products p where p.id = order_row.product_id;

  update public.orders
    set status = 'refunded', cancelled_at = now()
    where id = p_order_id;

  update public.payment_attempts
    set status = 'refunded'
    where order_id = p_order_id and status = 'confirmed';

  update public.products
    set stock = stock + order_row.quantity,
        sold_count = greatest(0, sold_count - order_row.quantity)
    where id = order_row.product_id;

  insert into public.transaction_ledger (order_id, seller_id, entry_type, amount_khr_usd, direction, note, created_by)
  values
    (p_order_id, seller_id_of, 'refund', order_row.subtotal, 'buyer_refunded',
     p_note, auth.uid()),
    (p_order_id, seller_id_of, 'refund', order_row.seller_proceeds, 'seller_debited',
     'Seller balance reduced by refund of order #' || p_order_id, auth.uid());

  insert into public.notifications (user_id, type, title)
  values (order_row.buyer_id, 'order_refunded', 'Order #' || p_order_id || ' has been refunded.');
end;
$$;

-- admin may insert ledger rows directly (corrections) — re-install cleanly
drop policy if exists ledger_admin_insert on public.transaction_ledger;
create policy ledger_admin_insert on public.transaction_ledger
  for insert with check (public.current_role() = 'admin');

grant execute on function public.submit_payment_claim(bigint) to authenticated;
grant execute on function public.complete_order(bigint) to authenticated;
grant execute on function public.confirm_payment(bigint, text, numeric) to authenticated;
grant execute on function public.submit_delivery(bigint, text) to authenticated;
grant execute on function public.refund_order(bigint, text) to authenticated;

notify pgrst, 'reload schema';

select 'migration 0002 OK' as status,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public') as public_function_count;
