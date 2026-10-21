-- =============================================================================
-- Migration 0008: Seller offers API + escrow status completion
-- =============================================================================
-- Delivers the "seller offers & escrow" spec WITHOUT duplicating the proven
-- money engine from 0001/0002:
--
--   * `offers` — a public VIEW over `products` exposing the exact columns the
--     spec names (id, seller_id, game_id, category_id, title, description,
--     price_usd, stock, delivery_time_minutes, is_active, created_at).
--     security_invoker keeps `products` RLS (approved-only, public read)
--     fully in force. Reads are public; creation goes through the server
--     action / same RLS as products — the browser can never self-approve.
--
--   * order_status gains the two missing lifecycle states the escrow modal
--     and UI need: 'in_escrow' (payment claimed, funds held pending admin
--     verification) and 'delivered' (seller submitted delivery; buyer yet to
--     confirm). Existing 0002 RPCs are recreated to use them.
--
-- Idempotent; safe to re-run. Run 0001a → 0001 → 0002 first if starting fresh.
-- =============================================================================

-- PREREQUISITE GUARD — 0008 needs the catalogue tables from 0001 (and, if you
-- ran the earlier prototype, 0001a must have been applied before 0001).
do $$
begin
  if to_regclass('public.product_categories') is null
     or to_regclass('public.eligibility_rules') is null then
    raise exception
      'PREREQUISITE MISSING: product_categories/eligibility_rules do not exist. %',
      'Run 0001a (if you have legacy tables) then 0001_marketplace_schema.sql first.';
  end if;
end;
$$;

-- PREREQUISITE GUARD — 0008 touches orders, products, and the payment/ledger
-- tables created by 0001, replacing the lifecycle RPCs installed by 0002.
do $$
begin
  if to_regclass('public.orders') is null
     or to_regclass('public.transaction_ledger') is null then
    raise exception
      'PREREQUISITE MISSING: orders/transaction_ledger do not exist. %',
      'Run 0001_marketplace_schema.sql (and 0002_order_lifecycle.sql) first.';
  end if;
end;
$$;

alter type public.order_status add value if not exists 'in_escrow';
alter type public.order_status add value if not exists 'delivered';

-- -----------------------------------------------------------------------------
-- 2. Recreate lifecycle RPCs using the new states (same guarantees as 0002)
-- -----------------------------------------------------------------------------

-- Buyer claims payment: pending_payment -> in_escrow (funds held until admin
-- verifies the Bakong/ABA statement; a claim alone is NEVER proof of payment)
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
    raise exception 'Order not found';
  end if;

  if order_row.status not in ('pending_payment') then
    raise exception 'This order is not awaiting payment';
  end if;

  update public.orders set status = 'in_escrow' where id = p_order_id;

  insert into public.payment_attempts (order_id, provider, amount, currency, status, provider_ref)
  values (
    p_order_id,
    'bakong_khqr_manual_pilot',
    order_row.subtotal,
    order_row.currency,
    'pending',
    'CLAIM-' || p_order_id || '-' || extract(epoch from now())::int
  );
end;
$$;

-- Seller submits delivery evidence: paid -> delivered (buyer must confirm)
create or replace function public.submit_delivery(p_order_id bigint, p_payload text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  seller_id_of bigint;
  order_row public.orders%rowtype;
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
    set status = 'delivered', delivery_payload = left(btrim(p_payload), 4000),
        delivered_at = now()
    where id = p_order_id;

  insert into public.notifications (user_id, type, title, link)
  values (order_row.buyer_id, 'order_delivered',
          'Your order #' || p_order_id || ' has been delivered — please confirm to release funds.',
          '/orders/' || p_order_id);
end;
$$;

-- Buyer/staff confirm completion: delivered -> completed + LEDGER (idempotent)
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

  if order_row.status not in ('delivering', 'delivered', 'completed') then
    raise exception 'Order is not in delivering state (current: %)', order_row.status;
  end if;

  if order_row.status = 'completed' then
    return; -- idempotent: double-confirm is a no-op
  end if;

  update public.orders
    set status = 'completed', completed_at = now()
    where id = p_order_id;

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

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'complete_order', 'orders', p_order_id::text,
          jsonb_build_object('platform_fee', order_row.platform_fee, 'seller_proceeds', order_row.seller_proceeds));
end;
$$;

-- Staff confirm payment: accept BOTH legacy 'pending_verification' and the
-- new 'in_escrow' state so orders from either flow settle identically.
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

  if order_row.status not in ('pending_verification', 'in_escrow') then
    raise exception 'Order is not awaiting payment verification (current: %)', order_row.status;
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

grant execute on function public.submit_payment_claim(bigint) to authenticated;
grant execute on function public.submit_delivery(bigint, text) to authenticated;
grant execute on function public.complete_order(bigint) to authenticated;
grant execute on function public.confirm_payment(bigint, text, numeric) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. THE OFFERS API — spec columns over products; RLS stays enforced
-- -----------------------------------------------------------------------------
create or replace view public.offers
with (security_invoker = true) as
select
  p.id,
  p.seller_id,
  p.game_id,
  p.category_id,
  p.template_id,
  p.title,
  p.description,
  p.price_usd,
  p.stock,
  p.estimated_minutes               as delivery_time_minutes,
  (not p.is_deleted)                as is_active,
  p.delivery_method,
  p.stock_is_unlimited,
  p.status,
  p.sold_count,
  p.rating_sum,
  p.rating_count,
  p.created_at
from public.products p;

-- -----------------------------------------------------------------------------
-- sanity check (visible in the SQL editor after running)
-- -----------------------------------------------------------------------------
select 'escrow states ready' as status;
select slug, default_eligibility from public.product_categories order by slug;
