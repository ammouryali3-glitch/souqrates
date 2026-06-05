---
name: SKZ Bot game economy layer
description: How the admin manager's REAL control over game prices/prizes/score-to-win/time is wired end-to-end, and the gotchas that make controls cosmetic if missed.
---

# SKZ Bot economy layer

The manager (`/manager`) gives full REAL control over every game's economy. The single chokepoint is `src/lib/game-economy.ts`:

- `useGameTickets<T>(gameId, RAW_TICKETS)` — every skill game renames its tier table to `RAW_TICKETS` and pipes it through this. Applies per-game `priceFactor/prizeFactor/targetFactor/timeFactor` × the global `globalPriceFactor/globalPrizeFactor/globalDifficulty` + `freePlay`. If a skill game does NOT call this with its matching id, its controls are silently cosmetic.
- `useArenaEconomy(gameId, baseFee)` — arena games (via `arena-shell.tsx`, the single shell for all 5) get `{ fee, prizeFactor, winnerCut }`. `fee` applies per-game+global price factors and freePlay; the "Winner Takes" display = `floor(pool * winnerCut * prizeFactor)`.

**Why these matter (lessons from review):**
- A control in the manager UI is only real if it is consumed in `game-economy.ts` or `admin-store.ts`. Arena `priceFactor`/`prizeFactor` were initially exposed in the UI but ignored by `useArenaEconomy` → cosmetic. Always trace a new factor through to the chokepoint.
- Balance is a SEPARATE localStorage key (`skz_balance`) that games mutate directly. The admin store caches it in a module `balance` var. Any admin write that adds to balance (e.g. daily bonus) must re-read fresh via `readBalanceRaw()` first, or it overwrites newer game balances. `useBalance()` (useSyncExternalStore) re-renders consumers after `writeBalance` emits.
- Daily-bonus visibility on Home must rely on the date-based `canClaimDailyBonus()` (re-evaluated on re-render), NOT a sticky local `claimed` flag — otherwise it stays hidden after day rollover in a long session.
- New-player balance bootstrap and `resetAll()` both seed from `settings.startingBalance` (resetAll preserves the configured value rather than the hardcoded default).
- Number-input save handlers: `parseInt(x) || fallback` wrongly rejects a valid `0`. Use `trim()===""? default : Math.max(0, parseInt(x)||0)` so admins can set a 0 entry fee.

`featured` (GameOverride) is consumed in `games.tsx` by sorting featured games to the top of each section; `desc` override is also applied there.
