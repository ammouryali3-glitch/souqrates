---
name: SKZ Bot server-side admin auth
description: JWT HttpOnly cookie auth for /manager; DB-backed accounts with bcrypt passwords.
---

## Architecture

- **DB table**: `admin_accounts` (id, name, handle, role, password_hash, permissions[], active, created_at, updated_at)
- **Seeded accounts**: r1 @owner (owner), r2 @support_skz (support), r3 @finance_skz (accountant), r4 @mod_skz (moderator, inactive)
- **Auth endpoints** (all under `/api/admin`): `POST /login`, `GET /session`, `POST /logout`
- **Token**: JWT signed with `JWT_SECRET` env var, 8h expiry, stored in HttpOnly `skz_admin_token` cookie
- **Frontend**: `admin-auth.ts` — `fetchAdminSession()`, `loginAdmin()`, `logoutAdmin()`, `AdminSessionContext`
- **Manager.tsx**: calls `fetchAdminSession()` on mount → loading spinner → login screen or dashboard with `AdminSessionContext.Provider`

## Security properties

- Passwords stored as bcrypt hashes (12 rounds) — not plaintext
- JWT verified server-side on every `/api/admin/session` call
- Cookie is HttpOnly — JS cannot read it; forging `skz_admin_token=r1` → 401
- Inactive accounts rejected at login
- Owner-only gating: add/edit/delete/toggle in `system.tsx Roles` component gated on `session.role === "owner"` via `useAdminSession()`

**Why:** Previous sessionStorage approach allowed bypassing auth by setting `sessionStorage.skz_admin_session = 'r1'` — trivially guessable IDs. Moved to server-verified JWT cookies.

## Note on localStorage roles vs DB accounts

- `lib/admin-store.ts` localStorage roles exist but the `Roles` card in System section now fetches directly from DB via `/api/admin/accounts`
- DB `admin_accounts` is the single source of truth for both authentication and the System UI
- Session object from server is the source of truth for `hasPermission()` checks

## JWT_SECRET

- Must be set as a Replit Secret (not an env var in .replit — that leaks into version control)
- If you forget to set it, the API server will throw on startup ("JWT_SECRET env var must be set")

## Re-seeding

If admin accounts need to be reset, run SQL directly or update hashes via `executeSql`. bcryptjs is installed in `artifacts/api-server` and `scripts` (with `@workspace/db` dep).
