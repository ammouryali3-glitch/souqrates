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

**Known payment-integrity gaps (flagged, not yet fixed):** deposit credit in `ton-poller.ts`
is not exactly-once under concurrency (duplicate-check outside tx + always-credit can double-credit);
withdrawal reject/refund reads status outside the lock (double-refund risk); withdraw submit has
no client idempotency key (retry → duplicate debit). Fix by inserting the unique-key row first and
crediting only on successful insert (RETURNING), all in one transaction with a status-transition guard.
