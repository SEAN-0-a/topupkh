-- -----------------------------------------------------------------------------
-- 0012: Fix "column r.user_id does not exist" in staff-notification queries
-- -----------------------------------------------------------------------------
-- Two SECURITY DEFINER functions in 0010 aliased public.profiles as `r` and
-- selected `r.user_id` to collect staff recipients. profiles has no user_id
-- column (its primary key is `id`), so:
--   * public.submit_seller_kyc  -> KYC submission failed with
--     "column r.user_id does not exist" (reported bug)
--   * public.move_escrow_on_order_status -> order-dispute notifications would
--     fail the same way (same latent bug, fixed here too)
--
-- create or replace keeps the function identity, so the grants applied in 0010
-- and the search_path hardening from 0011 survive; they are re-asserted below
-- for safety. The `orders_escrow_ledger` trigger does not need re-creating.
-- -----------------------------------------------------------------------------

-- Escrow trigger: fix staff recipient list (r -> profiles PK column)
create or replace function public.move_escrow_on_order_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  proceeds    numeric(12,2);
  seller_user uuid;
begin
  select s.user_id
    into seller_user
  from public.products p
  join public.sellers s on s.id = p.seller_id
  where p.id = new.product_id;

  -- unknown seller (should not happen; orders always reference a product)
  if seller_user is null then
    return new;
  end if;

  proceeds := new.seller_proceeds;

  if new.status = 'paid' and old.status in ('in_escrow', 'pending_verification') then
    -- Step 1: payment verified by admin -> funds held in pending escrow.
    update public.profiles
      set pending_escrow_balance = pending_escrow_balance + proceeds
      where id = seller_user;

  elsif new.status = 'completed' then
    -- Step 3: buyer confirmed receipt -> commission was already netted
    -- (seller_proceeds), release what was held.
    update public.profiles
      set pending_escrow_balance = greatest(pending_escrow_balance - proceeds, 0),
          available_balance      = available_balance + proceeds
      where id = seller_user;

  elsif new.status = 'refunded'
        and old.status in ('paid', 'processing', 'delivering', 'delivered') then
    -- The funds WERE credited to pending escrow (at 'paid'); pull them back.
    -- Refunds from 'in_escrow'/'pending_verification' (before admin
    -- verification) never touched the seller ledger — no balance change.
    update public.profiles
      set pending_escrow_balance = greatest(pending_escrow_balance - proceeds, 0)
      where id = seller_user;

  elsif new.status = 'disputed' then
    -- Step 4: FREEZE — funds stay in pending escrow; staff notified below.
    insert into public.notifications (user_id, type, title, body, link)
    select r.id, 'order_disputed',
           'Order #' || new.id || ' was reported/disputed — escrow frozen pending review.',
           coalesce(new.dispute_reason, 'Manual review required.'),
           '/admin/escrow'
    from public.profiles r
    where r.role in ('admin', 'support') and not r.is_banned;
  end if;

  return new;
end;
$$;

-- KYC submission: same `r.user_id` fix in the notify-staff query
create or replace function public.submit_seller_kyc(
  p_seller_type           public.seller_type_enum,
  p_shop_name             text,
  p_phone_number          text,
  p_payout_bank_name      text,
  p_payout_account_number text,
  p_payout_account_name   text,
  p_front_path            text,
  p_back_path             text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  current_status public.verification_status_type;
begin
  if uid is null then
    raise exception 'You must be signed in';
  end if;

  -- ---- validation (never trust the browser) ----
  if p_shop_name is null or char_length(btrim(p_shop_name)) < 2 or char_length(btrim(p_shop_name)) > 80 then
    raise exception 'Shop name must be 2-80 characters';
  end if;
  if p_phone_number is null or char_length(btrim(p_phone_number)) < 6
     or char_length(btrim(p_phone_number)) > 30
     or btrim(p_phone_number) !~ '^[0-9+()\-\s]+$' then
    raise exception 'Phone number looks invalid (6-30 digits, digits/+/()/dash/space)';
  end if;
  if p_payout_bank_name is null or char_length(btrim(p_payout_bank_name)) < 2
     or char_length(btrim(p_payout_bank_name)) > 60 then
    raise exception 'Payout bank name must be 2-60 characters';
  end if;
  if p_payout_account_number is null or char_length(btrim(p_payout_account_number)) < 4
     or char_length(btrim(p_payout_account_number)) > 34 then
    raise exception 'Payout account number must be 4-34 characters';
  end if;
  if p_payout_account_name is null or char_length(btrim(p_payout_account_name)) < 2
     or char_length(btrim(p_payout_account_name)) > 80 then
    raise exception 'Payout account holder name must be 2-80 characters';
  end if;

  -- documents must live under the caller's own private folder
  if p_front_path is null or p_back_path is null
     or position('..' in p_front_path) > 0 or position('..' in p_back_path) > 0
     or left(trim(p_front_path), char_length(uid::text) + 1) <> uid::text || '/'
     or left(trim(p_back_path),  char_length(uid::text) + 1) <> uid::text || '/' then
    raise exception 'ID documents were not uploaded correctly';
  end if;

  -- the uploads must actually exist in the private bucket
  if not exists (select 1 from storage.objects where bucket_id = 'seller-docs' and name = trim(p_front_path))
     or not exists (select 1 from storage.objects where bucket_id = 'seller-docs' and name = trim(p_back_path)) then
    raise exception 'Please upload both ID photos (front and back) first';
  end if;

  -- ---- KYC identity on profiles (the single source of truth) ----
  select verification_status into current_status
  from public.profiles where id = uid for update;
  if not found then
    raise exception 'Profile not found';
  end if;
  if current_status = 'pending' then
    raise exception 'Your verification is already under review';
  end if;

  update public.profiles
    set seller_type           = p_seller_type,
        shop_name             = btrim(p_shop_name),
        phone_number          = btrim(p_phone_number),
        payout_bank_name      = btrim(p_payout_bank_name),
        payout_account_number = btrim(p_payout_account_number),
        payout_account_name   = btrim(p_payout_account_name),
        id_document_front_url = trim(p_front_path),
        id_document_back_url  = trim(p_back_path),
        verification_status   = 'pending',
        verification_note     = null,
        verified_at           = null,
        updated_at            = now()
    where id = uid;

  -- keep the legacy `sellers` row in sync so the seller area (catalog,
  -- products, orders) keeps working while KYC review is pending
  insert into public.sellers (user_id, display_name, status)
  values (uid, coalesce((select display_name from public.profiles where id = uid), 'Seller'), 'pending')
  on conflict (user_id) do update
    set status = case when public.sellers.status in ('suspended') then public.sellers.status else 'pending' end,
        updated_at = now();

  -- legacy `seller_applications` gets a row so the old application audit
  -- trail still shows the (re-)submission
  insert into public.seller_applications (user_id, motivation)
  values (uid, 'KYC submission');

  -- notify staff — r is public.profiles, so the recipient column is r.id
  insert into public.notifications (user_id, type, title, body, link)
  select r.id, 'kyc_submitted',
         'New seller verification submitted by ' || btrim(p_shop_name),
         'KYC documents need review at /admin/sellers.',
         '/admin/sellers'
  from public.profiles r
  where r.role in ('admin', 'support') and not r.is_banned;

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, details)
  values (uid, 'submit_seller_kyc', 'profiles', uid::text,
          jsonb_build_object('seller_type', p_seller_type, 'shop_name', btrim(p_shop_name)));
end;
$$;

-- Re-assert execution rights (create or replace preserves ACLs, this is
-- belt-and-braces in case either function was recreated with a different owner
-- policy in between).
revoke execute on function public.submit_seller_kyc(public.seller_type_enum, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.submit_seller_kyc(public.seller_type_enum, text, text, text, text, text, text, text) to authenticated;
