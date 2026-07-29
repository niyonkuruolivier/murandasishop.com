
# Customer Loyalty & Rewards System

A complete loyalty program tied to authenticated customer accounts, with admin-approved orders and WhatsApp purchases counting toward configurable reward milestones.

## 1. Authentication

- Enable email/password + Google sign-in via Lovable Cloud (auth already scaffolded at `/auth`).
- Add a `profiles` table auto-populated on signup (name, email, phone).
- Header shows "Sign In" or account menu (Dashboard, Sign out) driven by session.
- Checkout: if signed in, the order is linked to `user_id`; guest checkout still allowed but won't earn loyalty points.

## 2. Database (new tables)

- `profiles(user_id PK→auth.users, full_name, email, phone)` — auto-created via trigger.
- `orders` — add `user_id uuid null`, `approved_item_count int default 0`. Statuses: pending / approved / rejected. On approve, sum item quantities into `approved_item_count`.
- `whatsapp_purchases(id, user_id, product_name, order_number, purchase_date, amount, screenshot_url, notes, quantity default 1, status pending|approved|rejected, rejection_reason, created_at)`.
- `reward_milestones(id, level int unique, threshold int, name, description, image, estimated_value, badge_name, sort_order, active)` — admin-editable.
- `reward_claims(id, user_id, milestone_id, status locked|available|pending|claimed|rejected, unlocked_at, claimed_at, rejection_reason)`.
- `notifications(id, user_id, type, title, body, read, created_at)`.
- New storage bucket `whatsapp-proofs` (private, per-user RLS).
- Seed default milestones: 10/15/25/50/75/100 with Bronze→Elite badges.

### Aggregation

- SQL function `lifetime_approved(user_id)` returning total approved item count = sum of `orders.approved_item_count` (where user_id + status=approved) + count of approved WhatsApp purchases (× quantity).
- View `customer_stats` exposing counts, spend, current level, next milestone, remaining.

### RLS

- Customers read/write only their own rows.
- Admins (`has_role('admin')`) manage all.
- Milestones publicly readable to authenticated users.

## 3. Customer Dashboard `/account`

Route under `_authenticated/`. Tabs / sections:

- **Overview**: profile card, big progress bar (X/Y approved purchases), current badge, remaining count, total spent, total orders, level ladder.
- **Purchase History**: website orders + WhatsApp purchases merged, filterable by status.
- **Rewards**: cards for each milestone showing Locked / Available (with Claim button) / Pending / Claimed.
- **Submit WhatsApp Purchase**: form with screenshot upload to `whatsapp-proofs` bucket.
- **Notifications**: bell in header + list here.

Milestone unlock triggers an animated congratulations modal with confetti when a new available reward appears.

## 4. Admin Dashboard (extend `/admin`)

New tabs:

- **Customers**: list with search, lifetime purchases, level, unclaimed rewards. Click to see full profile.
- **Order Approvals**: pending orders → Approve / Reject (approve fills `approved_item_count`).
- **WhatsApp Verifications**: pending submissions with screenshot preview → Approve / Reject (+ reason).
- **Reward Claims**: pending claims → Approve (sets claimed_at) / Reject.
- **Milestones**: full CRUD (threshold, name, description, image upload, estimated value, badge).
- **Analytics**: totals (approved orders, rewards claimed, pending claims, WA requests, revenue), top customers, customers near next reward.

## 5. Automation

- Trigger on `orders` when status → approved: set `approved_item_count = sum(items[].qty)`, insert notification, upsert `reward_claims` rows with status=available for any milestone the new lifetime count crosses.
- Trigger on `whatsapp_purchases` approve: same flow.
- Trigger on `reward_claims` status change: insert customer notification.
- All customer views use Supabase Realtime (already used) or `queryClient.invalidateQueries` after mutations for near-live updates. Enable realtime on `orders` (already off for security) → instead enable on `reward_claims`, `whatsapp_purchases`, `notifications` scoped by RLS.

## 6. UX / Design

- Reuse existing color tokens (navy + orange accent). New components:
  - `LoyaltyProgress` (animated gradient bar).
  - `RewardCard` with lock/unlock states.
  - `BadgeChip` for Bronze→Elite.
  - `MilestoneCongratsModal` with confetti.
- Fully responsive; mobile shows sections as stacked cards, desktop uses 2-col grid.
- All AI/support chat and existing pages untouched.

## Technical notes

- Milestones evaluated by comparing `lifetime_approved` count to `reward_milestones.threshold`; claim rows lazily created on first read via server fn `ensureRewardClaims(user_id)`.
- Screenshot uploads via existing `src/lib/upload.ts` pattern into `whatsapp-proofs` bucket with `{user_id}/{uuid}.{ext}` path; RLS: owner read+write, admin read all.
- Notifications marked read on view; bell shows unread count.
- Uses `createServerFn` with `requireSupabaseAuth` for all mutating flows to keep RLS + validation server-side.
- No changes to existing WhatsApp direct-chat "Buy" buttons; a new "Submit WhatsApp purchase" flow lives inside the dashboard.

## Delivery order

1. Migration: profiles, milestones, whatsapp_purchases, reward_claims, notifications, orders columns, triggers, RLS, seed, storage bucket.
2. Auth wiring: profile trigger, header account menu, checkout user_id association.
3. Customer dashboard routes + components.
4. Admin dashboard new tabs.
5. Realtime subscriptions + notifications bell.
6. Polish: animations, congrats modal, empty states.

Please approve and I'll build it end-to-end.
