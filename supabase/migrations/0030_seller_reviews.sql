-- =============================================================================
-- 0030_seller_reviews.sql — Buyer→seller star ratings & short reviews
-- =============================================================================
-- `seller_reviews` is the canonical buyer→seller feedback table:
--   · exactly ONE review per (buyer, seller) pair — unique index
--   · only buyers with a COMPLETED order at that seller may insert (DB guard,
--     not just UI) — the same "blocked at the database level" philosophy as
--     the eligibility/stock guards in earlier migrations
--   · a trigger keeps sellers.rating_sum / rating_count in lock-step so every
--     consumer (homepage Top Sellers cards, /seller/[id] store header, product
--     offers) shows the LIVE average with no extra query
-- =============================================================================

create table if not exists public.seller_reviews (
  id          bigserial primary key,
  seller_id   bigint not null references public.sellers (id) on delete cascade,
  buyer_id    uuid not null references public.profiles (id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);

create index if not exists seller_reviews_seller_idx
  on public.seller_reviews (seller_id, created_at desc);

-- One review per buyer per seller, ever — re-rating is rejected client-side
-- and here, so the aggregate can never be inflated by repeat submissions.
create unique index if not exists seller_reviews_pair_uidx
  on public.seller_reviews (seller_id, buyer_id);

-- -----------------------------------------------------------------------------
-- Guard: author must be the signed-in buyer AND hold a completed order at
-- this seller. SECURITY DEFINER so the orders/products read never depends on
-- the caller's RLS grants.
-- -----------------------------------------------------------------------------
create or replace function public.assert_seller_review_allowed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.buyer_id is distinct from auth.uid() then
    raise exception 'You can only submit a review as yourself';
  end if;

  if not exists (
    select 1
    from public.orders o
    join public.products p on p.id = o.product_id
    where o.buyer_id = new.buyer_id
      and p.seller_id = new.seller_id
      and o.status = 'completed'
  ) then
    raise exception 'Only buyers with a completed order can review this seller';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_seller_reviews_guard on public.seller_reviews;
create trigger trg_seller_reviews_guard
  before insert on public.seller_reviews
  for each row execute function public.assert_seller_review_allowed();

-- -----------------------------------------------------------------------------
-- Live aggregates: sellers.rating_sum / rating_count mirror this table after
-- every insert, so seller cards and store headers never drift from the truth.
-- -----------------------------------------------------------------------------
create or replace function public.sync_seller_rating_aggregate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seller bigint := coalesce(new.seller_id, old.seller_id);
begin
  update public.sellers s
     set rating_sum   = coalesce(
           (select sum(r.rating) from public.seller_reviews r where r.seller_id = v_seller), 0),
         rating_count = (select count(*)
           from public.seller_reviews r where r.seller_id = v_seller),
         updated_at   = now()
   where s.id = v_seller;
  return null;
end;
$$;

drop trigger if exists trg_seller_reviews_aggregate on public.seller_reviews;
create trigger trg_seller_reviews_aggregate
  after insert on public.seller_reviews
  for each row execute function public.sync_seller_rating_aggregate();

-- -----------------------------------------------------------------------------
-- RLS: everyone reads (public averages); only the author inserts. No UPDATE /
-- DELETE policy — a posted review is immutable.
-- -----------------------------------------------------------------------------
alter table public.seller_reviews enable row level security;

drop policy if exists seller_reviews_read on public.seller_reviews;
create policy seller_reviews_read on public.seller_reviews
  for select using (true);

drop policy if exists seller_reviews_insert on public.seller_reviews;
create policy seller_reviews_insert on public.seller_reviews
  for insert with check (buyer_id = auth.uid());
