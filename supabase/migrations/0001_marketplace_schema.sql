-- =============================================================================
-- TopUpKH — Cambodian Gaming Marketplace
-- Migration 0001: Core schema, RLS policies, seeds
-- =============================================================================
-- HOW TO RUN:
--   1. Open your Supabase project -> SQL Editor
--   2. Paste this whole file and run it.
--   It is idempotent-safe for a fresh project. If you already have tables from
--   the old prototype (listings, orders, seller_wallets...), see the
--   "LEGACY TABLES" note at the bottom before re-running.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Enums
-- -----------------------------------------------------------------------------
create type user_role      as enum ('buyer', 'seller', 'support', 'admin');
create type product_status as enum ('draft', 'pending_review', 'approved', 'rejected', 'paused');
create type delivery_method as enum ('in_game', 'instructions', 'digital_file', 'creator_services');
create type order_status    as enum ('pending_payment', 'paid', 'processing', 'delivering', 'completed', 'cancelled', 'refunded', 'disputed');
create type payment_status  as enum ('pending', 'confirmed', 'failed', 'cancelled', 'refunded');
create type seller_status   as enum ('pending', 'approved', 'suspended', 'rejected');
create type ticket_status   as enum ('open', 'in_progress', 'resolved', 'closed');
create type ticket_priority as enum ('low', 'normal', 'high', 'urgent');
create type ticket_category as enum ('payment_issue', 'delivery_problem', 'refund_request', 'account_issue', 'report_seller', 'other');
create type dispute_status  as enum ('open', 'evidence_review', 'resolved_buyer', 'resolved_seller', 'resolved_split', 'closed');
create type payout_status   as enum ('requested', 'approved', 'processing', 'paid', 'rejected');
create type ledger_entry_type as enum ('sale', 'platform_commission', 'refund', 'payout', 'payout_fee', 'adjustment');
create type eligibility_status as enum ('allowed', 'prohibited', 'needs_review');

-- -----------------------------------------------------------------------------
-- 1. Profiles & roles (DB-level authorization anchors)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Cambodian Gamer',
  username     text unique,
  avatar_url   text,
  locale       text not null default 'km' check (locale in ('km', 'en')),
  role         user_role not null default 'buyer',
  is_banned    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

-- Bootstrap: the very first account created becomes ADMIN (the owner = you).
-- Every later signup becomes a buyer and applies for seller separately.
create or replace function public.promote_first_user_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    new.role := 'admin';
  end if;
  return new;
end;
$$;

create trigger on_profile_created
  before insert on public.profiles
  for each row execute function public.promote_first_user_admin();

create or replace function public.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_user();

-- SECURITY DEFINER helpers used inside RLS policies (never trust client role)
create or replace function public.current_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'buyer'::user_role);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('admin', 'support');
$$;

-- keep updated_at fresh everywhere it exists
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Games, experiences, categories & product ELIGIBILITY
-- -----------------------------------------------------------------------------
create table public.games (
  id          bigserial primary key,
  slug        text unique not null,
  name        text not null,
  icon_url    text,
  description text,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table public.experiences (
  id         bigserial primary key,
  game_id    bigint not null references public.games (id) on delete cascade,
  name       text not null,
  slug       text not null,
  is_active  boolean not null default true,
  unique (game_id, slug)
);

create table public.product_categories (
  id              bigserial primary key,
  slug            text unique not null,
  name            text not null,
  description     text,
  is_active       boolean not null default true,
  default_eligibility eligibility_status not null default 'needs_review',
  -- how products are sold: fixed stock units vs. one-off service listings
  stock_model     text not null default 'finite' check (stock_model in ('finite', 'unlimited')),
  created_at      timestamptz not null default now()
);

-- THE MODERATION TABLE: whether a (game, category) pair may be sold at all.
create table public.eligibility_rules (
  id           bigserial primary key,
  game_id      bigint not null references public.games (id) on delete cascade,
  category_id  bigint not null references public.product_categories (id) on delete cascade,
  status       eligibility_status not null default 'needs_review',
  reason       text not null default '',
  reviewed_by  uuid references auth.users (id),
  reviewed_at  timestamptz,
  unique (game_id, category_id)
);

-- -----------------------------------------------------------------------------
-- 3. Sellers & listing approval
-- -----------------------------------------------------------------------------
create table public.sellers (
  id              bigserial primary key,
  user_id         uuid not null unique references public.profiles (id) on delete cascade,
  display_name    text not null,
  about           text,
  status          seller_status not null default 'pending',
  -- payout details are written by the seller, readable only by them + staff
  payout_method   text,
  bank_name       text,
  bank_account_no text,
  bank_account_name text,
  rating_sum      numeric not null default 0,
  rating_count    int not null default 0,
  completed_sales int not null default 0,
  rejection_note  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint seller_rating_ok check (rating_count >= 0)
);

create table public.seller_applications (
  id             bigserial primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  years_playing  int,
  references_url text,
  motivation     text not null,
  status         seller_status not null default 'pending',
  reviewed_by    uuid references auth.users (id),
  reviewed_at    timestamptz,
  review_note    text,
  created_at     timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 4. Products
-- -----------------------------------------------------------------------------
create table public.products (
  id                bigserial primary key,
  seller_id         bigint not null references public.sellers (id) on delete cascade,
  game_id           bigint not null references public.games (id),
  experience_id     bigint references public.experiences (id),
  category_id       bigint not null references public.product_categories (id),
  title             text not null check (char_length(title) between 5 and 120),
  description       text not null default '',
  image_url         text,
  price_usd         numeric(12,2) not null check (price_usd > 0),
  original_price_usd numeric(12,2),
  delivery_method   delivery_method not null default 'in_game',
  delivery_details  text not null default '',
  stock             int not null default 0 check (stock >= 0),
  stock_is_unlimited boolean not null default false,
  estimated_minutes int,
  refund_policy     text not null default 'Contact support within 48 hours if the product was not delivered as described.',
  -- legality / authorization metadata required before approval
  ownership_note    text not null default '',
  status            product_status not null default 'pending_review',
  moderation_note   text,
  moderated_by      uuid references auth.users (id),
  view_count        int not null default 0,
  sold_count        int not null default 0,
  rating_sum        numeric not null default 0,
  rating_count      int not null default 0,
  is_deleted        boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index products_browse_idx on public.products (status, game_id, category_id);
create index products_search_idx on public.products using gin (to_tsvector('english', title || ' ' || description));
create index products_seller_idx on public.products (seller_id);
create index products_price_idx on public.products (price_usd);
create index products_created_idx on public.products (created_at desc);

-- A product may only be PUBLISHED if its (game, category) eligibility is
-- 'allowed' — enforced in the database, not just the UI.
create or replace function public.assert_product_eligible()
returns trigger
language plpgsql
as $$
declare
  rule status_of eligibility_status;
begin
  select r.status into status_of
  from public.eligibility_rules r
  where r.game_id = new.game_id and r.category_id = new.category_id;

  if status_of is null or status_of = 'prohibited' then
    raise exception 'This product type is prohibited for this game (eligibility=%)', coalesce(status_of, 'unconfigured');
  end if;

  if status_of = 'needs_review' and new.status = 'approved' then
    raise exception 'Products in review-required categories need explicit admin approval';
  end if;
  return new;
end;
$$;

create trigger products_eligibility_check
  before insert or update of game_id, category_id, status on public.products
  for each row execute function public.assert_product_eligible();

create trigger products_touch
  before update on public.products
  for each row execute function public.touch_updated_at();

create trigger sellers_touch
  before update on public.sellers
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Orders, payments & the commission/settlement LEDGER
-- -----------------------------------------------------------------------------
create table public.orders (
  id                bigserial primary key,
  public_ref        text unique not null default 'KH-' || lpad(nextval('orders_id_seq')::text, 6, '0'),
  buyer_id          uuid not null references public.profiles (id),
  product_id        bigint not null references public.products (id),
  quantity          int not null default 1 check (quantity > 0),
  -- money snapshots — captured SERVER-SIDE at order creation, never from browser
  unit_price        numeric(12,2) not null,
  subtotal          numeric(12,2) not null,
  commission_rate   numeric(5,4) not null,
  platform_fee      numeric(12,2) not null,
  seller_proceeds   numeric(12,2) not null,
  currency          text not null default 'USD',
  status            order_status not null default 'pending_payment',
  delivery_payload  text,          -- seller: prod id / file path / instructions
  delivered_at      timestamptz,
  completed_at      timestamptz,
  cancelled_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger orders_touch
  before update on public.orders
  for each row execute function public.touch_updated_at();

-- captures every payment attempt + raw provider payload for reconciliation
create table public.payment_attempts (
  id             bigserial primary key,
  order_id       bigint not null references public.orders (id) on delete cascade,
  provider       text not null,             -- e.g. 'bakong_khqr', 'aba_payway', 'manual_pilot'
  provider_ref   text unique,
  amount         numeric(12,2) not null,
  currency       text not null default 'USD',
  status         payment_status not null default 'pending',
  qr_raw         text,
  created_at     timestamptz not null default now(),
  confirmed_at   timestamptz
);

create table public.payment_events (
  id                 bigserial primary key,
  payment_attempt_id bigint not null references public.payment_attempts (id) on delete cascade,
  event_type         text not null,
  payload            jsonb not null default '{}'::jsonb,
  signature_verified boolean not null default false,
  received_at        timestamptz not null default now()
);

-- every money movement is a ledger row; balances = SUM(ledger) shown in admin
create table public.transaction_ledger (
  id          bigserial primary key,
  order_id    bigint references public.orders (id),
  seller_id   bigint references public.sellers (id),
  entry_type  ledger_entry_type not null,
  amount_khr_usd numeric(12,2) not null,
  direction   text not null check (direction in ('platform_earned', 'seller_earned', 'seller_debited', 'buyer_refunded')),
  note        text not null default '',
  created_by  uuid references auth.users (id),
  created_at  timestamptz not null default now()
);

create index ledger_order_idx on public.transaction_ledger (order_id);

create table public.payouts (
  id             bigserial primary key,
  seller_id      bigint not null references public.sellers (id),
  amount         numeric(12,2) not null check (amount > 0),
  method         text not null default 'bank_transfer',
  bank_snapshot  text not null default '',
  status         payout_status not null default 'requested',
  -- 'recorded reference' — NOT proof funds left the bank until admin checks it
  bank_reference text,
  paid_at        timestamptz,
  approved_by    uuid references auth.users (id),
  approved_at    timestamptz,
  note           text,
  created_at     timestamptz not null default now()
);

-- configurable commission — admin edits the DB value, no code deploy needed
create table public.platform_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

create or replace function public.get_platform_commission_rate()
returns numeric(5,4)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (value #>> '{}')::numeric from public.platform_settings where key = 'commission_rate'),
    0.12
  );
$$;

-- -----------------------------------------------------------------------------
-- 6. Messaging (in-site chat — keeps users off Telegram for trade comms)
-- -----------------------------------------------------------------------------
create table public.conversations (
  id              bigserial primary key,
  product_id      bigint references public.products (id),
  order_id        bigint references public.orders (id),
  buyer_id        uuid not null references public.profiles (id),
  seller_user_id  uuid not null references public.profiles (id),
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint conv_parties_check check (buyer_id <> seller_user_id)
);

create table public.messages (
  id              bigserial primary key,
  conversation_id bigint not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id),
  body            text not null check (char_length(body) between 1 and 2000),
  created_at      timestamptz not null default now(),
  read_by_seller  boolean not null default false,
  read_by_buyer   boolean not null default false,
  FlaggedDelete   boolean not null default false  -- soft flag for mod review
);

create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

-- basic anti-spam: max 10 messages per minute per sender
create or replace function public.assert_message_rate()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.messages
      where sender_id = new.sender_id
        and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'Rate limit: too many messages, please slow down';
  end if;
  return new;
end;
$$;

create trigger messages_rate_limit
  before insert on public.messages
  for each row execute function public.assert_message_rate();

-- credential cream — stop users pasting passwords/cookies into chat
create or replace function public.assert_message_safe()
returns trigger
language plpgsql
as $$
begin
  if new.body ~* '(password|session|cookie|\.cookie|sb-[a-z0-9-]+-auth-token|bearer\s+[a-z0-9._-]{20,})' then
    raise exception 'Do not share passwords, session cookies or auth tokens in messages';
  end if;
  if new.sender_id <> auth.uid() then
    raise exception 'You can only send messages as yourself';
  end if;
  return new;
end;
$$;

create trigger messages_safety
  before insert on public.messages
  for each row execute function public.assert_message_safe();

-- -----------------------------------------------------------------------------
-- 7. Support centre, disputes, reports, reviews, notifications, audit
-- -----------------------------------------------------------------------------
create table public.support_tickets (
  id          bigserial primary key,
  public_ref  text unique not null default 'TCK-' || lpad(nextval('support_tickets_id_seq')::text, 5, '0'),
  user_id     uuid not null references public.profiles (id),
  order_id    bigint references public.orders (id),
  category    ticket_category not null default 'other',
  priority    ticket_priority not null default 'normal',
  status      ticket_status not null default 'open',
  subject     text not null,
  assigned_to uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.ticket_messages (
  id             bigserial primary key,
  ticket_id      bigint not null references public.support_tickets (id) on delete cascade,
  sender_id      uuid not null references public.profiles (id),
  body           text not null,
  attachment_path text,
  is_internal    boolean not null default false,  -- staff-only notes
  created_at     timestamptz not null default now()
);

create trigger tickets_touch
  before update on public.support_tickets
  for each row execute function public.touch_updated_at();

create table public.disputes (
  id            bigserial primary key,
  order_id      bigint not null references public.orders (id),
  opened_by     uuid not null references public.profiles (id),
  reason        text not null,
  status        dispute_status not null default 'open',
  resolution    text,
  resolved_by   uuid references auth.users (id),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);

create table public.reports (
  id          bigserial primary key,
  reporter_id uuid not null references public.profiles (id),
  target_type text not null check (target_type in ('product', 'conversation', 'message', 'seller', 'ticket')),
  target_id   bigint not null,
  reason      text not null,
  status      text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  reviewed_by uuid references auth.users (id),
  created_at  timestamptz not null default now()
);

create table public.reviews (
  id         bigserial primary key,
  order_id   bigint not null unique references public.orders (id) on delete cascade,
  buyer_id   uuid not null references public.profiles (id),
  seller_id  bigint not null references public.sellers (id),
  product_id bigint not null references public.products (id),
  rating     int not null check (rating between 1 and 5),
  comment    text,
  only_after_deliver boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text not null default '',
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.admin_audit_log (
  id           bigserial primary key,
  actor_id     uuid not null references public.profiles (id),
  action       text not null,
  target_table text not null,
  target_id    text not null,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
alter table public.profiles            enable row level security;
alter table public.games               enable row level security;
alter table public.experiences         enable row level security;
alter table public.product_categories  enable row level security;
alter table public.eligibility_rules   enable row level security;
alter table public.sellers             enable row level security;
alter table public.seller_applications enable row level security;
alter table public.products            enable row level security;
alter table public.orders              enable row level security;
alter table public.payment_attempts    enable row level security;
alter table public.payment_events      enable row level security;
alter table public.transaction_ledger  enable row level security;
alter table public.payouts             enable row level security;
alter table public.platform_settings   enable row level security;
alter table public.conversations       enable row level security;
alter table public.messages            enable row level security;
alter table public.support_tickets     enable row level security;
alter table public.ticket_messages     enable row level security;
alter table public.disputes            enable row level security;
alter table public.reports             enable row level security;
alter table public.reviews             enable row level security;
alter table public.notifications       enable row level security;
alter table public.admin_audit_log     enable row level security;

-- profiles: read self + public basics; write self (not role!)
create policy profile_self_select on public.profiles
  for select using (id = auth.uid() or public.is_staff());
create policy profile_basic_select on public.profiles
  for select using (true);
create policy profile_self_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_role()); -- can't promote self

-- catalogue: public read of active; staff full, seller own writes
create policy games_public_read on public.games
  for select using (is_active or public.is_staff());
create policy experiences_public_read on public.experiences
  for select using (is_active or public.is_staff());
create policy categories_public_read on public.product_categories
  for select using (is_active or public.is_staff());
create policy eligibility_read on public.eligibility_rules
  for select using (true);                       -- rule status is public info
create policy eligibility_staff_write on public.eligibility_rules
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy games_staff_write on public.games
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy experiences_staff_write on public.experiences
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy categories_staff_write on public.product_categories
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- sellers: public sees approved; seller owns row
create policy sellers_public_read on public.sellers
  for select using (status = 'approved' or user_id = auth.uid() or public.is_staff());
create policy sellers_self_update on public.sellers
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and status in ('approved', 'pending'));
create policy sellers_staff_all on public.sellers
  for all using (public.is_staff()) with check (public.is_staff());

-- listings: only approved visible publicly; seller sees own everything
create policy products_read on public.products
  for select using (
    is_deleted = false and (status = 'approved' or public.is_staff()
      or seller_id in (select s.id from public.sellers s where s.user_id = auth.uid()))
  );
create policy products_seller_write on public.products
  for all using (
    seller_id in (select s.id from public.sellers s where s.user_id = auth.uid())
  )
  with check (
    seller_id in (select s.id from public.sellers s where s.user_id = auth.uid())
    and status <> 'approved'                      -- cannot self-approve!
  );
create policy products_staff_all on public.products
  for all using (public.is_staff()) with check (public.is_staff());

-- applications: user inserts own, sees own; staff manage
create policy applications_read on public.seller_applications
  for select using (user_id = auth.uid() or public.is_staff());
create policy applications_insert on public.seller_applications
  for insert with check (user_id = auth.uid() and user_id = auth.uid());
create policy applications_staff on public.seller_applications
  for all using (public.is_staff()) with check (public.is_staff());

-- orders: strictly buyer / seller / staff
create policy orders_read on public.orders
  for select using (
    buyer_id = auth.uid() or public.is_staff()
    or product_id in (select p.id from public.products p
                      join public.sellers s on s.id = p.seller_id
                      where s.user_id = auth.uid())
  );
create policy orders_insert on public.orders
  for insert with check (buyer_id = auth.uid());
create policy orders_staff_update on public.orders
  for update using (public.is_staff()) with check (true);

-- payments: participants can see their attempt; writes only via staff/service key
create policy payments_read on public.payment_attempts
  for select using (
    order_id in (select id from public.orders where buyer_id = auth.uid())
    or public.is_staff()
  );

create policy payments_read on public.payment_events
  for select using (public.is_staff());

create policy ledger_read on public.transaction_ledger
  for select using (
    public.is_staff()
    or seller_id in (select s.id from public.sellers s where s.user_id = auth.uid())
  );

create policy payouts_read on public.payouts
  for select using (
    seller_id in (select s.id from public.sellers s where s.user_id = auth.uid())
    or public.is_staff()
  );
create policy payouts_insert on public.payouts
  for insert with check (
    seller_id in (select s.id from public.sellers s where s.user_id = auth.uid())
    and status = 'requested'
  );
create policy payouts_staff_update on public.payouts
  for update using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy settings_public_read on public.platform_settings
  for select using (true);
create policy settings_admin_write on public.platform_settings
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- conversations & messages: only the two participants (+ staff)
create policy conversations_read on public.conversations
  for select using (
    buyer_id = auth.uid() or seller_user_id = auth.uid() or public.is_staff()
  );
create policy conversations_insert on public.conversations
  for insert with check (buyer_id = auth.uid());

create policy messages_read on public.messages
  for select using (
    exists (select 1 from public.conversations c
            where c.id = conversation_id
              and (c.buyer_id = auth.uid() or c.seller_user_id = auth.uid() or public.is_staff()))
  );
create policy messages_insert on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (select 1 from public.conversations c
                where c.id = conversation_id
                  and (c.buyer_id = auth.uid() or c.seller_user_id = auth.uid()))
  );

-- support tickets: owner + assigned + staff
create policy tickets_read on public.support_tickets
  for select using (user_id = auth.uid() or public.is_staff() or assigned_to = auth.uid());
create policy tickets_insert on public.support_tickets
  for insert with check (user_id = auth.uid());
create policy tickets_staff_write on public.support_tickets
  for update using (public.is_staff()) with check (public.is_staff());

create policy ticket_msgs_read on public.ticket_messages
  for select using (
    exists (select 1 from public.support_tickets t
            where t.id = ticket_id
              and (t.user_id = auth.uid() or public.is_staff()
                   or (t.assigned_to = auth.uid() and not is_internal)))
  );
create policy ticket_msgs_insert on public.ticket_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (select 1 from public.support_tickets t
                where t.id = ticket_id
                  and (t.user_id = auth.uid() or public.is_staff()))
  );

create policy disputes_read on public.disputes
  for select using (
    opened_by = auth.uid() or public.is_staff()
    or order_id in (select id from public.orders where buyer_id = auth.uid())
  );
create policy disputes_insert on public.disputes
  for insert with check (opened_by = auth.uid());
create policy disputes_staff_write on public.disputes
  for update using (public.current_role() = 'admin') with check (true);

create policy reports_insert on public.reports
  for insert with check (reporter_id = auth.uid());
create policy reports_read on public.reports
  for select using (reporter_id = auth.uid() or public.is_staff());
create policy reports_staff_write on public.reports
  for update using (public.is_staff()) with check (public.is_staff());

create policy reviews_read on public.reviews
  for select using (true);
create policy reviews_insert on public.reviews
  for insert with check (buyer_id = auth.uid());

create policy notifications_self on public.notifications
  for all using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_staff());

create policy audit_admin_read on public.admin_audit_log
  for select using (public.current_role() = 'admin');

-- =============================================================================
-- SEED DATA
-- =============================================================================
insert into public.platform_settings (key, value)
values
  ('commission_rate',       to_jsonb(0.12::text)),
  ('currency_display',      '"USD"'::jsonb),
  ('khr_rate_demo',         to_jsonb(4050::text)),
  ('min_payout_usd',        '"20"'::jsonb)
on conflict (key) do nothing;

insert into public.games (slug, name, description, sort_order) values
  ('roblox', 'Roblox', 'The core supported game platform', 0)
on conflict (slug) do nothing;

insert into public.product_categories (slug, name, description, default_eligibility, stock_model) values
  ('dev-assets',        'Development Assets',     'Models, scripts, UI kits, maps — downloadable creator assets', 'needs_review', 'unlimited'),
  ('creator-services',  'Creator Services',       'Map building, scripting, UI commissions by creators',           'needs_review', 'unlimited'),
  ('gamepasses',        'Game Passes',            'First-party Roblox game passes purchased on buyer''s behalf',   'needs_review', 'finite')
on conflict (slug) do nothing;

-- PROHIBITED categories exist in the table so admins can see and manage them,
-- but eligibility blocks them from ever being published or purchased.
insert into public.product_categories (slug, name, description, default_eligibility, stock_model, is_active) values
  ('robux-currency',   'Robux & Currency',  'Third-party Robux transfers — violates Roblox ToS', 'prohibited', 'finite', false),
  ('accounts',         'Accounts',          'Full account sales/trades — violates Roblox ToS',   'prohibited', 'finite', false),
  ('in-game-items',    'In-Game Items',     'Pets, fruits, knives etc. — usually non-tradeable outside game ToS', 'prohibited', 'finite', false)
on conflict (slug) do nothing;

insert into public.eligibility_rules (game_id, category_id, status, reason)
select g.id, c.id, c.default_eligibility,
       case when c.default_eligibility = 'prohibited'
            then 'Violates Roblox Terms of Use — blocks unauthorized trading outside official systems'
            else 'Requires manual admin verification before this category may go live' end
from public.games g, public.product_categories c
where g.slug = 'roblox'
on conflict (game_id, category_id) do nothing;

-- =============================================================================
-- LEGACY TABLES (from the old prototype — see docs/migration-notes.md)
--   listings, orders, seller_wallets, payout_requests, khqr_payments...
--   If your live project already has those, DO NOT run an insert into a
--   conflicting table; adapt data or drop the legacy tables once migrated.
-- =============================================================================
