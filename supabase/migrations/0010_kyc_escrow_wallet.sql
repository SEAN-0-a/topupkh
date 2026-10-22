-- =============================================================================
-- Migration 0010: Seller KYC + Escrow Wallet + Payouts  (SPEC-ALIGNED REWRITE)
-- =============================================================================
-- The seller's KYC identity and escrow wallet live on `public.profiles`
-- (1:1 with auth users). A single database choke point enforces every money /
-- verification rule; browsers can never self-approve KYC, self-refund a
-- payout, or forge a wallet balance:
--
--   1. New enums (exact spec names):
--        seller_type_enum        ('individual','company')
--        verification_status_type('unverified','pending','approved','rejected')
--        payout_status_enum      ('pending','approved','rejected')
--      (the legacy 0001 `payout_status` enum — used by the prototype `payouts`
--       table — is intentionally left untouched; `payout_status_enum` is the
--       new, cleaner type used by payout_requests.)
--   2. `profiles` gains seller/KYC/wallet columns:
--        seller_type, shop_name, phone_number, payout_bank_name,
--        payout_account_number, payout_account_name, id_document_front_url,
--        id_document_back_url, verification_status, verification_note,
--        verified_at, available_balance, pending_escrow_balance
--   3. COLUMN-LEVEL privilege choke points on profiles: `authenticated` may
--      UPDATE only self-editable columns (name/username/avatar/locale/phone/
--      payout bank) and SELECT only public profile columns. Verification
--      state, ID document paths and wallet balances are reachable ONLY
--      through the SECURITY DEFINER functions below — a direct PATCH on the
--      REST endpoint fails with `permission denied`.
--   4. An escrow trigger on orders.status moves money ON `profiles`:
--        paid      (admin verified the transfer) -> pending_escrow += proceeds
--        completed (buyer confirmed receipt)     -> pending_escrow -= proceeds,
--                                                    available     += proceeds
--        refunded  (only after the funds were credited) -> pending_escrow -=
--                                                    proceeds (clamped ≥ 0)
--        disputed  -> funds FROZEN, staff notified
--   5. `payout_requests` as a REAL table keyed to profiles(id), uuid PK.
--      There are deliberately NO insert/update RLS policies for browsers:
--      the only door in is request_payout() / review_payout().
--   6. SECURITY DEFINER functions:
--        submit_seller_kyc, review_seller_kyc, request_payout, review_payout
--        + read choke points: get_my_seller_profile,
--          admin_list_kyc_applications, admin_list_payouts
--
-- Idempotent; safe to re-run.
-- =============================================================================

do $$
begin
  if to_regclass('public.profiles') is null or to_regclass('public.orders') is null then
    raise exception
      'PREREQUISITE MISSING: public.profiles/public.orders do not exist. %',
      'Run 0001_marketplace_schema.sql (and 0002 if starting fresh) first.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. New enums (idempotent: conditional DO blocks for CREATE TYPE)
-- -----------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'seller_type_enum' and n.nspname = 'public') then
    create type public.seller_type_enum as enum ('individual', 'company');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'verification_status_type' and n.nspname = 'public') then
    create type public.verification_status_type as enum ('unverified', 'pending', 'approved', 'rejected');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'payout_status_enum' and n.nspname = 'public') then
    create type public.payout_status_enum as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Seller KYC + wallet columns on `profiles` (spec target table)
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists seller_type                public.seller_type_enum not null default 'individual',
  add column if not exists shop_name                  text,
  add column if not exists phone_number               text,
  add column if not exists payout_bank_name           text,
  add column if not exists payout_account_number      text,
  add column if not exists payout_account_name        text,
  add column if not exists id_document_front_url      text,
  add column if not exists id_document_back_url       text,
  add column if not exists verification_status        public.verification_status_type not null default 'unverified',
  add column if not exists verification_note          text,
  add column if not exists verified_at                timestamptz,
  add column if not exists available_balance          numeric(12, 2) not null default 0.00,
  add column if not exists pending_escrow_balance     numeric(12, 2) not null default 0.00;

create index if not exists profiles_verification_idx on public.profiles (verification_status);

-- -----------------------------------------------------------------------------
-- 3. COLUMN-LEVEL privilege choke points on `profiles`
-- -----------------------------------------------------------------------------
-- The 0001 `profile_self_update` policy is row-level only: without column
-- grants a signed-in user could PATCH their own row and forge
-- verification_status='approved' or available_balance=99999. Column
-- privileges close that hole: the sensitive columns are simply not granted.
--
-- SECURITY DEFINER functions below run as the table owner, so they (and only
-- they) can still touch the locked columns.
revoke update on public.profiles from anon, authenticated;
grant update (display_name, username, avatar_url, locale,
              phone_number, payout_bank_name, payout_account_number, payout_account_name)
  on public.profiles to authenticated;

-- Public/self-readable columns. Anyone may see identity + verification badge;
-- phone, bank details, ID document paths, review notes and wallet balances are
-- NOT granted — they are served exclusively via get_my_seller_profile() /
-- admin_list_*() definer functions.
revoke select on public.profiles from anon, authenticated;
grant select (id, display_name, username, avatar_url, locale, role, is_banned,
              created_at, updated_at, seller_type, shop_name, verification_status)
  on public.profiles to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Escrow trigger: money follows order status — nothing else can
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
-- 5. Private `seller-docs` storage bucket (ID documents) + policies
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'seller-docs') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('seller-docs', 'seller-docs', false, 5 * 1024 * 1024,
            array['image/png', 'image/jpeg', 'image/webp']);
  else
    update storage.buckets
      set public = false,
          file_size_limit = 5 * 1024 * 1024,
          allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
      where id = 'seller-docs';
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

-- owner re-download + admin KYC review (signed URLs created server-side)
drop policy if exists seller_docs_read on storage.objects;
create policy seller_docs_read on storage.objects
  for select using (
    bucket_id = 'seller-docs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  );

-- -----------------------------------------------------------------------------
-- 6. payout_requests — REAL table keyed to profiles(id)
-- -----------------------------------------------------------------------------
do $$
declare
  rel_kind char(1);
begin
  if to_regclass('public.payout_requests') is not null then
    select c.relkind into rel_kind
    from pg_class c
    where c.oid = to_regclass('public.payout_requests');
    if rel_kind in ('v', 'm') then
      execute 'drop view public.payout_requests';
    elsif rel_kind = 'r' then
      -- legacy prototype table (pre-0001a rename) — replaced wholesale
      execute 'drop table public.payout_requests cascade';
    end if;
  end if;
end $$;

create table if not exists public.payout_requests (
  id             uuid primary key default gen_random_uuid(),
  seller_id      uuid not null references public.profiles (id) on delete cascade,
  amount         numeric(12, 2) not null check (amount > 0),
  bank_name      text not null,
  account_number text not null,
  account_name   text not null,
  status         public.payout_status_enum not null default 'pending',
  reviewed_by    uuid references public.profiles (id),
  reviewed_at    timestamptz,
  review_note    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
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
    seller_id = auth.uid()
    or public.is_staff()
  );

-- -----------------------------------------------------------------------------
-- 7. SECURITY DEFINER functions (browser can never bypass these)
-- -----------------------------------------------------------------------------

-- Read choke point: the caller's OWN profile incl. sensitive columns
-- (verification state, bank details, wallet balances) + legacy seller status.
-- The wallet / verification / settings UIs render from this — they never
-- select the locked columns through PostgREST directly.
create or replace function public.get_my_seller_profile()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(p) || jsonb_build_object(
           'sellers_status',  s.status,
           'completed_sales', coalesce(s.completed_sales, 0)
         )
  from public.profiles p
  left join public.sellers s on s.user_id = p.id
  where p.id = auth.uid();
$$;

-- Seller: submit / re-submit KYC (Step 1 + Step 2 of onboarding).
-- Writes verification_status = 'pending' and NEVER anything else.
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
set search_path = public
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

  -- notify staff
  insert into public.notifications (user_id, type, title, body, link)
  select r.user_id, 'kyc_submitted',
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

-- Admin: approve / reject a pending KYC application (profiles.verification_note
-- carries the rejection reason back to the seller on /seller/verify).
create or replace function public.review_seller_kyc(
  p_user_id uuid,
  p_approve boolean,
  p_note    text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  note text := left(btrim(coalesce(p_note, '')), 500);
  current_status public.verification_status_type;
begin
  if not public.is_staff() or public.current_role() <> 'admin' then
    raise exception 'Only administrators can review seller verification';
  end if;

  perform 1 from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Seller not found';
  end if;
  select verification_status into current_status
  from public.profiles where id = p_user_id;
  if current_status <> 'pending' then
    raise exception 'This application is not pending review (current: %)', current_status;
  end if;

  if p_approve then
    update public.profiles
      set verification_status = 'approved',
          verified_at         = now(),
          verification_note   = null,
          updated_at          = now()
      where id = p_user_id;

    -- promote buyer -> seller so listing creation passes requireRole
    update public.profiles
      set role = 'seller'
      where id = p_user_id and role = 'buyer';

    -- keep the legacy sellers row aligned (catalog & product ownership)
    insert into public.sellers (user_id, display_name, status)
    values (p_user_id, coalesce((select display_name from public.profiles where id = p_user_id), 'Seller'), 'approved')
    on conflict (user_id) do update
      set status = case when public.sellers.status = 'suspended' then public.sellers.status else 'approved' end,
          updated_at = now();

    insert into public.notifications (user_id, type, title, body, link)
    values (p_user_id, 'kyc_approved',
            '✅ Your seller verification was approved!',
            'You can now create offers and request payouts.', '/seller/dashboard');
  else
    update public.profiles
      set verification_status = 'rejected',
          verification_note   = note,
          verified_at         = null,
          updated_at          = now()
      where id = p_user_id;

    insert into public.sellers (user_id, display_name, status, rejection_note)
    values (p_user_id, coalesce((select display_name from public.profiles where id = p_user_id), 'Seller'), 'rejected', note)
    on conflict (user_id) do update
      set status = 'rejected', rejection_note = note, updated_at = now();

    insert into public.notifications (user_id, type, title, body, link)
    values (p_user_id, 'kyc_rejected',
            '❌ Your seller verification was not approved',
            coalesce(nullif(note, ''), 'Please review your documents and re-apply.'),
            '/seller/verify');
  end if;

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'review_seller_kyc', 'profiles', p_user_id::text,
          jsonb_build_object('approved', p_approve, 'note', note));
end;
$$;

-- Seller: request withdrawal of available_balance.
-- Funds are DEBITED at request time (can never overdraw; reject refunds them).
create or replace function public.request_payout(p_amount numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.profiles%rowtype;
  seller_row_id bigint;
  min_amount numeric(12,2);
  request_id uuid;
begin
  if uid is null then
    raise exception 'You must be signed in';
  end if;

  select * into p from public.profiles
    where id = uid and verification_status = 'approved'
    for update;

  if not found then
    raise exception 'Complete seller verification before requesting payouts';
  end if;

  -- a suspended legacy seller account cannot withdraw
  select id into seller_row_id from public.sellers where user_id = uid;
  if seller_row_id is not null then
    if exists (select 1 from public.sellers where id = seller_row_id and status = 'suspended') then
      raise exception 'Your seller account is suspended — contact support';
    end if;
  end if;

  if coalesce(btrim(p.payout_bank_name), '') = ''
     or coalesce(btrim(p.payout_account_number), '') = ''
     or coalesce(btrim(p.payout_account_name), '') = '' then
    raise exception 'Save your payout bank details first';
  end if;

  select coalesce(nullif(value #>> '{}', ''), '20')::numeric into min_amount
  from public.platform_settings where key = 'min_payout_usd';
  min_amount := coalesce(min_amount, 20);

  if p_amount is null or p_amount < min_amount then
    raise exception 'Minimum payout is $%', min_amount;
  end if;

  if p_amount > p.available_balance then
    raise exception 'Requested amount exceeds your available balance ($%)', p.available_balance;
  end if;

  -- atomic debit + request creation (single definer transaction)
  update public.profiles
    set available_balance = available_balance - p_amount
    where id = uid;

  insert into public.payout_requests (seller_id, amount, bank_name, account_number, account_name)
  values (uid, p_amount, p.payout_bank_name, p.payout_account_number, p.payout_account_name)
  returning id into request_id;

  -- ledger: withdrawal held for processing
  insert into public.transaction_ledger (order_id, seller_id, entry_type, amount_khr_usd, direction, note, created_by)
  values (null, seller_row_id, 'payout', p_amount, 'seller_debited',
          'Payout request held for admin confirmation', uid);

  insert into public.notifications (user_id, type, title, body, link)
  values (uid, 'payout_requested',
          '💸 Payout request for $' || p_amount || ' submitted',
          'Your funds were reserved and are awaiting admin confirmation of the bank transfer.',
          '/wallet');

  return request_id;
end;
$$;

-- Admin: confirm the external bank transfer (approve) or reject/return funds.
-- On approval the request records completion (reviewed_by/at); on rejection
-- the held amount is automatically refunded to the seller's available_balance.
create or replace function public.review_payout(
  p_request_id uuid,
  p_approve    boolean,
  p_note       text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.payout_requests%rowtype;
  note text := left(btrim(coalesce(p_note, '')), 500);
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
          review_note = note, updated_at = now()
      where id = p_request_id;

    insert into public.notifications (user_id, type, title, body, link)
    values (r.seller_id, 'payout_approved',
            '✅ Payout of $' || r.amount || ' approved & sent',
            'The bank transfer was confirmed and marked paid.', '/wallet');
  else
    update public.payout_requests
      set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
          review_note = note, updated_at = now()
      where id = p_request_id;

    -- automatic refund of the held amount
    update public.profiles
      set available_balance = available_balance + r.amount
      where id = r.seller_id;

    insert into public.transaction_ledger (order_id, seller_id, entry_type, amount_khr_usd, direction, note, created_by)
    values (null, (select id from public.sellers where user_id = r.seller_id), 'payout', r.amount,
            'seller_earned', 'Payout request rejected — funds returned', auth.uid());

    insert into public.notifications (user_id, type, title, body, link)
    values (r.seller_id, 'payout_rejected',
            '❌ Payout request of $' || r.amount || ' was rejected',
            coalesce(nullif(note, ''), 'Funds were returned to your available balance.'),
            '/wallet');
  end if;

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'review_payout', 'payout_requests', p_request_id::text,
          jsonb_build_object('approved', p_approve, 'note', note));
end;
$$;

-- Admin read choke point: every KYC application + legacy seller status.
create or replace function public.admin_list_kyc_applications()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.updated_at desc), '[]'::jsonb)
  from (
    select
      p.id                      as user_id,
      p.display_name,
      p.seller_type             as seller_type_text,
      p.shop_name,
      p.phone_number,
      p.payout_bank_name,
      p.payout_account_number,
      p.payout_account_name,
      p.id_document_front_url,
      p.id_document_back_url,
      p.verification_status     as verification_status_text,
      p.verification_note,
      p.verified_at,
      p.available_balance,
      p.pending_escrow_balance,
      p.updated_at,
      s.status                  as seller_status_text,
      s.completed_sales
    from public.profiles p
    left join public.sellers s on s.user_id = p.id
  ) r;
$$;

-- Admin read choke point: payout requests with the seller's display name.
create or replace function public.admin_list_payouts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
  from (
    select
      pr.id,
      pr.seller_id,
      pr.amount,
      pr.bank_name,
      pr.account_number,
      pr.account_name,
      pr.status                 as status_text,
      pr.reviewed_at,
      pr.review_note,
      pr.created_at,
      s.display_name            as seller_display_name
    from public.payout_requests pr
    left join public.profiles p on p.id = pr.seller_id
    left join public.sellers s on s.user_id = pr.seller_id
  ) r;
$$;

-- -----------------------------------------------------------------------------
-- 8. Grants (functions are EXECUTE-able ONLY by authenticated users)
-- -----------------------------------------------------------------------------
revoke execute on function public.submit_seller_kyc(public.seller_type_enum, text, text, text, text, text, text, text) from public, anon;
revoke execute on function public.review_seller_kyc(uuid, boolean, text) from public, anon;
revoke execute on function public.request_payout(numeric) from public, anon;
revoke execute on function public.review_payout(uuid, boolean, text) from public, anon;
revoke execute on function public.get_my_seller_profile() from public, anon;
revoke execute on function public.admin_list_kyc_applications() from public, anon;
revoke execute on function public.admin_list_payouts() from public, anon;

grant execute on function public.submit_seller_kyc(public.seller_type_enum, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.review_seller_kyc(uuid, boolean, text) to authenticated;
grant execute on function public.request_payout(numeric) to authenticated;
grant execute on function public.review_payout(uuid, boolean, text) to authenticated;
grant execute on function public.get_my_seller_profile() to authenticated;
-- staff/admin listing RPCs: authenticated is granted (the functions reject
-- non-admins internally); supporting staff-only pages would re-grant anyway.
grant execute on function public.admin_list_kyc_applications() to authenticated;
grant execute on function public.admin_list_payouts() to authenticated;

notify pgrst, 'reload schema';

select 'migration 0010 OK' as status;
