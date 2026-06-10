---
name: Telegram Magic Link browser auth
description: Passwordless browser login via Telegram bot deep link — flow, table, exemptions.
---

## Flow
1. Browser `POST /api/user/browser-auth/request` → `{ token (48-hex), botLink (t.me deep link), expiresAt (5 min TTL) }`
2. User taps deep link → opens Telegram bot → `/start login_<token>` command
3. Bot marks token **claimed** with `tgId`, `tgName`, `tgUsername` in `browser_auth_tokens` table
4. Browser polls `GET /api/user/browser-auth/poll?token=xxx` every 2 s → `{ status: "claimed" }`
5. Browser `POST /api/user/browser-auth/claim` → upserts platform user, sets `skz_user_token` HttpOnly cookie → done

## DB table
`browser_auth_tokens` — columns: id (PK, 48-hex), tg_id, tg_name, tg_username, status (pending/claimed/used), expires_at (5 min), created_at. Index on (status, expires_at).

## Key files
- Route: `artifacts/api-server/src/routes/browser-auth.ts` — 3 endpoints
- Bot handler: `handleBrowserLogin()` in `artifacts/api-server/src/routes/bot.ts` — catches `/start login_` BEFORE `/start`
- Mounted at: `router.use("/user/browser-auth", browserAuthRouter)` in `routes/index.ts`
- UI: `artifacts/skz-bot/src/pages/login.tsx` — idle → waiting (deep link + countdown + dots) → expired → done states
- Schema: `browserAuthTokensTable` in `lib/db/src/schema/admin-entities.ts`

## Maintenance exemption
User middleware in `user.ts` exempts `req.path.startsWith("/browser-auth")` alongside `/init` — login works during maintenance.

**Why:** browser users (non-Telegram) must be able to authenticate even when the main app is in maintenance mode. Blocking /browser-auth would soft-lock the login page.

## Bot routing rule
`/start login_<token>` check must come BEFORE the plain `/start` check in `processUpdate`. The prefix `login_` is 6 chars so `text.slice("/start login_".length)` extracts the exact 48-char hex token.

## getBotUsername cache
`browser-auth.ts` has its own lazy `_botUsername` cache via Telegram `getMe`. The one in `notifications.ts` reads from admin_config — these are separate; do not merge.
