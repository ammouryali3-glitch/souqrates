---
name: SKZ Bot progression engine (XP / levels / leagues)
description: How the XP/level/league engagement layer works and the rules for surfacing level-ups reliably on the client.
---

# Progression engine

XP is the backbone of the engagement layer (battle pass, quests, leagues all read from it).
The level curve and league boundaries are defined ONCE on the server and exposed via
`GET /api/user/progression`; the client must never duplicate the math, only render the
snapshot plus cosmetic metadata.

**Server authority rule.** XP lives in `platform_users.data.xp` and is awarded *inside the
existing locked DB transactions* (game-result, checkin) alongside the balance mutation —
never in a separate write. The endpoint returns the full snapshot
(`xp, level, levelFloorXp, nextLevelXp, intoLevel, levelSpan, key, index, nextLeagueLevel, nextLeagueKey`).
The client league cosmetic list and its `LEAGUE_MIN_LEVELS` mirror must stay in lockstep
with the server league boundaries, or the leagues sheet shows wrong unlock levels.

# Client level-up surfacing — the two non-obvious traps

**Why:** the client balance-sync (`telegram-user.ts`) is debounced and retries, so XP lands
server-side at an unpredictable time after a game ends. Two bugs fall out of this:

1. **Don't refresh progression on a fixed timeout after leaving a game** — it races the
   debounced credit flush and fires before the XP exists. Instead subscribe to the
   server-confirmed credit event (`onCreditConfirmed` in telegram-user.ts, fired only when
   `/game-result` returns ok) and refresh off that. That is the authoritative "XP just landed"
   signal.

2. **`refreshProgression()` must be monotonic.** Concurrent fetches can return out of order; a
   stale (lower-level) response overwriting a newer one rolls back the persisted
   `skz_last_level` and re-triggers an already-celebrated level-up. Guard with a sequence
   counter and drop any response that isn't the latest issued request.

**How to apply:** level-up detection persists `skz_last_level` in localStorage and fires once
when the new level exceeds it (never on the first snapshot of a fresh install). Multiple levels
gained at once intentionally show ONE overlay for the final level reached — not a queue.
`LevelUpOverlay` is mounted globally in App.tsx (even in immersive game routes) so the
celebration can fire the instant the credit confirms, mid game-over screen.

# Polish layer (haptics + sound)

`lib/haptics.ts` (Telegram WebApp.HapticFeedback with navigator.vibrate fallback) and
`lib/sound.ts` (Web Audio synthesized SFX, no asset files, single lazy AudioContext, mute
persisted in `skz_sound_muted`). Sound mute toggle lives in BottomNav footer next to the lang
switch. Reuse these for every reward moment (wins, check-in, level-up, future wheel/loot boxes).
