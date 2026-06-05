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

## Universal ticket-entry + progress-bar + countdown rule (required for EVERY game)
**Why:** user-mandated design rule for all SKZ Bot skill games. REPLACED the older "in-canvas target line / endless leveling" model, which the user explicitly rejected — do NOT draw the goal as a moving line inside the canvas playfield, and do NOT do endless level-up/bonus-time loops.
**How to apply:** every game uses a single-round bet model with 4 phases: `select | playing | won | lost`.
- **Ticket select (entry):** show 5 priced tickets (rookie/bronze/silver/gold/diamond), each with `price`, `prize`, fixed `target` score, and `time`. Picking one deducts `price` from a localStorage SKZ balance (key like `skz_balance`, start 1000) up front. Disable tickets the player can't afford. Guard `playTicket` with a `startingRef` lock against double-tap double-deduction.
- **Win = reach the fixed `target` score before the countdown ends** → credit `prize` to balance, phase `won`. **Lose = crash OR timer hits zero** (entry already lost) → phase `lost`, distinguish "TIME UP" vs "YOU LOST". Make `finishGame` idempotent (`if (!g||!g.running) return`) and release the start lock there.
- **The target is a FIXED interactive PROGRESS BAR (an HTML/CSS line), NOT inside the canvas.** It fills from `score/target` and advances one step per correct hit. Drive its width from React `score` state with a CSS `transition-[width]` — NOT per-frame in rAF.
- Drive the countdown off the rAF delta (`dt`), not setInterval. Throttle HUD timer `setState` to whole-second changes via `lastSecRef`; update the timer bar imperatively via a ref (`timerBarRef.style.width`) — never setState at 60fps.
- Persist `balance` and `best` to localStorage; credit/deduct exactly once (guarded) and write through on every change.

## Dodge-game invulnerability grace (Orbit Dash and similar)
**Why:** code review flagged a "tap = brief invulnerability" landing grace as exploitable — rapid taps kept refreshing it for near-permanent invuln, breaking the win/economy. But removing grace entirely made blindly switching lanes/rings an instant death (game felt unfair / instant-loss on first tap).
**How to apply:** keep a short landing grace BUT pair it with a per-tap action cooldown that is strictly LONGER than the grace (e.g. grace 0.18s, cooldown 0.32s), and gate the action on the cooldown. That bounds max invulnerability well under 100% so spamming can't be exploited, while still letting a deliberate player slip through the obstacle they just moved onto. Also keep early-difficulty forgiving (few/slow obstacles) and make any mid-game obstacle spawns avoid the player's CURRENT position, not just the spawn-time start position.

## Admin controls must reach the mini-app runtime (rake example)
**Why:** code review failed the manager dashboard because the "platform rake / house cut" controls (global `settings.platformRake` + per-game `gameOverrides[gameId].rake`) only persisted to the store — the arena pool math hardcoded `fee * 0.85`, so the controls were no-ops in the actual game.
**How to apply:** when a manager control is meant to "affect the mini-app", trace the value all the way into the runtime path that consumes it, not just the store write. Non-React runtime code (e.g. `arena.ts addEntry`, a plain function) can't call `useAdmin()`; expose a non-reactive getter from `admin-store.ts` that reads the module-level `state` (e.g. `getPoolShare(gameId)`) and call that. Keep manager labels aligned with the real math.

## Canvas drawing gotcha
**Why:** `roundRect`/arcTo throws `IndexSizeError: radius is negative` when a block's width shrinks below ~0. Stacking games shrink the platform, so this WILL happen at runtime even when typecheck passes.
**How to apply:** in any rounded-rect helper, early-return on `w<=0 || h<=0` and clamp radius with `Math.max(0, Math.min(r, w/2, h/2))`.
