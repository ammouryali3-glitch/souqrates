---
name: Testing Telegram-auth payment endpoints
description: How to E2E test SKZ-bot user/payment APIs that require signed Telegram initData
---

# Testing Telegram-auth + payment endpoints (SKZ Bot)

User endpoints (`/api/user/*`) require a JWT cookie obtained from `POST /api/user/init`,
which only accepts **HMAC-signed Telegram initData** when `TELEGRAM_BOT_TOKEN` is set.
Browser preview always 401s on user endpoints because it has no real Telegram session —
that is expected, not a bug.

**How to apply:** To test these endpoints, generate signed initData in a script that reads
`process.env.TELEGRAM_BOT_TOKEN` (never print the value): secretKey =
HMAC-SHA256("WebAppData", BOT_TOKEN); hash = HMAC-SHA256(secretKey, sorted `k=v\n` data-check
string excluding `hash`). `auth_date` must be within 300s. Hit services through `localhost:80`
(shared proxy), not service ports. A reusable script lives at `.local/payment-test.mjs`.

**Gotcha:** `POST /api/user/withdraw` is rate-limited to **3 requests / 15 min / IP**
(express-rate-limit, in-memory store). Budget test requests accordingly and **restart the
API Server workflow to reset the limiter** before a fresh run. The withdraw endpoint debits
balance immediately, so each successful call consumes real balance on the test user.

**Splash screen** (`SplashScreen.tsx`) is purely time-based (~2.2s), independent of API/auth —
screenshots taken mid-animation just caught it loading; it always completes.

**Payment-integrity fixes applied:**
- `ton-poller.ts creditDeposit`: deposit INSERT now happens first inside the tx; `onConflictDoNothing().returning()` → if returned array is empty, skip credit. User row locked with FOR UPDATE for accurate ledger values.
- `admin-entities.ts PATCH /withdrawals/:id`: withdrawal row is now fetched inside the tx with FOR UPDATE, so concurrent rejects both see the already-updated status and only one triggers the refund.
- `user.ts POST /withdraw`: accepts optional `idempotencyKey` in body; if supplied, checks withdrawals table inside the tx before debiting — returns original result on replay without a second debit.
