/**
 * Progression engine — XP, levels, and leagues.
 *
 * XP is the backbone of the engagement layer: it is earned by playing games and
 * checking in daily, drives the player's level, and the level maps to a visible
 * league tier (Bronze → Legend). Battle pass, quests, and league leaderboards
 * all read from the same XP value stored on the user JSONB.
 *
 * The level curve and league boundaries are defined ONCE here (server-authoritative)
 * and exposed to the client via GET /api/user/progression so the two never drift.
 */

/** XP required to advance FROM level L to L+1. Grows linearly per level. */
function xpToNext(level: number): number {
  return 100 + (level - 1) * 60;
}

/** Cumulative XP required to first reach `level` (level 1 = 0 XP). */
function cumulativeXpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return total;
}

export interface LevelInfo {
  /** Current level (>= 1). */
  level: number;
  /** Cumulative XP floor of the current level. */
  levelFloorXp: number;
  /** Cumulative XP required to reach the next level. */
  nextLevelXp: number;
  /** XP earned within the current level. */
  intoLevel: number;
  /** Total XP span of the current level. */
  levelSpan: number;
}

/** Derive level + progress from a total XP value. */
export function levelFromXp(xp: number): LevelInfo {
  const safeXp = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  let level = 1;
  // Advance while the player has enough XP for the next level (capped for safety).
  while (level < 999 && safeXp >= cumulativeXpForLevel(level + 1)) {
    level++;
  }
  const levelFloorXp = cumulativeXpForLevel(level);
  const nextLevelXp = cumulativeXpForLevel(level + 1);
  return {
    level,
    levelFloorXp,
    nextLevelXp,
    intoLevel: safeXp - levelFloorXp,
    levelSpan: nextLevelXp - levelFloorXp,
  };
}

export type LeagueKey =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "master"
  | "legend";

interface LeagueDef {
  key: LeagueKey;
  minLevel: number;
}

/** League tiers keyed by the minimum level required to enter them. */
const LEAGUES: LeagueDef[] = [
  { key: "bronze", minLevel: 1 },
  { key: "silver", minLevel: 5 },
  { key: "gold", minLevel: 10 },
  { key: "platinum", minLevel: 18 },
  { key: "diamond", minLevel: 28 },
  { key: "master", minLevel: 40 },
  { key: "legend", minLevel: 55 },
];

export interface LeagueInfo {
  key: LeagueKey;
  index: number;
  /** Level at which the NEXT league unlocks, or null if already top tier. */
  nextLeagueLevel: number | null;
  nextLeagueKey: LeagueKey | null;
}

/** Map a level to its league tier. */
export function leagueFromLevel(level: number): LeagueInfo {
  let idx = 0;
  for (let i = 0; i < LEAGUES.length; i++) {
    if (level >= LEAGUES[i]!.minLevel) idx = i;
  }
  const next = LEAGUES[idx + 1] ?? null;
  return {
    key: LEAGUES[idx]!.key,
    index: idx,
    nextLeagueLevel: next ? next.minLevel : null,
    nextLeagueKey: next ? next.key : null,
  };
}

export interface ProgressionSnapshot extends LevelInfo, LeagueInfo {
  xp: number;
}

/** Full progression snapshot for the API response. */
export function progressionFromXp(xp: number): ProgressionSnapshot {
  const safeXp = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  const lvl = levelFromXp(safeXp);
  const lg = leagueFromLevel(lvl.level);
  return { xp: safeXp, ...lvl, ...lg };
}

/** Maximum XP a single game can grant (guards against runaway curves). */
const MAX_GAME_XP = 200;

/**
 * XP earned for one completed game play.
 * Base reward for playing + a bonus scaled by SKZ credited, capped.
 */
export function xpForGame(creditedSkz: number): number {
  const credited = Math.max(0, Math.floor(Number.isFinite(creditedSkz) ? creditedSkz : 0));
  return Math.min(MAX_GAME_XP, 10 + Math.floor(credited / 10));
}

/** XP earned for a daily check-in (rewards consistency, scales with streak). */
export function xpForCheckin(streak: number): number {
  const s = Math.max(1, Math.floor(Number.isFinite(streak) ? streak : 1));
  return 25 + Math.min(75, (s - 1) * 5);
}
