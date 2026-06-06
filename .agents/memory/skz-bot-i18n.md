---
name: SKZ Bot i18n system
description: How bilingual AR/EN works across lib/i18n.ts, game files, and UI components.
---

# i18n system

- `lib/i18n.ts` — lang state persisted in `localStorage("skz_lang")`, defaults to "ar"
- `useLang()` hook via `useSyncExternalStore`; `setLang(l)` updates `<html dir lang>` live
- `t.ar` / `t.en` string maps cover all user-facing pages (home, wallet, referrals, BottomNav, games, arena, contact, policies)
- Language toggle button is in `BottomNav.tsx` — a small pill below nav tabs showing "EN" / "ع"
- Admin dashboard (`/manager`) is Arabic-only; i18n only applies to the user mini-app

# Game files pattern

All game files use:
```ts
import { getLang, t as gt } from "@/lib/i18n";
// In JSX:
{gt[getLang()].someKey}
```

**Why `gt` alias, not `t`?** Every game uses `.map((t) => ...)` where `t` = ticket. Using `gt` avoids shadowing.

**Why `getLang()` (non-reactive)?** Game screens mount fresh on each phase change, so `getLang()` always returns the current lang at mount time. No need for a hook.

## String naming conventions in i18n.ts

- `gameScore`, `gameBest(n)`, `gameYouWin`, `gameYouLost`, `gameTimeUp`, `gamePlayAgain`
- `gameGoalTime(target, time)`, `gameEntryLost(n)`, `gameKnifeClash`, `gameYouHit`
- `gameLives(n)`, `gameFree`, `gameTarget`, `gameSeconds(s)`, `gameWinReward(n)`
- `arenaBackToGames` — used in all result overlays for the exit link

## Files migrated (all 30 game files have the import)

- **Pattern-1 compact games (19):** bubblepop, calc-blast, cardflip, chain-sum, colorrain,
  echotap, frac-sort, gridpop, match3, mergeblitz, neonlink, numblitz, num-smash,
  orbitaim, pulsetap, quicksum, speed-math, stackdrop, swiperush
  → strings: `gameEntryLost`, `gamePlayAgain`
- **Classic games:** stack, orbit, knife, slice — full result overlay (Score, Best, YouWin, YouLost, TimeUp, PlayAgain, BackToArena, GoalTime)
- **Other Pattern-2:** piano, whack, color-switch, bubble, jumper, breakout, shooter
  → strings: `gameBest`, `gamePlayAgain`, `arenaBackToGames`
- **Skipped** (no useGameTickets, prototype games): bridge, dune, submarine, zigzag

# Mock data removed

- `admin-store.ts` `freshSlices()`: entity lists are empty arrays — server is source of truth
- Config blobs still use seed defaults as safe starting point
- `seedApi()` function deleted entirely
- `arena.ts`: `getDefaultLeaders()` returns `[]`; base pool/entries return `0`

**How to apply:** when adding new user-facing features, always start from real data or empty state.
New game files: add `import { getLang, t as gt }` and use `gt[getLang()].xxx` inline.
