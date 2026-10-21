# Build Roadmap — TopUpKH marketplace

Statuses: ✅ done · 🔨 partially built · ⬜ not started

## Stage 0 — foundations (✅ this session)
- Next.js 16 + TS + Tailwind v4 + Supabase
- `@supabase/ssr` cookie sessions: `src/lib/supabase/server.ts`, `client.ts`
- Auth/role guards: `src/lib/auth.ts`
- Full DB schema + RLS: `supabase/migrations/0001`, `0002`
- Types: `src/lib/types.ts`

## Stage 1 — responsive public UI (✅ core, 🔨 polish)
- Server-rendered homepage (`src/app/page.tsx`) with search, categories,
  featured/new products, trust section. NO fake stats — empty states say so.
- Marketplace (`src/app/marketplace/page.tsx`) — server-side search, game/category/price/delivery filters, 5 sorts, pagination, client filter panel.
- Product page (`src/app/product/[id]`) with full listing data incl. refund policy & authorization note.
- Old Robux top-up page preserved at `/topup`.

## Stage 2 — auth & roles (🔨)
- ✅ Profiles/roles schema + `requireUser`/`requireRole` server guards.
- ✅ Old `/login` kept (Supabase email auth client-side).
- ⬜ Add server-side session checks to existing legacy pages (`/sell`, `/login`, `/message`) or rewrite them onto the new schema.

## Stage 3 — listings & seller dashboard (🔨)
- ✅ Schema: sellers, applications, products, categories, games, experiences.
- ✅ `assert_product_eligible()` DB trigger: prohibited categories can NEVER be published.
- ✅ Seller incoming-orders page (`/seller/orders`) with delivery submission.
- ⬜ New listing creation form on the NEW schema (`products`) — current `/sell` still targets legacy `listings`.
- ⬜ Image uploads to `product-images` bucket.
- ⬜ Seller earnings/ledger view.

## Stage 4 — orders & secure delivery (✅ core)
- ✅ Server-action order creation with server-computed prices (`src/app/actions/orders.ts`).
- ✅ Checkout page `/checkout/[ref]` — status machine, KHQR pilot modal, confirm-receipt button.
- ✅ Buyer orders list `/orders`.
- ⬜ Private file delivery (`purchase-files` bucket + signed URLs).

## Stage 5 — messaging & support (⬜ UI, ✅ schema)
- ✅ `conversations`/`messages` + RLS + rate limit + credential-spam trigger.
- ✅ Support tickets/disputes/reports schema.
- ⬜ Chat UI (Supabase Realtime). `src/app/message` is legacy and needs rewrite.

## Stage 6 — payment provider integration (⬜ — plan only)
- ✅ Manual KHQR pilot (labeled as such).
- ⬜ Everything in `docs/PAYMENTS.md` — requires real merchant approvals first.

## Stage 7 — admin dashboard (🔨 legacy)
- ✅ All admin data + audit log in schema; secure RPCs (`confirm_payment`, `refund_order`, `complete_order`, commission setting).
- ⬜ Rewrite `src/app/admin/*` (currently on legacy tables) to new schema + role gating.
- ⬜ Seller approval UI, listing moderation queue, ledger viewer.

## Stage 8 — hardening & deploy
- ⬜ Antivirus/file-type validation on uploads, CSRF review, rate limits beyond messaging.
- ⬜ Crash monitoring, DB backups schedule.
- ⬜ Khmer copy review; optional KHR display toggle (`khr_rate_demo` setting exists).
