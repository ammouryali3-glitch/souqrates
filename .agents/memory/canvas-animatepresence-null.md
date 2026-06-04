---
name: Canvas ref null with AnimatePresence
description: canvasRef.current is null when startGame is called if the canvas element is conditionally rendered inside AnimatePresence mode="wait"
---

## The rule

Any canvas game that renders the canvas inside `AnimatePresence mode="wait"` must guard against `canvasRef.current` being null at the start of `startGame`. Always add this as the second check:

```tsx
const startGame = useCallback((t: Ticket) => {
  if (startingRef.current) return;
  if (!canvasRef.current) { rafRef.current = requestAnimationFrame(() => startGame(t)); return; }
  startingRef.current = true;
  // ... rest of init
}, [finishGame]);
```

## Why

`AnimatePresence mode="wait"` delays mounting the entering element until the exiting element's animation completes. When the user clicks a ticket button:
1. `setPhase("playing")` is called → React schedules a re-render
2. Any `useEffect([phase])` or button onClick fires `startGame(t)` before AnimatePresence has finished the exit animation
3. The canvas element is NOT yet in the DOM → `canvasRef.current === null` → crash

The RAF retry loop (polling each frame until `canvasRef.current` is truthy) is the correct fix. It costs at most a few frames and avoids any JSX restructuring.

## How to apply

- Add the `if (!canvasRef.current) { rafRef.current = requestAnimationFrame(() => startGame(t)); return; }` line at the top of every `startGame` in any canvas game that uses `AnimatePresence mode="wait"` around the playing phase.
- Do NOT set `startingRef.current = true` before this guard — the guard must return without locking so retries are allowed.
- This pattern is already applied to: calc-blast-game, num-smash-game, chain-sum-game, frac-sort-game, speed-math-game.
