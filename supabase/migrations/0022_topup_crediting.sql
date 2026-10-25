-- =============================================================================
-- Migration 0022: Top-Up Crediting Engine (docs/PAYMENTS.md §4)
-- =============================================================================
-- WHAT THIS ADDS (all idempotent — re-runnable like every migration before it):
--
--   1. `needs_manual_review` order_status value — the parking state for paid
--      orders the automated crediting engine could not fulfil. Did NOT touch
--      the existing lifecycle: 'paid → delivering → completed' stays owned by
--      the SECURITY DEFINER functions from 0002/0008 (submit_delivery,
--      complete_order), which remain the ONLY thing that writes the commission
--      ledger. Auto-crediting ends a paid order's journey at 'delivering'
--      (delivery_payload = claimed pin codes) — the buyer-confirm flow then
--      mints the ledger, exactly like a manual seller delivery would.
--
--   2. `voucher_codes` — the digital-goods inventory (pin/code per unit) the
--      engine allocates from. Codes are SECRET: RLS denies every read for
--      buyers; staff manage rows through the admin client or SQL editor only.
--      Buyers receive codes exclusively via their own order row
--      (orders.delivery_payload).
--
--   3. `fulfillment_events` — crediting audit trail. Never stores raw codes
--      (only masked counts/refs); the codes themselves live on the order.
--
--   4. `claim_voucher_codes(p_order_id, p_quantity)` — the atomic claim:
--      ONE transaction takes the order row lock, verifies the order is still
--      creditable, claims up to `p_quantity` available codes for the product
--      (FOR UPDATE SKIP LOCKED → concurrent webhook replays serialize instead
--      of double-claiming), releases a failed partial claim, and on success
--      flips the order to 'delivering' in the same transaction. Returning 500
--      to a webhook is safe BECAUSE of this — a retry can only ever credit
--      another unit's worth of untouched codes, never double-deliver.
--
--      Execute is granted to service_role ONLY: PostgREST exposes functions
--      in the public schema at /rest/v1/rpc/*, so anon/authenticated tokens
--      must never be able to call a routine that hands out secret codes.
-- =============================================================================

-- New parking status for orders the engine could not auto-credit.
alter type public.order_status add value if not exists 'needs_manual_review';

-- int enum for the inventory lifecycle
do $$ begin
  create type voucher_code_status as enum ('available', 'claimed');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 1. Pin/code inventory
-- -----------------------------------------------------------------------------
create table if not exists public.voucher_codes (
  id                  bigserial primary key,
  product_id          bigint not null references public.products (id) on delete cascade,
  -- the secret payload actually delivered to the buyer (pin, code, key…)
  code                text not null check (btrim(code) <> ''),
  status              voucher_code_status not null default 'available',
  claimed_by_order_id bigint references public.orders (id),
  claimed_at          timestamptz,
  created_at          timestamptz not null default now(),
  unique (product_id, code)
);

-- the claim query scans exactly this
create index if not exists voucher_codes_claim_idx
  on public.voucher_codes (product_id) where status = 'available';
-- "which codes did order X get" audits
create index if not exists voucher_codes_order_idx
  on public.voucher_codes (claimed_by_order_id);

alter table public.voucher_codes enable row level security;
drop policy if exists voucher_codes_staff_read on public.voucher_codes;
create policy voucher_codes_staff_read on public.voucher_codes
  for select to authenticated
  using (public.current_role() = 'admin');
drop policy if exists voucher_codes_admin_write on public.voucher_codes;
create policy voucher_codes_admin_write on public.voucher_codes
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- -----------------------------------------------------------------------------
-- 2. Crediting audit log (masked — never embed raw codes here)
-- -----------------------------------------------------------------------------
create table if not exists public.fulfillment_events (
  id          bigserial primary key,
  order_id    bigint not null references public.orders (id) on delete cascade,
  -- 'fulfilled' | 'needs_manual_review' | 'no_inventory_configured' | 'fulfillment_error'
  event_type  text not null,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists fulfillment_events_order_idx
  on public.fulfillment_events (order_id, created_at desc);

alter table public.fulfillment_events enable row level security;
drop policy if exists fulfillment_events_staff_read on public.fulfillment_events;
create policy fulfillment_events_staff_read on public.fulfillment_events
  for select to authenticated
  using (public.current_role() = 'admin');

-- -----------------------------------------------------------------------------
-- 3. The atomic claim + credit transaction
-- -----------------------------------------------------------------------------
--
-- Returns the claimed codes (in allocation order), or an EMPTY array when the
-- product simply has fewer than `p_quantity` unused codes (caller decides:
-- src/lib/crediting.ts maps that to needs_manual_review and releases nothing —
-- a failed partial claim is released HERE, inside the same transaction).
--
-- Raises 'ORDER_NOT_CREDITABLE: <status>' when the order is not in a
-- creditable state (already credited / cancelled / never paid…), which the TS
-- wrapper catches and maps onto the idempotency ladder. Caller ends up with
-- exactly one of: codes [] | codes [...] | a not-creditable exception.
--
create or replace function public.claim_voucher_codes(
  p_order_id bigint,
  p_quantity int
)
returns text[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order      public.orders%rowtype;
  v_codes      text[];
  v_payload    text;
begin
  if p_order_id is null or p_quantity is null
     or p_quantity < 1 or p_quantity > 64 then
    raise exception 'Claim rejected: invalid order id or quantity';
  end if;

  -- Serialize concurrent fulfill attempts for the same order: whoever runs
  -- second now sees the FIRST caller's committed status, so a replay can
  -- never double-allocate codes for one paid order.
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status not in ('paid', 'processing', 'needs_manual_review') then
    raise exception 'ORDER_NOT_CREDITABLE: order #%' is in status %', p_order_id, v_order.status;
  end if;

  -- ---- atomic claim: lock untouched rows, flip them, read the codes --------
  with candidates as (
    select id
    from public.voucher_codes
    where product_id = v_order.product_id
      and status = 'available'
    order by id
    limit p_quantity
    for update skip locked
  ),
  claimed as (
    update public.voucher_codes vc
       set status             = 'claimed',
           claimed_by_order_id = p_order_id,
           claimed_at          = now()
      from candidates c
     where vc.id = c.id
       and vc.status = 'available' -- belt & braces vs. the CTE snapshot
    returning vc.id, vc.code
  )
  select coalesce(array_agg(code order by id), '{}')
    into v_codes
    from claimed;

  if coalesce(array_length(v_codes, 1), 0) < p_quantity then
    -- not enough pins: release what this call DID grab (partial claims must
    -- never strand stock) and tell the caller it needs humans.
    update public.voucher_codes
       set status = 'available', claimed_by_order_id = null, claimed_at = null
     where claimed_by_order_id = p_order_id
       and status = 'claimed'
       and code = any(v_codes);
    return '{}';
  end if;

  -- ---- full allocation: credit the order in the SAME transaction ----------
  v_payload := array_to_string(
    (select array_agg(lpad(idx::text, 2, ' ') || '. ' || c)
       from unnest(v_codes) with ordinality as t(c, idx)),
    chr(10)
  );

  update public.orders
     set status         = 'delivering',
         delivery_payload = v_payload,
         delivered_at   = now()
   where id = p_order_id
     -- re-check the state we locked (defensive; the row was locked above)
     and status in ('paid', 'processing', 'needs_manual_review');

  return v_codes;
end;
$$;

-- the RPC must be reachable ONLY by the trusted background client. PostgREST
-- exposes every public-schema function via /rest/v1/rpc/<name>, so revoke
-- broadly and grant narrowly.
revoke execute on function public.claim_voucher_codes(bigint, int) from public;
revoke execute on function public.claim_voucher_codes(bigint, int) from anon;
revoke execute on function public.claim_voucher_codes(bigint, int) from authenticated;
revoke execute on function public.claim_voucher_codes(bigint, int) from service_role;
grant execute  on function public.claim_voucher_codes(bigint, int) to service_role;

notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Self-check
--   * both tables exist
--   * the parking status exists on the enum
--   * the claim RPC is executable ONLY by service_role
-- -----------------------------------------------------------------------------
select
  to_regclass('public.voucher_codes')                 is not null as voucher_codes_ok,
  to_regclass('public.fulfillment_events')            is not null as fulfillment_events_ok,
  exists (
    select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'order_status'
       and e.enumlabel = 'needs_manual_review')        as parking_status_ok,
  not exists (
    select 1
      from information_schema.role_routine_grants
     where specific_name = 'claim_voucher_codes'
       and grantee in ('public', 'anon', 'authenticated')) as rpc_locked_down,
  exists (
    select 1
      from information_schema.role_routine_grants
     where specific_name = 'claim_voucher_codes'
       and grantee = 'service_role')                   as rpc_service_role_ok;

select 'migration 0022 OK' as status;
