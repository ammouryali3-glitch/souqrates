/**
 * Client-side Battle Pass store + API helpers.
 * Uses useSyncExternalStore for zero-dependency reactive state.
 */
import { useSyncExternalStore } from "react";

export type BattlePassRewardType = "skz" | "lootbox" | "extra_spin";

export interface BattlePassReward {
  type: BattlePassRewardType;
  amount: number;
}

export interface BattlePassTier {
  tier: number;
  xpRequired: number;
  freeReward: BattlePassReward;
  premiumReward: BattlePassReward;
  milestone?: boolean;
}

export interface BattlePassSeason {
  seasonId: string;
  name: string;
  nameEn: string;
  endDate: string;
  premiumCost: number;
  tiers: BattlePassTier[];
}

export interface BattlePassStatus {
  season: BattlePassSeason;
  seasonXp: number;        // XP earned this season
  premium: boolean;
  claimedFree: number[];
  claimedPremium: number[];
  unlockedTiers: number[]; // tier numbers user has enough XP for
  claimableCount: number;  // total unclaimed but unlocked rewards
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Store ─────────────────────────────────────────────────────────────────────

let _status: BattlePassStatus | null = null;
let _loading = false;
const _listeners = new Set<() => void>();

function notify() { _listeners.forEach((fn) => fn()); }

function subscribe(fn: () => void) {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

export function useBattlePassStatus(): BattlePassStatus | null {
  return useSyncExternalStore(subscribe, () => _status);
}

export async function refreshBattlePassStatus(): Promise<void> {
  if (_loading) return;
  _loading = true;
  try {
    const res = await fetch(`${BASE}/api/user/battle-pass`, { credentials: "include" });
    if (!res.ok) return;
    const data: BattlePassStatus = await res.json();
    _status = data;
    notify();
  } catch {
    // silent
  } finally {
    _loading = false;
  }
}

export interface ClaimResult {
  ok: boolean;
  reward: BattlePassReward;
  newSkz?: number;
  newLootBoxes?: number;
  newExtraSpins?: number;
}

export async function claimBattlePassTier(tier: number, track: "free" | "premium"): Promise<ClaimResult> {
  const res = await fetch(`${BASE}/api/user/battle-pass/claim`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tier, track }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to claim");
  // Refresh status after claim
  await refreshBattlePassStatus();
  return data as ClaimResult;
}

export async function unlockBattlePassPremium(): Promise<{ ok: boolean; newSkz: number }> {
  const res = await fetch(`${BASE}/api/user/battle-pass/unlock-premium`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to unlock");
  await refreshBattlePassStatus();
  return data;
}
