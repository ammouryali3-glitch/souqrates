/**
 * Battle Pass — server-side season config + reward logic.
 *
 * Season config is read from admin_config key "battle_pass" (if set);
 * otherwise DEFAULT_SEASON is used. Users accumulate "season XP" which is
 * total XP minus the XP they had when the season first activated for them.
 */

export type BattlePassRewardType = "skz" | "lootbox" | "extra_spin";

export interface BattlePassReward {
  type: BattlePassRewardType;
  amount: number;
}

export interface BattlePassTier {
  tier: number;         // 1–30
  xpRequired: number;  // season XP needed to unlock
  freeReward: BattlePassReward;
  premiumReward: BattlePassReward;
  milestone?: boolean; // visual highlight at tiers 5/10/15/20/25/30
}

export interface BattlePassSeason {
  seasonId: string;
  name: string;     // Arabic name shown in UI
  nameEn: string;
  endDate: string;  // ISO "YYYY-MM-DD" — exclusive upper bound
  premiumCost: number; // SKZ to unlock premium track
  tiers: BattlePassTier[];
}

/** Shape of data.battlePass stored in platform_users.data JSONB */
export interface UserBattlePassData {
  seasonId: string;
  seasonStartXp: number; // user's total XP when season activated for them
  premium: boolean;
  claimedFree: number[];    // tier numbers already claimed from free track
  claimedPremium: number[]; // tier numbers already claimed from premium track
}

// ── Default 30-tier season (June 2026) ────────────────────────────────────────

export const DEFAULT_TIERS: BattlePassTier[] = [
  { tier:  1, xpRequired:     0, freeReward: { type: "skz", amount: 100 },        premiumReward: { type: "skz", amount: 500 } },
  { tier:  2, xpRequired:   300, freeReward: { type: "skz", amount: 100 },        premiumReward: { type: "lootbox", amount: 1 } },
  { tier:  3, xpRequired:   700, freeReward: { type: "extra_spin", amount: 1 },   premiumReward: { type: "skz", amount: 1000 } },
  { tier:  4, xpRequired:  1200, freeReward: { type: "skz", amount: 200 },        premiumReward: { type: "lootbox", amount: 1 } },
  { tier:  5, xpRequired:  1800, freeReward: { type: "skz", amount: 200 },        premiumReward: { type: "skz", amount: 2000 },   milestone: true },
  { tier:  6, xpRequired:  2500, freeReward: { type: "extra_spin", amount: 1 },   premiumReward: { type: "lootbox", amount: 1 } },
  { tier:  7, xpRequired:  3300, freeReward: { type: "skz", amount: 300 },        premiumReward: { type: "skz", amount: 2000 } },
  { tier:  8, xpRequired:  4200, freeReward: { type: "lootbox", amount: 1 },      premiumReward: { type: "lootbox", amount: 2 } },
  { tier:  9, xpRequired:  5200, freeReward: { type: "skz", amount: 300 },        premiumReward: { type: "skz", amount: 2500 } },
  { tier: 10, xpRequired:  6300, freeReward: { type: "extra_spin", amount: 1 },   premiumReward: { type: "skz", amount: 5000 },   milestone: true },
  { tier: 11, xpRequired:  7500, freeReward: { type: "skz", amount: 400 },        premiumReward: { type: "lootbox", amount: 1 } },
  { tier: 12, xpRequired:  8800, freeReward: { type: "skz", amount: 400 },        premiumReward: { type: "skz", amount: 3000 } },
  { tier: 13, xpRequired: 10200, freeReward: { type: "extra_spin", amount: 1 },   premiumReward: { type: "lootbox", amount: 2 } },
  { tier: 14, xpRequired: 11700, freeReward: { type: "skz", amount: 500 },        premiumReward: { type: "skz", amount: 3500 } },
  { tier: 15, xpRequired: 13300, freeReward: { type: "lootbox", amount: 1 },      premiumReward: { type: "skz", amount: 7500 },   milestone: true },
  { tier: 16, xpRequired: 15000, freeReward: { type: "skz", amount: 500 },        premiumReward: { type: "lootbox", amount: 1 } },
  { tier: 17, xpRequired: 16800, freeReward: { type: "skz", amount: 600 },        premiumReward: { type: "skz", amount: 4000 } },
  { tier: 18, xpRequired: 18700, freeReward: { type: "extra_spin", amount: 1 },   premiumReward: { type: "lootbox", amount: 2 } },
  { tier: 19, xpRequired: 20700, freeReward: { type: "skz", amount: 700 },        premiumReward: { type: "skz", amount: 4500 } },
  { tier: 20, xpRequired: 22800, freeReward: { type: "lootbox", amount: 1 },      premiumReward: { type: "skz", amount: 10000 },  milestone: true },
  { tier: 21, xpRequired: 25000, freeReward: { type: "skz", amount: 700 },        premiumReward: { type: "lootbox", amount: 2 } },
  { tier: 22, xpRequired: 27300, freeReward: { type: "skz", amount: 800 },        premiumReward: { type: "skz", amount: 5000 } },
  { tier: 23, xpRequired: 29700, freeReward: { type: "extra_spin", amount: 1 },   premiumReward: { type: "lootbox", amount: 2 } },
  { tier: 24, xpRequired: 32200, freeReward: { type: "skz", amount: 900 },        premiumReward: { type: "skz", amount: 5000 } },
  { tier: 25, xpRequired: 34800, freeReward: { type: "lootbox", amount: 1 },      premiumReward: { type: "skz", amount: 12500 },  milestone: true },
  { tier: 26, xpRequired: 37500, freeReward: { type: "skz", amount: 1000 },       premiumReward: { type: "lootbox", amount: 2 } },
  { tier: 27, xpRequired: 40300, freeReward: { type: "skz", amount: 1000 },       premiumReward: { type: "skz", amount: 7500 } },
  { tier: 28, xpRequired: 43200, freeReward: { type: "extra_spin", amount: 2 },   premiumReward: { type: "lootbox", amount: 3 } },
  { tier: 29, xpRequired: 46200, freeReward: { type: "skz", amount: 1500 },       premiumReward: { type: "skz", amount: 10000 } },
  { tier: 30, xpRequired: 50000, freeReward: { type: "skz", amount: 2000 },       premiumReward: { type: "skz", amount: 25000 },  milestone: true },
];

export const DEFAULT_SEASON: BattlePassSeason = {
  seasonId: "2026-06",
  name: "موسم يونيو",
  nameEn: "June Season",
  endDate: "2026-06-30",
  premiumCost: 5000,
  tiers: DEFAULT_TIERS,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Milliseconds until season end (negative if ended). */
export function msUntilSeasonEnd(endDate: string): number {
  return new Date(`${endDate}T23:59:59Z`).getTime() - Date.now();
}

/** Whether the season is still active. */
export function isSeasonActive(endDate: string): boolean {
  return msUntilSeasonEnd(endDate) > 0;
}

/**
 * Given current season XP, return the set of tier numbers (1-based) that are
 * unlocked (xpRequired <= seasonXp).
 */
export function unlockedTiers(seasonXp: number, tiers: BattlePassTier[]): Set<number> {
  const s = new Set<number>();
  for (const t of tiers) {
    if (seasonXp >= t.xpRequired) s.add(t.tier);
  }
  return s;
}

/**
 * Build or refresh the user's battlePass sub-document.
 * If seasonId differs from current season, starts fresh (resets claims, records startXp).
 */
export function reconcileUserBP(
  existing: unknown,
  currentSeasonId: string,
  currentTotalXp: number,
): UserBattlePassData {
  const bp = (existing ?? {}) as Partial<UserBattlePassData>;
  if (bp.seasonId !== currentSeasonId) {
    // New season — reset progress, snapshot starting XP
    return {
      seasonId: currentSeasonId,
      seasonStartXp: currentTotalXp,
      premium: false,
      claimedFree: [],
      claimedPremium: [],
    };
  }
  return {
    seasonId: bp.seasonId,
    seasonStartXp: bp.seasonStartXp ?? 0,
    premium: bp.premium ?? false,
    claimedFree: Array.isArray(bp.claimedFree) ? bp.claimedFree : [],
    claimedPremium: Array.isArray(bp.claimedPremium) ? bp.claimedPremium : [],
  };
}
