-- =============================================================================
-- Migration 0025: In-game delivery details on orders (player_game_id, server_id)
-- =============================================================================
-- Adds the buyer-supplied delivery coordinates for top-up / in-game products:
--   player_game_id  text  — required for top-up products (where to deliver)
--   server_id       text  — optional server / zone / world id (some games)
--
-- Saving goes through a SECURITY DEFINER RPC (`save_player_game_details`)
-- because the orders RLS only lets staff UPDATE rows directly — the same
-- buyer-lifecycle pattern as 0002's submit_payment_claim / 0008 / 0010.
-- The RPC enforces:
--   * the caller IS the buyer (auth.uid() = buyer_id)
--   * the order is still BEFORE delivery work starts
--     (pending_payment / pending_verification / in_escrow — once the seller
--     is delivering, instructions are frozen; disputes / support handle the rest)
--   * non-empty, length-capped values — the seller must be able to deliver
--
-- Idempotent; safe to re-run.
-- =============================================================================

do $$
begin
  if to_regclass('public.orders') is null then
    raise exception 'PREREQUISITE MISSING: public.orders does not exist. Run 0001_marketplace_schema.sql first.';
  end if;
end;
$$;

alter table public.orders
  add column if not exists player_game_id text;
alter table public.orders
  add column if not exists server_id text;

create or replace function public.save_player_game_details(
  p_order_id     bigint,
  p_game_user_id text,
  p_server_id    text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  order_row public.orders%rowtype;
begin
  select * into order_row from public.orders where id = p_order_id for update;

  if not found or order_row.buyer_id <> auth.uid() then
    raise exception 'Order not found';
  end if;

  -- frozen once real work starts; after that it's a delivery support matter
  if order_row.status not in ('pending_payment', 'pending_verification', 'in_escrow') then
    raise exception 'Delivery details can no longer be changed at order status %',
      order_row.status;
  end if;

  if p_game_user_id is null or char_length(btrim(p_game_user_id)) not between 2 and 120 then
    raise exception 'Game User ID / Player ID is required (2-120 characters).';
  end if;

  if p_server_id is not null and char_length(btrim(p_server_id)) > 80 then
    raise exception 'Server / Zone ID must be at most 80 characters.';
  end if;

  update public.orders
     set player_game_id = btrim(p_game_user_id),
         server_id      = case
                            when p_server_id is null or btrim(p_server_id) = '' then null
                            else btrim(p_server_id)
                          end
   where id = p_order_id;
end;
$$;

revoke execute on function public.save_player_game_details(bigint, text, text) from anon;
grant execute on function public.save_player_game_details(bigint, text, text) to authenticated;

notify pgrst, 'reload schema';

select 'migration 0025 OK' as status,
       (select count(*) from public.orders limit 1) >= 0 as orders_table_reachable;
