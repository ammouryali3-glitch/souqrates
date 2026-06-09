/**
 * Lucky Wheel & Loot Box — prize tables and server-authoritative draw logic.
 * All prize selection happens on the server to prevent client manipulation.
 */
import { randomInt } from "crypto";

export type PrizeKind = "skz" | "xp" | "lootbox" | "extra_spin";

export interface Prize {
  id: string;
  kind: PrizeKind;
  amount: number;
  label: string;
  emoji: string;
  color: string;
  weight: number;
}

/**
 * 8-segment wheel — MUST stay in this exact order (index = visual segment).
 * Client mirrors this array to know which segment to animate to.
 */
export const WHEEL_PRIZES: Prize[] = [
  { id: "skz_50",     kind: "skz",        amount: 50,   label: "50 SKZ",     emoji: "🪙", color: "#6366f1", weight: 28 },
  { id: "skz_200",    kind: "skz",        amount: 200,  label: "200 SKZ",    emoji: "💰", color: "#8b5cf6", weight: 22 },
  { id: "skz_500",    kind: "skz",        amount: 500,  label: "500 SKZ",    emoji: "⚡", color: "#a855f7", weight: 14 },
  { id: "lootbox",    kind: "lootbox",    amount: 1,    label: "Loot Box",   emoji: "🎁", color: "#ec4899", weight: 14 },
  { id: "xp_100",     kind: "xp",         amount: 100,  label: "100 XP",     emoji: "✨", color: "#f59e0b", weight: 10 },
  { id: "skz_1000",   kind: "skz",        amount: 1000, label: "1,000 SKZ",  emoji: "💎", color: "#10b981", weight: 6  },
  { id: "extra_spin", kind: "extra_spin", amount: 1,    label: "Extra Spin", emoji: "🔄", color: "#3b82f6", weight: 4  },
  { id: "skz_5000",   kind: "skz",        amount: 5000, label: "5,000 SKZ",  emoji: "🚀", color: "#f97316", weight: 2  },
];

const TOTAL_WEIGHT = WHEEL_PRIZES.reduce((s, p) => s + p.weight, 0);

/** Server-authoritative random prize draw using crypto RNG. */
export function drawPrize(): Prize {
  const roll = randomInt(0, TOTAL_WEIGHT);
  let acc = 0;
  for (const prize of WHEEL_PRIZES) {
    acc += prize.weight;
    if (roll < acc) return prize;
  }
  return WHEEL_PRIZES[0];
}

/**
 * Draw 3 prizes for a loot box opening.
 * Excludes jackpot (skz_5000) and extra_spin — boxes are more balanced.
 */
const LOOT_TABLE = WHEEL_PRIZES.filter(p => !["skz_5000", "extra_spin"].includes(p.id));
const LOOT_TOTAL = LOOT_TABLE.reduce((s, p) => s + p.weight, 0);

export function drawLootBoxPrizes(): Prize[] {
  return [0, 1, 2].map(() => {
    const roll = randomInt(0, LOOT_TOTAL);
    let acc = 0;
    for (const p of LOOT_TABLE) { acc += p.weight; if (roll < acc) return p; }
    return LOOT_TABLE[0];
  });
}

/** 24-hour cooldown between free spins. */
export const FREE_SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function canFreeSpin(lastSpinAt?: string | null): boolean {
  if (!lastSpinAt) return true;
  return Date.now() - new Date(lastSpinAt).getTime() >= FREE_SPIN_COOLDOWN_MS;
}

export function nextFreeSpinAt(lastSpinAt?: string | null): string | null {
  if (!lastSpinAt || canFreeSpin(lastSpinAt)) return null;
  return new Date(new Date(lastSpinAt).getTime() + FREE_SPIN_COOLDOWN_MS).toISOString();
}
