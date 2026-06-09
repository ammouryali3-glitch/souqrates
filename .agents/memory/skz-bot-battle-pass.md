---
name: SKZ Bot battle pass patterns
description: DB access patterns and client gotchas for the battle pass feature.
---

## DB schema gotchas

**platformUsersTable columns:** only `id`, `data`, `updatedAt`. No `telegramId`, no `skzBalance`.
- User's tgId IS the primary key: `eq(platformUsersTable.id, payload.tgId)`
- Balance: `(data.balances as Record<string, unknown>)?.SKZ ?? 0`
- Update balance: `data: { ...data, balances: { ...balances, SKZ: newBalance } }`
- Always include `updatedAt: new Date()` in `.set()`

**Why:** The full user object is stored as JSONB in a single `data` column. There are no separate scalar columns for individual user fields.

**How to apply:** Any new route touching user balance or user state must read from and write to `data.balances.SKZ`, and filter with `platformUsersTable.id`.

## useLang() return type

`useLang()` returns `Lang` (= `"ar" | "en"`) directly — NOT an object.

```typescript
const lang = useLang();         // correct
const { lang } = useLang();     // WRONG — will typecheck-fail
```

## Battle pass data layout in platform_users.data

```json
{
  "battlePass": {
    "seasonId": "2026-06",
    "seasonStartXp": 5000,
    "premium": false,
    "claimedFree": [1, 2],
    "claimedPremium": []
  }
}
```

Season XP = max(0, totalXp - seasonStartXp). When seasonId differs from current, reconcileUserBP() resets and snapshots new startXp.

## Admin config key

Season config lives in admin_config key `"battle_pass"` (BattlePassSeason shape). Falls back to DEFAULT_SEASON from `lib/battle-pass.ts` if not set.

## LedgerReasons added

- `"battle_pass"` — credit for claiming a SKZ reward
- `"battle_pass_unlock"` — debit for purchasing the premium track
