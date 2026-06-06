---
name: Admin owner-account bootstrap
description: Why the deployed /manager login can fail and how owner accounts are bootstrapped across dev/prod databases.
---

# Admin owner-account bootstrap

The `admin_accounts` table is NOT populated by config seeding (`seedDatabaseIfEmpty`
only seeds `admin_config`). A fresh database therefore has no admin login, and the
`/manager` page renders fine but every login returns 401.

**Dev and production use separate databases.** Inserting an admin row in dev (via
`executeSql` or SQL) does nothing for the published app — production `executeSql` is
read-only, so you cannot insert there directly. The supported fix is an idempotent
startup function (`ensureOwnerAccount` in `seed.ts`, wired in `index.ts`) that creates
a default owner only when no `role='owner'` row exists. Production gets the account on
the next republish.

**Why:** the user repeatedly reported "/manager login doesn't work" because the account
existed only in the dev DB while they tested the deployed app.

**How to apply:**
- Any new "ensure a row exists on startup" bootstrap must normalize written values to
  match the read path. The login route normalizes handles as
  `handle.trim().toLowerCase().replace(/^@+/, "")` then queries `@${normalised}` — so a
  bootstrapped/created handle MUST be stored lowercase with a single leading `@`, or
  login silently 401s even with the right password.
- Default bootstrap creds: `@admin` / `Souqrates@2025`, overridable via
  `BOOTSTRAP_OWNER_HANDLE` / `BOOTSTRAP_OWNER_PASSWORD`.
- bcryptjs is NOT importable in the code_execution sandbox (ERR_MODULE_NOT_FOUND); hash
  via `node -e` in bash from inside `artifacts/api-server` instead.
