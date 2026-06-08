---
name: SKZ Bot daily/weekly quests
description: How the missions (quest) system is structured and the exploit-safety rule that gates reward progress.
---

# Quests (missions)

Daily quests rotate deterministically by UTC epoch-day (a fixed pool, N shown per day); weekly quests are fixed and keyed by ISO-week. Period buckets live in `platform_users.data.quests`; a normalize step resets buckets when the day/week key changes, so rollover is lazy (on next read/write), not scheduled.

Metrics tracked: `games_played`, `skz_earned`, `checkin`. Progress is advanced inside the same locked txn that mutates balance (game-result, checkin) via `bumpQuests`; claiming credits SKZ through `recordLedger` reason `"bonus"` under a `FOR UPDATE` lock with in-txn re-validation (double-claim → 409, incomplete → 400, unknown → 400).

## Reward-progress must be gated on a real credited play

Only advance reward-bearing progression (quests XP/level/`games_played`/`skz_earned`) when `effectiveAmount > 0` in game-result. On a zero-amount redemption, call `normalizeQuests` (period rollover only) instead of `bumpQuests`.

**Why:** game-result accepts `amount >= 0` and game-session nonces are cheap to mint, so a script could loop session+result(amount=0) to farm play-count quests and claim SKZ without ever winning. Found in architect review.

**How to apply:** any future reward path keyed off gameplay (battle pass, wheel spins earned by play, etc.) must tie progress to an authoritative credited outcome, never to the bare act of redeeming a session. Regression covered in `.local/quest-test.mjs` (zero-amount plays must not make any quest claimable).
