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
