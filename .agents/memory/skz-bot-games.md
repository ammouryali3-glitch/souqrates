---
name: SKZ Bot canvas games
description: Conventions for adding canvas-based skill games to the SKZ Bot mini-app
---

# SKZ Bot canvas games

Skill games (e.g. Stack & Match) live as full-screen pages under `/games/<name>` in the `skz-bot` artifact.

## Immersive routing
- Add the route OUTSIDE the `PageWrapper` in `App.tsx` and render it full-bleed (`flex-1`).
- The route must hide chrome: pass `hideHeader` to `MobileContainer` and conditionally drop `<BottomNav />` when on the game route. The game provides its own back button.

## rAF + Web Audio lifecycle (required)
**Why:** code review failed an early version for CPU/battery drain and leaked AudioContexts.
**How to apply:** any canvas game MUST
- stop its `requestAnimationFrame` loop once gameplay ends (keep it running only while playing OR while exit/debris animations are still settling, then let it stop), and
- create the `AudioContext` lazily on first user gesture (autoplay policy) and `close()` it on component unmount.

## Universal target-line + countdown rule (required for EVERY game)
**Why:** user-mandated design rule for all SKZ Bot skill games — gameplay must have urgency and a clear checkpoint goal.
**How to apply:** every game MUST have an interactive on-screen TARGET line/goal that the player must REACH before a countdown timer hits zero. Reaching it = clear the checkpoint, grant bonus time, raise the next target (level up). Running out of time = game over (distinguish "TIME UP" vs crash/"GAME OVER" in the end overlay).
- Drive the timer off the rAF delta (`dt`), not a setInterval. Throttle HUD timer `setState` to whole-second changes via a ref (`lastSecRef`) — never setState the timer at 60fps. A separate ratio state for the depleting bar is fine.
- Show: a countdown bar/number, current level + target, and a "TARGET CLEARED" flash on checkpoint.

## Canvas drawing gotcha
**Why:** `roundRect`/arcTo throws `IndexSizeError: radius is negative` when a block's width shrinks below ~0. Stacking games shrink the platform, so this WILL happen at runtime even when typecheck passes.
**How to apply:** in any rounded-rect helper, early-return on `w<=0 || h<=0` and clamp radius with `Math.max(0, Math.min(r, w/2, h/2))`.
