/**
 * Client progression — fetches the server-authoritative XP/level/league snapshot
 * and exposes league cosmetics (names, colors, icons) for rendering.
 *
 * The numeric curve (levels, league boundaries) lives ONLY on the server
 * (GET /api/user/progression). The client just renders what it returns plus the
 * cosmetic metadata defined here.
 */

import { useSyncExternalStore } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export type LeagueKey =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "master"
  | "legend";

export interface Progression {
  xp: number;
  level: number;
  levelFloorXp: number;
  nextLevelXp: number;
  intoLevel: number;
  levelSpan: number;
  key: LeagueKey;
  index: number;
  nextLeagueLevel: number | null;
  nextLeagueKey: LeagueKey | null;
}

export interface LeagueCosmetic {
  key: LeagueKey;
  nameAr: string;
  nameEn: string;
  /** Primary accent color of the tier. */
  color: string;
  /** Two-stop gradient for badges/cards. */
  gradient: [string, string];
  icon: string;
}

export const LEAGUES: LeagueCosmetic[] = [
  { key: "bronze", nameAr: "برونزي", nameEn: "Bronze", color: "#cd7f32", gradient: ["#8a5a2b", "#e09b54"], icon: "🥉" },
  { key: "silver", nameAr: "فضي", nameEn: "Silver", color: "#c0c7d1", gradient: ["#7d8694", "#dfe6f0"], icon: "🥈" },
  { key: "gold", nameAr: "ذهبي", nameEn: "Gold", color: "#f0c850", gradient: ["#b8860b", "#ffe07a"], icon: "🥇" },
  { key: "platinum", nameAr: "بلاتيني", nameEn: "Platinum", color: "#5fe3d0", gradient: ["#2a9d8f", "#8ff7e8"], icon: "💠" },
  { key: "diamond", nameAr: "ماسي", nameEn: "Diamond", color: "#6bb8ff", gradient: ["#2563eb", "#9ed2ff"], icon: "💎" },
  { key: "master", nameAr: "أسطورة", nameEn: "Master", color: "#c084fc", gradient: ["#7c3aed", "#d8b4fe"], icon: "👑" },
  { key: "legend", nameAr: "خالد", nameEn: "Legend", color: "#ff6b9d", gradient: ["#db2777", "#ffa8c8"], icon: "🔥" },
];

export function leagueCosmetic(key: LeagueKey): LeagueCosmetic {
  return LEAGUES.find((l) => l.key === key) ?? LEAGUES[0]!;
}

export function leagueName(key: LeagueKey, lang: "ar" | "en"): string {
  const c = leagueCosmetic(key);
  return lang === "ar" ? c.nameAr : c.nameEn;
}

// ── Store ──────────────────────────────────────────────────────────────────────

let progression: Progression | null = null;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

// ── Level-up detection ──────────────────────────────────────────────────────────
// Persist the last level we celebrated so a level-up fires exactly once, even
// across reloads, and never on the very first snapshot of a session.

const LEVEL_KEY = "skz_last_level";

let pendingLevelUp: number | null = null;
const levelUpListeners = new Set<() => void>();
function emitLevelUp() { levelUpListeners.forEach((l) => l()); }

function detectLevelUp(level: number) {
  let stored = 0;
  try { stored = Number(localStorage.getItem(LEVEL_KEY) ?? "0"); } catch { /* ignore */ }
  if (stored > 0 && level > stored) {
    pendingLevelUp = level;
    emitLevelUp();
  }
  try { localStorage.setItem(LEVEL_KEY, String(level)); } catch { /* ignore */ }
}

/** Read & clear the pending level-up (the level just reached), if any. */
export function consumeLevelUp(): number | null {
  const v = pendingLevelUp;
  pendingLevelUp = null;
  return v;
}

export function usePendingLevelUp(): number | null {
  return useSyncExternalStore(
    (cb) => { levelUpListeners.add(cb); return () => levelUpListeners.delete(cb); },
    () => pendingLevelUp,
    () => pendingLevelUp,
  );
}

function setProgression(p: Progression | null) {
  progression = p;
  if (p) detectLevelUp(p.level);
  emit();
}

export function getProgression(): Progression | null {
  return progression;
}

// Monotonic request counter — guards against a stale (slower) response
// overwriting a newer one, which could roll `skz_last_level` backward and
// re-trigger an already-celebrated level-up.
let fetchSeq = 0;

/** Fetch the latest snapshot from the server and broadcast it. */
export async function refreshProgression(): Promise<Progression | null> {
  const seq = ++fetchSeq;
  try {
    const res = await fetch(`${BASE}/api/user/progression`, { credentials: "include" });
    if (!res.ok) return progression;
    const json = (await res.json()) as Progression;
    // Drop this response if a newer fetch has since been issued.
    if (seq !== fetchSeq) return progression;
    setProgression(json);
    return json;
  } catch {
    return progression;
  }
}

export function useProgression(): Progression | null {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => progression,
    () => progression,
  );
}
