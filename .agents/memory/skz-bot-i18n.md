---
name: SKZ Bot i18n and mock data removal
description: How language switching works and what mock data was removed; important for future feature work.
---

# i18n system

- `lib/i18n.ts` — lang state persisted in `localStorage("skz_lang")`, defaults to "ar"
- `useLang()` hook via `useSyncExternalStore`; `setLang(l)` updates `<html dir lang>` live
- `t.ar` / `t.en` string maps cover all user-facing pages (home, wallet, referrals, BottomNav)
- Language toggle button is in `BottomNav.tsx` — a small pill below nav tabs showing "EN" / "ع"
- Admin dashboard (`/manager`) is Arabic-only; i18n only applies to the user mini-app

# Mock data removed

**Why:** app is production-ready; fake data was seeding backend and showing wrong numbers to real users.

- `admin-store.ts` `freshSlices()`: entity lists (users, deposits, withdrawals, referrers, tokenPackages, inventory, socialTasks, promoCodes, broadcasts, tickets) are now empty arrays — server is source of truth
- Config blobs (finance, cms, security, backup, roles, apiKeys) still use seed defaults as safe starting point
- `seedApi()` function deleted entirely — no longer pushes fake data to backend on first load
- `arena.ts`: `getDefaultLeaders()` returns `[]`; `getBasePool/getBaseEntries` return `0`
- `home.tsx`: activity feed shows empty state; stats show `—` until real backend data flows
- `wallet.tsx`: transaction history shows empty state; balance from `useBalance()`
- `referrals.tsx`: earned/count start at 0; commission tiers come from admin `referralLevels` config

**How to apply:** when adding new user-facing features, always start from real data or empty state — never hardcode numbers or fake arrays.
