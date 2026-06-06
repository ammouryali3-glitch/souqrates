---
name: SKZ Bot Phase 2 financial layer
description: Ledger (balance_transactions), daily check-in (daily_checkins), referral reward on signup; patterns for every balance mutation.
---

## Schema additions (lib/db/src/schema/admin-entities.ts)
- `balance_transactions` — ledger: id, user_id, type (credit|debit), reason, currency (default SKZ), amount (positive), balance_before, balance_after, ref (nullable), meta (jsonb nullable), created_at.
- `daily_checkins` — id, user_id, date (YYYY-MM-DD UTC), streak, reward, created_at. Unique (user_id, date).

## Ledger helper
`artifacts/api-server/src/lib/ledger.ts` → `recordLedger(tx, entry)` — always call inside the same DB transaction that mutates balance; tx typed as `any` to avoid circular import with drizzle's generic transaction type.

## Mutation points wired (all 8)
game-result (game_win credit), submit-score (game_fee debit), withdraw (withdrawal debit), shop/buy (purchase debit), balance-event (game_fee debit — now SELECT FOR UPDATE), prize-awards (prize credit), ton-poller (deposit credit), admin-entities withdrawal rejection (refund credit).

## Daily check-in
- `GET /api/user/checkin/status` → `{ checkedInToday, streak, nextReward }`
- `POST /api/user/checkin` → `{ ok, reward, streak, newSkz }`
- Reward schedule in admin_config key `daily_checkin` → `.rewards[]`; fallback `[50,75,100,150,200,300,500]`; cycles after day 7.
- Frontend: `fetchCheckinStatus()` + `claimCheckin()` in user-api.ts; card in home.tsx calls `admin.setBalance(result.newSkz)` after a successful claim.

## Referral
- Parsed from `start_param` in initData on first login; L1 commission from `admin_config` key `referral_config` → `.levels[0].commission` (default 10 SKZ); upserts `referrers` table; all non-fatal (catches its own errors).

## Indexes
`ensureIndexes()` in seed.ts creates functional indexes on deposits/withdrawals `(data->>'userId')` + status columns; called at server startup.

**Why:** Balance correctness requires an audit trail (ledger) and optimistic-lock pattern (SELECT FOR UPDATE) for every credit/debit; missed any one point = ghost balance.
**How to apply:** Any new route that touches a user's balance must: (1) open a DB transaction, (2) SELECT FOR UPDATE on users row, (3) compute new balance, (4) UPDATE users, (5) call recordLedger inside the same tx.
