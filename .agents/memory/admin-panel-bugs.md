---
name: Admin Panel Audit Findings
description: Bugs found and fixed during the comprehensive admin panel audit — what to watch for in future additions.
---

## Rules to apply for every new admin action

### Server ALLOWED_USER_PATCH_FIELDS
`artifacts/api-server/src/routes/admin-entities.ts` — only these fields can be
patched on a platform user via `PATCH /admin/users/:id`:
  `status`, `restrictions`, `note`, `tags`, `displayName`, `tier`, `flagged`

**Never** add `balances` to this list. Use `POST /admin/users/:id/adjust-balance`
for balance changes — it is atomic and writes a ledger entry.

**Why:** Financial fields must only mutate through the dedicated endpoint so that
every balance change is permanently auditable in `balance_transactions`.

### VALID_CONFIG_KEYS in admin-state.ts
Every key passed to `putAdminConfig(key, value)` in admin-store.ts **must** be
present in `VALID_CONFIG_KEYS` in `admin-state.ts`, otherwise the PUT request
returns HTTP 400 and the save is silently swallowed by `warnOnFailure`.

Current keys (as of this audit): settings, game_overrides, ticket_overrides, cms,
finance, security, backup, referral_config, daily_checkin, api_keys, roles,
deposit_config, withdrawal_config, contact_info, policies.

Also add the corresponding entry in `KEY_PERMISSION` so non-owner admins with the
right permission can write it too.

**Why:** This was the root cause of contact info and policies never persisting.

### approveAllAutoWithdrawals pattern
When an action mutates state and then needs to fire API calls for the changed items,
**capture the target IDs before calling update()**, not after.

```ts
// correct
const ids = state.items.filter(pred).map(i => i.id);
update(s => ...);
ids.forEach(id => apiCall(id, ...));

// wrong — update() mutates state; reading after may match more items than intended
update(s => ...);
state.items.filter(pred).forEach(i => apiCall(i.id, ...));
```

### Referrers CRUD
Server has GET/POST/PATCH/DELETE for referrers (affiliate permission).
Client has `apiUpsertReferrer`, `apiPatchReferrer`, `apiDeleteReferrer`.
Store has `addReferrer`, `updateReferrer`, `deleteReferrer`.
