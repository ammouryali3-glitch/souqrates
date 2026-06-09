---
name: SKZ Bot lucky wheel + loot boxes
description: Implementation pattern for the lucky wheel and loot box feature (T004).
---

## Key constraint: shared prize table
`WHEEL_PRIZES` array must be **identical** (same entries, same order) in:
- `artifacts/api-server/src/lib/wheel.ts`
- `artifacts/skz-bot/src/lib/wheel.ts`

The client uses `prizeIndex` (returned from POST /wheel/spin) to calculate which SVG segment to animate to. If the arrays diverge, the wheel lands on the wrong segment visually.

**Why:** Server picks the winner (crypto RNG), returns `prizeIndex`, client animates `rotation += 360*5 + prizeIndex * 45 + 22.5`.

## Data stored in platform_users.data
```json
{
  "wheel": { "lastSpinAt": "ISO string", "extraSpins": 0 },
  "lootBoxes": 0
}
```

## Spin cooldown
`FREE_SPIN_COOLDOWN_MS = 24h`. Extra spins (won from wheel) consumed before checking free spin eligibility.

## Ledger reasons added
`spin` (credit, SKZ prize from wheel) and `lootbox` (credit, SKZ from box opening). Added to `LedgerReason` union in `artifacts/api-server/src/lib/ledger.ts`.

## Loot box table
Excludes `skz_5000` and `extra_spin` — boxes are more balanced, no jackpot.

## Endpoints
- `GET /api/user/wheel/status` — canSpin, nextSpinAt, extraSpins, lootBoxes
- `POST /api/user/wheel/spin` — server draw, returns prizeId + prizeIndex
- `POST /api/user/wheel/open-box` — draws 3 prizes, decrements lootBoxes

## Home page entry
`WheelEntry` component in `home.tsx` shows "FREE" pulse badge when canSpin; reads from `useWheelStatus()` store which is refreshed on home mount alongside quests.
