---
name: SKZ Bot admin gating
description: Why admin toggles (game/section disable, maintenance, ban) must be enforced at the route level, not just by hiding cards.
---

# SKZ Bot admin/manager gating

The manager panel (`/manager`) controls everything via a localStorage pub/sub store
(`src/lib/admin-store.ts`, `useSyncExternalStore`). Game/section/maintenance/ban toggles
must be enforced where routing happens, not only where lists render.

**Rule:** hiding a card in `/games` is cosmetic only — every game still has a static
route, so a disabled game is reachable by direct URL. Enforce at the route in `App.tsx`:
a `GameGate` redirects to `/games` when the game override is disabled or its section
(`arenaEnabled`/`skillEnabled`) is off; `maintenance` and `banned` are full-screen gates
that short-circuit the Router before the Switch (manager route stays accessible so you can
toggle back).

**Why:** a code review caught that the first pass only filtered cards, leaving disable/
section/maintenance toggles bypassable via URL — they looked functional but weren't.

**How to apply:** game routes are generated from `ALL_GAMES` + a `GAME_COMPONENTS` id→component
map (not 36 hand-written `<Route>`s). Keep the listing filter and the route gate reading the
same admin state so they never drift.
