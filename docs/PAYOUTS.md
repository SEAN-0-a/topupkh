# How the platform earns money & how sellers get paid (Cambodia)

## Commission (already configurable, no code deploys)

`platform_settings.commission_rate` — seeded at **0.12 (12%)**, a test value in
your spec's 10–15% range. Change it in the database (admin dashboard when the
UI lands in stage 7). Every order **snapshots** the rate it was sold at, so old
orders keep their own math when you change the setting.

Per order the DB stores: subtotal, commission_rate, platform_fee,
seller_proceeds (+ payment provider fees later). Refunds post *negative-style*
ledger entries so balances always re-derive from the ledger.

## The settlement ledger = the source of truth

`transaction_ledger` rows (migration 0002) are only written by secure DB
functions (`complete_order`, `refund_order`, `refund_order`-style entries) or
by admins. A seller's **recorded balance** is:

```
balance = SUM(seller_earned entries) - SUM(seller_debited entries)
```

Admin dashboard (stage 7) will show this per seller. **Never** show this
balance as "money I am holding for you" unless your provider contract
genuinely supports separated marketplace funds — otherwise present it as
"platform-recorded balance (see docs)".

## Payouts — sequence to turn on (do NOT skip steps)

1. **Provider check:** does ABA/Bakong support *you sending money to other
   people's bank accounts* at scale, and under what compliance? Bakong
   transfers are possible for individuals/companies but have limits & KYC
   requirements — confirm in writing.
2. In `platform_settings`, keep `min_payout_usd = 20` until launch economics
   are known.
3. Payout flow is **implemented** (migration 0010): verified seller requests
   (`request_payout()` debits `available_balance` atomically) → request row in
   `payout_requests` → admin reviews at /admin/payouts → admin executes the
   transfer in ABA/Bakong manually → "Mark Paid" (`review_payout()` stores the
   bank reference in `review_note`) → ledger gets a `payout` entry. Rejecting
   a request automatically refunds the held amount to the seller balance.
4. Only after step 1 is answered and a test payout has landed in a real bank
   account, consider automations (ABA PayWay payout endpoints, etc.).

## What NOT to claim (legal honesty)

- No "escrow service" wording unless the arrangement legally is one.
- No "funds are protected" wording beyond what your provider contract grants.
- Bank details are stored on the seller's own `profiles` row (migration 0010);
  they are only readable by the seller and admins via SECURITY DEFINER choke
  points (`get_my_seller_profile` / `admin_list_kyc_applications`) — column
  privileges make them unselectable through plain PostgREST, never to other sellers.
- Never display API keys, or another seller's payout data.

## Revenue experiments for later (stage 8+)

- Featured listing slots (`products.status`-adjacent promotion flags)
- Fixed platform transaction fee in addition to % commission
- First-party (your own) eligible product sales: keep YOUR seller row separate
  from the commission logic (zero-commission rule row) so accounting stays
  clean.
