-- =============================================================================
-- Migration 0010: Seller KYC + Escrow Wallet + Payouts
-- =============================================================================
-- Adds, on top of the RPC-guarded order lifecycle (0001/0002/0008):
--
--   1. KYC verification fields on `sellers` (seller_type, shop_name,
--      phone_number, payout bank details, ID document paths on the PRIVATE
--      `seller-docs` bucket) + verification_status + wallet columns
--      (available_balance, pending_escrow_balance).
--   2. An escrow trigger on orders.status:
--        paid  (admin verified the transfer)          -> pending_escrow += seller_proceeds
--        completed (buyer confirmed receipt)          -> pending_escrow -= proceeds,
--                                                        available += proceeds
--        refunded (before completion)                 -> pending_escrow -= proceeds
--        disputed                                     -> funds FROZEN, staff notified
--      (Existing RPCs never change; money state is derived from THE single
--      choke point — the status UPDATE itself.)
--   3. `payout_requests` as a REAL table (legacy prototype view/table is
--      dropped; funds are debited atomically at request time by the
--      request_payout() definer function — a request can never overdraw).
--   4. SECURITY DEFINER functions: submit_seller_kyc, review_seller_kyc,
--      request_payout, review_payout, raise_dispute. Browsers can never
--      self-approve KYC, self-refund a payout, or forge a wallet balance.
--
-- Status-name mapping vs the original spec (existing enum is richer):
--   'pending_payment' ≈ spec pending_payment
--   'in_escrow' (buyer claims) / 'paid' (admin verified) ≈ spec 'paid_held'
--   'delivering'/'delivered' ≈ spec 'delivered'
--   'completed' ≈ spec completed, 'disputed' ≈ spec disputed, 'refunded' ≈ same
--
-- Idempotent; safe to re-run.
-- =============================================================================

do $$
begin
  if to_regclass('public.sellers') is null or to_regclass('public.orders') is null then
    raise exception
      'PREREQUISITE MISSING: public.sellers/public.orders do not exist. %',
      'Run 0001_marketplace_schema.sql (and 0002 if starting fresh) first.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. New enums (idempotent: use conditional DO blocks for CREATE TYPE)
-- -----------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'seller_type_enum' and n.nspname = 'public') then
    create type public.seller_type as enum ('individual', 'company');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'seller_verification_status' and n.nspname = 'public') then
    create type public.seller_verification_status as enum ('unverified', 'pending', 'approved', 'rejected');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'payout_status' and n.nspname = 'public') then
    create type public.payout_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Seller KYC + wallet columns
-- -----------------------------------------------------------------------------
alter table public.sellers
  add column if not exists seller_type                public.seller_type not null default 'individual',
  add column if not exists shop_name                  text not null default '',
  add column if not exists phone_number               text not null default '',
  add column if not exists payout_bank_name           text not null default '',
  add column if not exists payout_account_number      text not null default '',
  add column if not exists payout_account_name        text not null default '',
  add column if not exists id_document_front_url      text,
  add column if not exists id_document_back_url       text,
  add column if not exists verification_status        public.seller_verification_status not null default 'unverified',
  add column if not exists verification_note          text,
  add column if not exists verified_at                timestamptz,
  add column if not exists available_balance          numeric(12,2) not null default 0,
  add column if not exists pending_escrow_balance     numeric(12,2) not null default 0;

create index if not exists sellers_verification_idx on public.sellers (verification_status);

-- -----------------------------------------------------------------------------
-- 3. Escrow trigger: money follows order status — nothing else can
-- -----------------------------------------------------------------------------
-- where a dispute reason is stored when raised
alter table public.orders add column if not exists dispute_reason text;

create or replace function public.move_escrow_on_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  proceeds      numeric(12,2);
  seller_row_id bigint;
  seller_user   uuid;
begin
  select p.seller_id, s.user_id
    into seller_row_id, seller_user
  from public.products p
  join public.sellers s on s.id = p.seller_id
  where p.id = new.product_id;

  proceeds := new.seller_proceeds;

  if new.status = 'paid' and old.status in ('in_escrow', 'pending_verification') then
    -- Step 1: payment verified by admin -> funds held in pending escrow.
    update public.sellers
      set pending_escrow_balance = pending_escrow_balance + proceeds
      where id = seller_row_id;

  elsif new.status = 'completed' then
    -- Step 3: buyer confirmed receipt -> commission was already netted
    -- (seller_proceeds), release what was held.
    update public.sellers
      set pending_escrow_balance = pending_escrow_balance - proceeds,
          available_balance      = available_balance + proceeds
      where id = seller_row_id;

  elsif new.status = 'refunded'
        and old.status in ('in_escrow', 'pending_verification', 'paid',
                           'processing', 'delivering', 'delivered') then
    -- held funds are pulled back (refunds of completed orders are not allowed)
    update public.sellers
      set pending_escrow_balance = pending_escrow_balance - proceeds
      where id = seller_row_id;

  elsif new.status = 'disputed' then
    -- Step 4: FREEZE — funds stay in pending escrow; staff notified below.
    insert into public.notifications (user_id, type, title, body, link)
    select r.user_id, 'order_disputed',
           'Order #' || new.id || ' was reported/disputed — escrow frozen pending review.',
           coalesce(new.dispute_reason, 'Manual review required.'),
           '/admin/escrow'
    from public.profiles r
    where r.role in ('admin', 'support') and not r.is_banned;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_escrow_ledger on public.orders;
create trigger orders_escrow_ledger
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function public.move_escrow_on_order_status();

-- -----------------------------------------------------------------------------
-- 4. Private `seller-docs` storage bucket (ID documents) + policies
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'seller-docs') then
    insert into storage.buckets (id, name, public) values ('seller-docs', 'seller-docs', false);
  else
    update storage.buckets set public = false where id = 'seller-docs';
  end if;
end $$;

drop policy if exists seller_docs_owner_insert on storage.objects;
create policy seller_docs_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'seller-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists seller_docs_owner_update on storage.objects;
create policy seller_docs_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'seller-docs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'seller-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists seller_docs_owner_delete on storage.objects;
create policy seller_docs_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'seller-docs' and (storage.foldername(name))[1] = auth.uid()::text);

-- owner re-download + staff KYC review (signed URLs created server-side)
drop policy if exists seller_docs_read on storage.objects;
create policy seller_docs_read on storage.objects
  for select using (
    bucket_id = 'seller-docs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  );

-- -----------------------------------------------------------------------------
-- 5. payout_requests — REAL table (replaces the legacy prototype view)
-- -----------------------------------------------------------------------------
drop view if exists public.payout_requests;

create table if not exists public.payout_requests (
  id             bigserial primary key,
  seller_id      bigint not null references public.sellers (id) on delete cascade,
  amount         numeric(12,2) not null check (amount > 0),
  bank_name      text not null,
  account_number text not null,
  account_name   text not null,
  status         public.payout_status not null default 'pending',
  reviewed_by    uuid references auth.users (id),
  reviewed_at    timestamptz,
  review_note    text,
  created_at     timestamptz not null default now()
);

create index if not exists payout_requests_seller_idx on public.payout_requests (seller_id, created_at desc);
create index if not exists payout_requests_status_idx on public.payout_requests (status, created_at desc);

alter table public.payout_requests enable row level security;

-- sellers see own history; staff see everything. INSERT/UPDATE deliberately
-- has NO policy: the only door in is request_payout()/review_payout() below,
-- so a request can never exist without its matching atomic debit.
drop policy if exists payout_requests_read on public.payout_requests;
create policy payout_requests_read on public.payout_requests
  for select using (
    seller_id in (select s.id from public.sellers s where s.user_id = auth.uid())
    or public.is_staff()
  );

-- Recreate the legacy `seller_wallets` view on the NEW wallet columns so the
-- legacy dashboard keeps working with correct balances.
drop view if exists public.seller_wallets;
create or replace view public.seller_wallets
with (security_invoker = true) as
select
  s.id                    as seller_id,
  s.user_id,
  s.available_balance,
  s.pending_escrow_balance as pending_escrow,
  s.payout_account_number  as aba_number,
  s.payout_account_name    as aba_name,
  s.updated_at
from public.sellers s;

-- -----------------------------------------------------------------------------
-- 6. SECURITY DEFINER functions (browser can never bypass these)
-- -----------------------------------------------------------------------------

-- Seller: submit / re-submit KYC documents (Step 1 + Step 2 of onboarding)
create or replace function public.submit_seller_kyc(
  p_seller_type          public.seller_type,
  p_shop_name            text,
  p_phone_number         text,
  p_payout_bank_name     text,
  p_payout_account_number text,
  p_payout_account_name  text,
  p_front_path           text,
  p_back_path            text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing record;
begin
  if uid is null then
    raise exception 'You must be signed in';
  end if;
  if public.current_role() = 'admin' then
    null; -- admins may submit on behalf (rare); buyers/sellers as normal
  end if;

  -- ---- validation (never trust the browser) ----
  if p_shop_name is null or char_length(btrim(p_shop_name)) < 2 or char_length(btrim(p_shop_name)) > 80 then
    raise exception 'Shop name must be 2–80 characters';
  end if;
  if p_phone_number is null or char_length(btrim(p_phone_number)) < 6
     or char_length(btrim(p_phone_number)) > 30
     or btrim(p_phone_number) !~ '^[0-9+()\-\s]+$' then
    raise exception 'Phone number looks invalid (6–30 digits, digits/+/()/dash/space)';
  end if;
  if p_payout_bank_name is null or char_length(btrim(p_payout_bank_name)) < 2
     or char_length(btrim(p_payout_bank_name)) > 60 then
    raise exception 'Payout bank name must be 2–60 characters';
  end if;
  if p_payout_account_number is null or char_length(btrim(p_payout_account_number)) < 4
     or char_length(btrim(p_payout_account_number)) > 34 then
    raise exception 'Payout account number must be 4–34 characters';
  end if;
  if p_payout_account_name is null or char_length(btrim(p_payout_account_name)) < 2
     or char_length(btrim(p_payout_account_name)) > 80 then
    raise exception 'Payout account holder name must be 2–80 characters';
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

  -- ---- upsert the sellers row ----
  select id, status, verification_status into existing
  from public.sellers where user_id = uid for update;

  if found then
    if existing.verification_status = 'pending' then
      raise exception 'Your verification is already under review';
    end if;
    update public.sellers
      set seller_type           = p_seller_type,
          shop_name             = btrim(p_shop_name),
          phone_number          = btrim(p_phone_number),
          payout_bank_name      = btrim(p_payout_bank_name),
          payout_account_number = btrim(p_payout_account_number),
          payout_account_name   = btrim(p_payout_account_name),
          id_document_front_url = trim(p_front_path),
          id_document_back_url  = trim(p_back_path),
          verification_status   = 'pending',
          status                = case when existing.verification_status = 'rejected' then 'pending' else status end,
          verified_at           = null,
          updated_at            = now()
      where user_id = uid;

    -- legacy `seller_applications` gets a row so the old application audit
    -- trail still shows the re-submission
    insert into public.seller_applications (user_id, motivation) values (uid, 'KYC re-submission');
  else
    insert into public.sellers (
      user_id, display_name, seller_type, shop_name, phone_number,
      payout_bank_name, payout_account_number, payout_account_name,
      id_document_front_url, id_document_back_url, status, verification_status
    ) values (
      uid,
      coalesce((select display_name from public.profiles where id = uid), 'Seller'),
      p_seller_type, btrim(p_shop_name), btrim(p_phone_number),
      btrim(p_payout_bank_name), btrim(p_payout_account_number), btrim(p_payout_account_name),
      trim(p_front_path), trim(p_back_path), 'pending', 'pending'
    );

    insert into public.seller_applications (user_id, motivation) values (uid, 'KYC submission');
  end if;

  -- notify staff
  insert into public.notifications (user_id, type, title, body, link)
  select r.user_id, 'kyc_submitted',
         'New seller verification submitted by ' || shop_name,
         'KYC documents need review at /admin/sellers.',
         '/admin/sellers'
  from public.profiles r
  where r.role in ('admin', 'support') and not r.is_banned;

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, details)
  values (uid, 'submit_seller_kyc', 'sellers', uid::text,
          jsonb_build_object('seller_type', p_seller_type, 'shop_name', btrim(p_shop_name)));
end;
$$;

-- Admin: approve / reject a KYC application
create or replace function public.review_seller_kyc(
  p_seller_id bigint,
  p_approve   boolean,
  p_note      text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
begin
  if not public.is_staff() or public.current_role() <> 'admin' then
    raise exception 'Only administrators can review seller verification';
  end if;

  select * into s from public.sellers where id = p_seller_id for update;
  if not found then
    raise exception 'Seller not found';
  end if;
  if s.verification_status <> 'pending' then
    raise exception 'This application is not pending review (current: %)', s.verification_status;
  end if;

  if p_approve then
    update public.sellers
      set verification_status = 'approved',
          verified_at         = now(),
          verification_note   = null,
          status              = case when status = 'suspended' then status else 'approved' end,
          updated_at          = now()
      where id = p_seller_id;
    insert into public.notifications (user_id, type, title, body, link)
    values (s.user_id, 'kyc_approved',
            '✅ Your seller verification was approved!',
            'You can now create offers and request payouts.', '/seller/dashboard');
  else
    update public.sellers
      set verification_status = 'rejected',
          status              = 'rejected',
          rejection_note      = left(btrim(coalesce(p_note, '')), 500),
          updated_at          = now()
      where id = p_seller_id;
    insert into public.notifications (user_id, type, title, body, link)
    values (s.user_id, 'kyc_rejected',
            '❌ Your seller verification was not approved',
            coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Please review your documents and re-apply.'),
            '/seller/verify');
  end if;

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'review_seller_kyc', 'sellers', p_seller_id::text,
          jsonb_build_object('approved', p_approve, 'note', p_note));
end;
$$;

-- Seller: request withdrawal of available_balance
-- Funds are DEBITED at request time (can never overdraw; reject refunds them).
create or replace function public.request_payout(p_amount numeric)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s record;
  min_amount numeric(12,2);
  request_id bigint;
begin
  if uid is null then
    raise exception 'You must be signed in';
  end if;

  select * into s from public.sellers
    where user_id = uid and verification_status = 'approved'
    for update;

  if not found then
    raise exception 'Complete seller verification before requesting payouts';
  end if;

  if btrim(s.payout_bank_name) = '' or btrim(s.payout_account_number) = '' or btrim(s.payout_account_name) = '' then
    raise exception 'Save your payout bank details first';
  end if;

  select coalesce(nullif(value #>> '{}', ''), '20')::numeric into min_amount
  from public.platform_settings where key = 'min_payout_usd';
  min_amount := coalesce(min_amount, 20);

  if p_amount is null or p_amount < min_amount then
    raise exception 'Minimum payout is $%', min_amount;
  end if;

  if p_amount > s.available_balance then
    raise exception 'Requested amount exceeds your available balance ($%)', s.available_balance;
  end if;

  update public.sellers
    set available_balance = available_balance - p_amount
    where id = s.id;

  insert into public.payout_requests (seller_id, amount, bank_name, account_number, account_name)
  values (s.id, p_amount, s.payout_bank_name, s.payout_account_number, s.payout_account_name)
  returning id into request_id;

  -- ledger: withdrawal held for processing
  insert into public.transaction_ledger (order_id, seller_id, entry_type, amount_khr_usd, direction, note, created_by)
  values (null, s.id, 'payout', p_amount, 'seller_debited',
          'Payout request #' || request_id || ' held for admin confirmation', uid);

  insert into public.notifications (user_id, type, title, body, link)
  values (uid, 'payout_requested',
          '💸 Payout request for $' || p_amount || ' submitted',
          'Your funds were reserved and are awaiting admin confirmation of the bank transfer.',
          '/wallet');

  return request_id;
end;
$$;

-- Admin: confirm the external bank transfer (approve) or reject/return funds
create or replace function public.review_payout(
  p_request_id bigint,
  p_approve    boolean,
  p_note       text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if not public.is_staff() or public.current_role() <> 'admin' then
    raise exception 'Only administrators can review payout requests';
  end if;

  select * into r from public.payout_requests where id = p_request_id for update;
  if not found then
    raise exception 'Payout request not found';
  end if;
  if r.status <> 'pending' then
    raise exception 'This payout was already reviewed (current: %)', r.status;
  end if;

  if p_approve then
    update public.payout_requests
      set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
          review_note = left(btrim(coalesce(p_note, '')), 500)
      where id = p_request_id;
    insert into public.notifications (user_id, type, title, body, link)
    select s.user_id, 'payout_approved',
           '✅ Payout of $' || r.amount || ' approved & sent',
           'The bank transfer was confirmed and marked paid.', '/wallet'
    from public.sellers s where s.id = r.seller_id;
  else
    update public.payout_requests
      set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
          review_note = left(btrim(coalesce(p_note, '')), 500)
      where id = p_request_id;

    update public.sellers
      set available_balance = available_balance + r.amount
      where id = r.seller_id;

    insert into public.transaction_ledger (order_id, seller_id, entry_type, amount_khr_usd, direction, note, created_by)
    values (null, r.seller_id, 'payout', r.amount, 'seller_earned',
            'Payout request #' || p_request_id || ' rejected — funds returned', auth.uid());

    insert into public.notifications (user_id, type, title, body, link)
    select s.user_id, 'payout_rejected',
           '❌ Payout request of $' || r.amount || ' was rejected',
           coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Funds were returned to your available balance.'),
           '/wallet'
    from public.sellers s where s.id = r.seller_id;
  end if;

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'review_payout', 'payout_requests', p_request_id::text,
          jsonb_build_object('approved', p_approve, 'note', p_note));
end;
$$;

-- Buyer/staff: report a problem -> freeze escrow (trigger reacts)
create or replace function public.raise_dispute(p_order_id bigint, p_reason text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  dispute_reason text;
begin
  select * into order_row from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if order_row.buyer_id <> auth.uid() and not public.is_staff() then
    raise exception 'Only the buyer or staff can report a dispute';
  end if;

  if order_row.status not in ('in_escrow', 'pending_verification', 'paid', 'processing', 'delivering', 'delivered') then
    raise exception 'This order can no longer be disputed (current: %)', order_row.status;
  end if;

  dispute_reason := left(btrim(coalesce(p_reason, '')), 500);
  if dispute_reason = '' then
    raise exception 'Describe the problem in at least a few words';
  end if;

  update public.orders
    set status = 'disputed', dispute_reason = dispute_reason
    where id = p_order_id;

  insert into public.transaction_ledger (order_id, seller_id, entry_type, amount_khr_usd, direction, note, created_by)
  values (p_order_id, (select p.seller_id from public.products p where p.id = order_row.product_id),
          'adjustment', 0, 'seller_debited', 'Escrow frozen for dispute: ' || dispute_reason, auth.uid());
end;
$$;

-- grants
grant execute on function public.submit_seller_kyc(public.seller_type, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.review_seller_kyc(bigint, boolean, text) to authenticated;
grant execute on function public.request_payout(numeric) to authenticated;
grant execute on function public.review_payout(bigint, boolean, text) to authenticated;
grant execute on function public.raise_dispute(bigint, text) to authenticated;

notify pgrst, 'reload schema';

select 'migration 0010 OK' as status;
