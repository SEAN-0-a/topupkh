-- =============================================================================
-- 0026 — Chat read receipts + realtime order-status stream
--
-- 1) mark_thread_read(p_conversation_id): SECURITY DEFINER RPC the dashboard
--    chat calls when a conversation is opened / when a live message lands in
--    the open thread. messages has NO client UPDATE policy (participants can
--    only insert + select), so the read flags can only be written through
--    this server-checked function: the caller must BE the buyer or the
--    seller of the conversation, and each participant flips ONLY their own
--    read column, ONLY for messages sent by the other side. Idempotent.
--
-- 2) Adds public.orders (and public.messages defensively) to the
--    supabase_realtime publication so the chat dashboard can subscribe to
--    order status UPDATEs and refresh the receipt / status banner instantly
--    (useMessages holds the orders-realtime subscription). Realtime already
--    enforces the orders_read / conversations_read RLS policies per
--    subscriber, so other users' order updates are never delivered.
-- =============================================================================

create or replace function public.mark_thread_read(p_conversation_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid;
begin
  v_user := auth.uid();

  if v_user is null then
    raise exception 'Not signed in';
  end if;

  if not exists (
    select 1 from public.conversations
    where id = p_conversation_id
      and (buyer_id = v_user or seller_user_id = v_user)
  ) then
    raise exception 'Not a member of this conversation';
  end if;

  -- The buyer flips read_by_buyer; the seller flips read_by_seller. Each
  -- statement is scoped to the caller's own role in THIS conversation, so a
  -- seller can never mark the buyer's messages as read for them (and
  -- vice-versa). sender_id <> v_user: you never "read" your own bubbles.
  update public.messages
     set read_by_buyer = true
   where conversation_id = p_conversation_id
     and sender_id <> v_user
     and not read_by_buyer
     and exists (
       select 1 from public.conversations c
        where c.id = p_conversation_id and c.buyer_id = v_user
     );

  update public.messages
     set read_by_seller = true
   where conversation_id = p_conversation_id
     and sender_id <> v_user
     and not read_by_seller
     and exists (
       select 1 from public.conversations c
        where c.id = p_conversation_id and c.seller_user_id = v_user
     );
end;
$$;

-- Least-privilege: only signed-in users may call it (anon gets nothing).
revoke all on function public.mark_thread_read(bigint) from public, anon;
grant execute on function public.mark_thread_read(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime publication: order status UPDATEs stream to participants, so the
-- chat's receipt card + status banner refresh without a page reload.
-- (messages defensively too — duplicate_object means it is already there.)
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null; -- already in the publication
end $$;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null; -- already in the publication
end $$;
