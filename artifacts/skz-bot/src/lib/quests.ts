/**
 * Client quests — fetches the server-authoritative list of active daily/weekly
 * missions with the player's progress, and exposes a claim action.
 *
 * Quest definitions, targets, rewards, and progress all live on the server
 * (GET /api/user/quests). The client only renders this list and builds localized
 * labels from the metric + target.
 */

import { useSyncExternalStore } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export type QuestMetric = "games_played" | "skz_earned" | "checkin";
export type QuestPeriod = "daily" | "weekly";

export interface QuestView {
  id: string;
  period: QuestPeriod;
  metric: QuestMetric;
  target: number;
  rewardXp: number;
  rewardSkz: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  claimable: boolean;
}

// ── Store ──────────────────────────────────────────────────────────────────────

let quests: QuestView[] | null = null;
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

function setQuests(q: QuestView[] | null) {
  quests = q;
  emit();
}

export function getQuests(): QuestView[] | null {
  return quests;
}

let fetchSeq = 0;

/** Fetch the active quests + progress from the server and broadcast them. */
export async function refreshQuests(): Promise<QuestView[] | null> {
  const seq = ++fetchSeq;
  try {
    const res = await fetch(`${BASE}/api/user/quests`, { credentials: "include" });
    if (!res.ok) return quests;
    const json = (await res.json()) as { quests: QuestView[] };
    if (seq !== fetchSeq) return quests;
    setQuests(json.quests ?? []);
    return quests;
  } catch {
    return quests;
  }
}

/**
 * Claim a completed quest. On success the returned quest list is broadcast so
 * UI updates immediately. Returns the granted reward, or null on failure.
 */
export async function claimQuest(
  questId: string,
): Promise<{ skz: number; xp: number } | null> {
  try {
    const res = await fetch(`${BASE}/api/user/quests/claim`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questId }),
    });
    if (!res.ok) {
      // Re-sync to reflect authoritative state (e.g. already-claimed elsewhere).
      await refreshQuests();
      return null;
    }
    const json = (await res.json()) as { skz: number; xp: number; quests: QuestView[] };
    setQuests(json.quests ?? quests);
    return { skz: json.skz, xp: json.xp };
  } catch {
    return null;
  }
}

export function useQuests(): QuestView[] | null {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => quests,
    () => quests,
  );
}

/** Count of quests ready to claim — for the home badge. */
export function useClaimableCount(): number {
  const q = useQuests();
  return (q ?? []).filter((x) => x.claimable).length;
}
