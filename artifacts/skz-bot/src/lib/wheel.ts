/**
 * Client-side Lucky Wheel & Loot Box store.
 * Prize data, API calls, and a useSyncExternalStore hook.
 * Prize array MUST mirror server lib/wheel.ts (same order = same segment indices).
 */
import { useSyncExternalStore } from "react";
import { writeBalance } from "@/lib/admin-store";
import { refreshProgression } from "@/lib/progression";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

/** Must mirror server WHEEL_PRIZES exactly (index = visual segment). */
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

export interface WheelStatus {
  canSpin: boolean;
  nextSpinAt: string | null;
  extraSpins: number;
  lootBoxes: number;
}

export interface SpinResult {
  prizeId: string;
  prizeIndex: number;
  newSkz: number;
  newXp: number;
  canSpin: boolean;
  nextSpinAt: string | null;
  extraSpins: number;
  lootBoxes: number;
}

export interface BoxResult {
  prizes: Array<{ id: string; kind: PrizeKind; amount: number; label: string; emoji: string }>;
  totalSkz: number;
  totalXp: number;
  newSkz: number;
  newXp: number;
  lootBoxes: number;
}

// ── Store ──────────────────────────────────────────────────────────────────────

let status: WheelStatus | null = null;
const listeners = new Set<() => void>();
function emit() { listeners.forEach(l => l()); }

function setStatus(s: WheelStatus | null) { status = s; emit(); }
export function getWheelStatus(): WheelStatus | null { return status; }

export function useWheelStatus(): WheelStatus | null {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb); },
    () => status,
    () => status,
  );
}

let fetchSeq = 0;

export async function refreshWheelStatus(): Promise<WheelStatus | null> {
  const seq = ++fetchSeq;
  try {
    const res = await fetch(`${BASE}/api/user/wheel/status`, { credentials: "include" });
    if (!res.ok) return status;
    const json = (await res.json()) as WheelStatus;
    if (seq !== fetchSeq) return status;
    setStatus(json);
    return status;
  } catch {
    return status;
  }
}

export async function spinWheel(): Promise<SpinResult | null> {
  try {
    const res = await fetch(`${BASE}/api/user/wheel/spin`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as SpinResult;
    setStatus({
      canSpin: json.canSpin,
      nextSpinAt: json.nextSpinAt,
      extraSpins: json.extraSpins,
      lootBoxes: json.lootBoxes,
    });
    writeBalance(json.newSkz);
    refreshProgression().catch(() => null);
    return json;
  } catch {
    return null;
  }
}

export async function openLootBox(): Promise<BoxResult | null> {
  try {
    const res = await fetch(`${BASE}/api/user/wheel/open-box`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as BoxResult;
    if (status) setStatus({ ...status, lootBoxes: json.lootBoxes });
    writeBalance(json.newSkz);
    refreshProgression().catch(() => null);
    return json;
  } catch {
    return null;
  }
}
