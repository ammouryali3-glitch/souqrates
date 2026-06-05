---
name: SKZ Bot game economy layer
description: How the admin manager's REAL control over game prices/prizes/score-to-win/time is wired end-to-end, and the gotchas that make controls cosmetic if missed.
---

# SKZ Bot economy layer

The manager (`/manager`) gives full REAL control over every game's economy. The single chokepoint is `src/lib/game-economy.ts`:

- `src/lib/tickets-data.ts` is the SINGLE SOURCE OF TRUTH for skill ticket baselines: `GAME_TICKETS` (keyed by gameId, all 31 skill games) + `getDefaultTickets(gameId)` + `BaseTicket` (id,name,price,prize,target,time, optional preKnives/targetSum). Each skill page sets `const RAW_TICKETS = GAME_TICKETS.<id>;`. The manager reads defaults from here so its editor and the game stay in lockstep — do NOT hardcode tier values in the manager.
- `useGameTickets<T>(gameId, RAW_TICKETS)` — applies the per-TICKET absolute override `ticketOverrides[gameId][tierId].{price,prize,target,time}` (admin edits the real number per tier, NOT a multiplier) FIRST, then the global levers `globalPriceFactor/globalPrizeFactor/globalDifficulty` + `freePlay` on top. Time is absolute (no global time scaling). Tickets must carry `id` for override matching. If a skill game does NOT call this with its matching id, its controls are silently cosmetic.
- `useArenaEconomy(gameId, baseFee)` — arena games (via `arena-shell.tsx`, the single shell for all 5) get `{ fee, prizeFactor, winnerCut }`. `fee` = absolute editable `entry` × `globalPriceFactor` (legacy per-game `priceFactor` is no longer applied — entry is edited directly); the "Winner Takes" display = `floor(pool * winnerCut * prizeFactor)`.
- Manager ticket edits commit LIVE to `admin.setTicketField/clearTicketField/resetGameTickets` (no Save). The "حفظ المعلومات" Save button only persists meta (title/tagline/desc/featured + arena entry/prize/prizeFactor). `resetGame` clears both gameOverrides AND ticketOverrides for that game.

**Why these matter (lessons from review):**
- A control in the manager UI is only real if it is consumed in `game-economy.ts` or `admin-store.ts`. Arena `priceFactor`/`prizeFactor` were initially exposed in the UI but ignored by `useArenaEconomy` → cosmetic. Always trace a new factor through to the chokepoint.
- Balance is a SEPARATE localStorage key (`skz_balance`) that games mutate directly. The admin store caches it in a module `balance` var. Any admin write that adds to balance (e.g. daily bonus) must re-read fresh via `readBalanceRaw()` first, or it overwrites newer game balances. `useBalance()` (useSyncExternalStore) re-renders consumers after `writeBalance` emits.
- Daily-bonus visibility on Home must rely on the date-based `canClaimDailyBonus()` (re-evaluated on re-render), NOT a sticky local `claimed` flag — otherwise it stays hidden after day rollover in a long session.
- New-player balance bootstrap and `resetAll()` both seed from `settings.startingBalance` (resetAll preserves the configured value rather than the hardcoded default).
- Number-input save handlers: `parseInt(x) || fallback` wrongly rejects a valid `0`. Use `trim()===""? default : Math.max(0, parseInt(x)||0)` so admins can set a 0 entry fee.

`featured` (GameOverride) is consumed in `games.tsx` by sorting featured games to the top of each section; `desc` override is also applied there.
