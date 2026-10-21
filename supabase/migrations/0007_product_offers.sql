-- =============================================================================
-- Migration 0007: Product templates (canonical items) + seller OFFERS
-- =============================================================================
-- Eldorado model: ONE canonical listing ("Blox Fruits — Legendary fruit kit")
-- that MULTIPLE sellers compete on with their own offers (price, stock,
-- delivery). Buyers pick an offer; checkout enters the existing order
-- lifecycle (pending_payment → verified → delivered → completed + LEDGER).
--
-- products.template_id links an offer to its canonical template.
-- Existing products keep template_id = NULL (standalone) — no data migration
-- needed. Idempotent, safe to re-run.
-- =============================================================================

create table if not exists public.product_templates (
  id          bigserial primary key,
  game_id     bigint not null references public.games (id),
  category_id bigint not null references public.product_categories (id),
  slug        text not null,
  title       text not null,
  description text not null default '',
  image_url   text,
  created_at  timestamptz not null default now(),
  unique (game_id, category_id, slug)
);

create index if not exists templates_browse_idx
  on public.product_templates (game_id, category_id);

alter table public.product_templates enable row level security;

-- everyone can SEE templates (they are the marketplace's canonical catalog)
drop policy if exists templates_public_read on public.product_templates;
create policy templates_public_read on public.product_templates
  for select using (true);

-- sellers/admins create templates when listing their first offer
drop policy if exists templates_seller_insert on public.product_templates;
create policy templates_seller_insert on public.product_templates
  for insert with check (public.current_role() in ('seller', 'admin'));

drop policy if exists templates_admin_write on public.product_templates;
create policy templates_admin_write on public.product_templates
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- ---------------------------------------------------------------------------
-- link offers to their canonical template
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists template_id bigint;

-- If 0001 already created the plain column (v2 does), add the missing FK here;
-- if 0007 runs first, the add-column above created it without a constraint too.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_template_fk'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_template_fk
      foreign key (template_id) references public.product_templates (id);
  end if;
end;
$$;

create index if not exists products_template_price_idx
  on public.products (template_id, price_usd asc);

create index if not exists products_template_speed_idx
  on public.products (template_id, estimated_minutes asc);

notify pgrst, 'reload schema';

select 'product_templates ready' as status,
       (select count(*) from public.product_templates) as template_count;
