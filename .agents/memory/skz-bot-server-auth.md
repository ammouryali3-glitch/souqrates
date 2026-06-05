---
name: SKZ Bot server-side auth
description: JWT HttpOnly cookie auth — admin (/manager) and Telegram user sessions; DB-backed.
---

## Admin auth (skz_admin_token)

- **DB table**: `admin_accounts` (id, name, handle, role, password_hash, permissions[], active, created_at, updated_at)
- **Seeded accounts**: r1 @owner (owner), r2 @support_skz (support), r3 @finance_skz (accountant), r4 @mod_skz (moderator, inactive)
- **Auth endpoints** (all under `/api/admin`): `POST /login`, `GET /session`, `POST /logout`
- **Token**: JWT signed with `JWT_SECRET` env var, 8h expiry, HttpOnly `skz_admin_token` cookie
- **Frontend**: `admin-auth.ts` — `fetchAdminSession()`, `loginAdmin()`, `logoutAdmin()`, `AdminSessionContext`

## Telegram user auth (skz_user_token)

- **DB table**: `platform_users` — JSONB `data` blob, keyed by Telegram numeric ID (as string)
- **Endpoints**: POST /api/user/init, GET /api/user/me, POST /api/user/balance-event, POST /api/user/game-session, POST /api/user/game-result
- **Token**: JWT 30d expiry, HttpOnly `skz_user_token` cookie, same `JWT_SECRET`
- **Verification**: HMAC-SHA256 of initData using `TELEGRAM_BOT_TOKEN` env var; skips verify in dev if not set
- **Frontend module**: `artifacts/skz-bot/src/lib/telegram-user.ts`
  - `initTelegramUser()` — called from `initFromApi()` in admin-store on startup
  - `syncBalanceToServer(skz)` — debounced, called from every `writeBalance()` in admin-store
  - `startGameSession(gameId)` — called from App.tsx on every `/games/*` route entry; stores server-issued nonce
  - `useTelegramUser()` — hook exposing { loading, tgUser, dbUser, inTelegram, ready }

**Why:** Users had no real identity — balance was per-device localStorage only. Telegram WebApp initData is the natural identity source for Telegram Mini Apps.

## Credit/debit security model

- **Debits** (shop/arena) → `POST /api/user/balance-event { type: "debit", amount }` — `credit` type is rejected with 400.
- **Credits** (game earnings) → two-step nonce flow:
  1. `POST /api/user/game-session { gameId }` — server issues single-use hex nonce (48 chars), stored in in-memory Map with 15-min TTL.
  2. `POST /api/user/game-result { sessionId, amount }` — server validates nonce (exists, belongs to caller, not expired, not redeemed), marks redeemed before DB write, then applies credit atomically. Max credit per session: 2000 SKZ.
  - App.tsx pre-fetches a nonce on `/games/*` and `/arena/*` route entry via `setCurrentGameContext(contextId)` (optimization — reduces latency for first credit).
  - For repeated plays on the same route, or arena credits, `flushBalanceEvent` requests a fresh nonce inline (via `requestFreshNonce()`), guaranteeing every credit is eventually persisted.
  - Replay attacks → 409 "already redeemed".

## Shared notes

- `JWT_SECRET` must be a Replit Secret (not .replit env — that leaks into VCS)
- Any new user-facing endpoint needing identity: read `skz_user_token`, call `verifyUserToken`, look up tgId in platform_users
- Balance mutations use atomic SQL (`jsonb_set` in single UPDATE statement) to prevent lost-update races; explicit `::numeric` and `::bigint` casts required — Drizzle passes JS numbers as unknown type otherwise
- Client sync uses a serialized queue (one in-flight request at a time, delta computed from last confirmed balance) to prevent race-induced balance drift
