## Goal

Delete the gift/milestone claim feature entirely and ship a real Murandasi Cashback Wallet wired to the live database: per-product cashback %, wallet balances, split payments (wallet + Mobile Money), credit on order completion, reversals, and full transaction history.

## Database changes

New/changed schema (one migration, with grants + RLS):

- `products.cashback_percent` — numeric, default 0, set per product by admin.
- `orders`: add `subtotal`, `wallet_applied`, `momo_amount`, `cashback_percent_snapshot`, `cashback_awarded`, `cashback_status` (`none | pending | credited | reversed`). Add `completed` to the allowed order statuses.
- `wallets` — one row per customer: `user_id` (unique), `balance`, timestamps. Users can read only their own; admins read all.
- `wallet_transactions` — `user_id`, `order_id`, `type` (`earned | used | reversed | adjustment`), `amount` (signed), `balance_after`, `note`, `created_at`. Users read own; admins read all. No client writes — all mutations go through security-definer functions.

Database functions (authoritative money logic, so balances can never drift):

- `apply_wallet_to_order(order_id, amount)` — locks the wallet row, validates balance, debits, writes a `used` transaction.
- `credit_order_cashback(order_id)` — runs when an order becomes `completed`; computes `momo_amount * cashback_percent / 100`, credits the wallet, writes `earned`, marks `cashback_status = credited`, inserts the 🎉 notification. Idempotent.
- `reverse_order_cashback(order_id, reason)` — deducts the awarded amount, writes `reversed`, marks the order, notifies the customer. Idempotent.
- Trigger on `orders`: status → `completed` credits cashback; status → `cancelled`/`refunded` reverses it (and never awards if it was never credited).
- Trigger on new profile/user: auto-create the wallet row; `get_or_create_wallet` fallback.

Cleanup: drop `reward_claims`, `reward_milestones`, the related triggers/functions, and remove the reward columns no longer used (`reward_cycle_start`, `gifts_claimed`).

## Cashback rule (enforced server-side)

Cashback is computed **only** on the Mobile Money portion of an order, using each line's product cashback percentage against the amount actually paid by MoMo. Wallet-paid amounts earn nothing, so cashback can never compound.

## Frontend work

**Product page** — cashback badge under the price: "Earn 5% Cashback — you'll receive FRW 5,000 in your Murandasi Cashback Wallet after your order is approved and completed." Amount recalculates from price × percent. Product cards get a small "5% cashback" chip.

**Checkout** — summary shows Order Total, Cashback Wallet Balance, and Cashback You'll Earn (recalculated live as wallet usage changes). Three payment options:
1. Mobile Money (full amount)
2. Cashback Wallet (only offered when the balance covers the total; order completes with 0 cashback earned)
3. Wallet + Mobile Money (wallet applied first, MoMo step and the USSD code request only the remainder)

The payment-proof step and the MTN USSD string use the remaining MoMo amount, never the full total. Wallet is debited at order submission; a confirmation line shows "FRW 8,000 deducted — remaining balance FRW 7,000."

**Account dashboard** — the "Rewards" tab becomes "Cashback Wallet": big balance card, pending (not-yet-credited) cashback, and the transaction history table (date, order number, earned / used / reversed, balance after, status). Realtime subscriptions extended to `wallets` and `wallet_transactions`; the milestone/claim UI is deleted.

**Admin dashboard** —
- Product form gains a Cashback % field.
- "Rewards" tab becomes "Cashback": customer list with wallet balances, per-customer transaction history, and manual actions to reverse cashback on an order or apply a corrective adjustment.
- Orders tab gains the `Completed` status option (which is what triggers crediting) plus `Cancelled`/`Refunded` for reversal, with the cashback state shown per order.
- WhatsApp purchase verification stays as-is.

**Notifications** — reuses the existing notifications table: cashback credited, cashback used at checkout, cashback reversed.

## Files touched

`src/lib/products.ts`, `src/lib/orders.ts`, `src/lib/payment-verification.ts`, new `src/lib/wallet.ts`, `src/routes/product.$id.tsx`, `src/components/ProductCard.tsx`, `src/routes/checkout.tsx`, `src/components/PaymentVerification.tsx`, `src/routes/account.tsx`, `src/routes/admin.tsx`, `src/components/admin/LoyaltyTab.tsx` → replaced by a cashback admin tab; `src/components/RewardsProgress.tsx` deleted.

## Verification

After building I'll drive the live app: place an order with a split payment, confirm the MoMo amount excludes the wallet portion, mark the order completed as admin, and confirm the credited amount, wallet balance, and transaction rows are correct in the database — then reverse it and confirm the balance returns.
