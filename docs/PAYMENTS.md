# Cambodian Payment Integration Plan (do NOT skip ahead)

> Status: **PLAN ONLY.** Nothing in this repository processes real payments
> beyond the clearly-labeled manual pilot. No provider approval has been
> obtained. Do not launch until the checklist below is green, and never claim
> buyer protection beyond what your actual provider paperwork supports.

## 1. Providers to evaluate & questions to ask them

| Provider | Channel | Ask before signing |
|---|---|---|
| **ABA Bank (PayWay)** | KHQR, cards, ABA mobile | Does a marketplace that collects **on behalf of third-party sellers** require special merchant classification? Are digital-goods sales allowed? KYC docs needed? Webhooks + sandbox availability? Refund API? |
| **Bakong (NBC)** | KHQR via Bakong-compatible institutions | Available to registered companies? Marketplace/payout support? Transaction limits, fees, T+ settlement? |
| **ACLEDA / Wing / TrueMoney** | local wallets/gateways | Same questions as above. |
| **Stripe** (if you also serve intl. buyers) | cards | Cambodia availability is limited — verify first, don't assume. |

For every provider document (spec section §12):

1. merchant eligibility requirements for a Cambodian-registered business,
2. whether **marketplace settlements** (collect for others, then pay out) is
   even permitted on their standard account,
3. refund / chargeback rules & timelines,
4. per-transaction fee, monthly fee, cross-border fees,
5. technical: sandbox keys, signed webhooks, idempotency support.

**Rule:** a *personal* account, or a standard merchant account without
marketplace permission, cannot legally collect seller proceeds. If a provider
says "yes to one merchant, no to multi-party", keep funds in YOUR account only
for YOUR OWN sales and treat seller settlements as off-platform until fixed.

## 2. Payment architecture already built in the code

- `orders` rows are created **server-side** with money fields recomputed from
  the database (`src/app/actions/orders.ts`) — the browser never sets a price.
- `payment_attempts` + `payment_events` store provider refs and **raw webhook
  payloads** for reconciliation/audit.
- Status machine enforced in the DB (migration 0002):
  `pending_payment → pending_verification → paid → processing → delivering →
  completed`, plus `cancelled / refunded / disputed`.
- `complete_order()` / `refund_order()` write the **ledger** and flip balances
  — they double-run safely (idempotent) and log to `admin_audit_log`.

## 3. Manual pilot (current)

KHQR modal + "ORDER #id" remark → buyer presses "I have paid" (records a
**claim**, not a payment) → Telegram ping → admin checks the ABA/Bakong
statement and runs `confirm_payment(order_id, bank_reference)`.

**Limits:** no auto-reconciliation, human error possible, scales poorly past a
few orders/day, must be labeled "pending admin verification" in the UI (it is).

## 4. Go-live checklist

- [ ] Business registered (MoC), tax patent in hand; bank account in company name
- [ ] Provider account approved in writing for marketplace/digital-goods
- [ ] Webhook handler at `/api/webhooks/<provider>` deployed
- [ ] Webhook **signature verification** implemented before any handler logic runs
- [ ] `confirm_payment` replaced by: webhook → verify sig → match `provider_ref` + amount → confirm (idempotent)
- [ ] Reconciliation job: nightly compare provider statement vs `payment_attempts`
- [ ] Sandbox test: full buy→pay→deliver→complete cycle in test mode
- [ ] Secrets in server env only (`PAYWAY_API_KEY` etc.), never in `NEXT_PUBLIC_*`
- [ ] Receipts (order public_ref) emailed/visible, refund policy published
