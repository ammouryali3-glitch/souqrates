---
name: API server security hardening
description: Patterns and decisions from the professional-grade security hardening pass on the api-server.
---

## User-ID based rate limiting

**Rule:** All authenticated endpoints key by `uid:<tgId>` extracted from the signed JWT cookie (`skz_user_token`). Falls back to IP for unauthenticated/tampered requests.

**Why:** IP-based limiting is trivially bypassed with a residential proxy botnet. User-ID keying means the attacker would need a valid signed JWT for each identity — not just a new IP.

**How to apply:** The `userOrIpKey` function lives in `app.ts`. Import `verifyUserToken` and `USER_COOKIE` from `lib/user-auth.ts` (NOT from `routes/user.ts`). cookieParser() must be registered before rate limiters in the middleware chain.

## JWT secret isolation

**Rule:** User tokens use `USER_JWT_SECRET` (falls back to `JWT_SECRET`). Admin tokens use `ADMIN_JWT_SECRET` (falls back to `JWT_SECRET`).

**Why:** A single shared secret means a leak compromises both user sessions and admin access simultaneously. Separate secrets limit blast radius.

**How to apply:** Set `USER_JWT_SECRET` and `ADMIN_JWT_SECRET` in the environment. The code falls back to `JWT_SECRET` for zero-downtime migration — no code change needed, just set the new vars.

## Shared user-auth lib

`lib/user-auth.ts` exports `USER_COOKIE`, `signUserToken`, `verifyUserToken`, `UserTokenPayload`. Both `routes/user.ts` and `app.ts` import from here to avoid circular deps and duplication.

## UUIDv7 for ledger IDs

**Rule:** `recordLedger()` uses `uuidv7()` instead of `randomBytes(8).toString("hex")`.

**Why:** 16-char hex has 64-bit randomness — non-zero collision probability at scale (~1 in 10^19 per insert, but not time-ordered). UUIDv7 has 48-bit timestamp + 74 random bits, is collision-resistant, and sorts chronologically.

**How to apply:** The `uuidv7()` function is self-contained in `lib/ledger.ts`. No external package needed.

## Structured admin audit log

**Rule:** Every admin state-change must call `logAdminAction(req, action, details)`.

**Why:** Compliance and incident response — need to know who changed what and when.

**How to apply:** `logAdminAction` is exported from `routes/admin-auth.ts`. Wired to: login, patch_user, adjust_balance, patch_deposit, patch_withdrawal. Add to new admin routes. Search logs with `{ adminAudit: {...} }` field.

## TON amount precision

**Rule:** `Math.round(skzAmount * 10000 / skzPerTon) / 10000` — integer multiply before divide.

**Why:** Avoids floating-point loss from early division of large numbers.
