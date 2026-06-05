import { getPoolShare } from "./admin-store";

export interface LeaderEntry {
  rank: number;
  name: string;
  score: number;
  time: number;
  isYou?: boolean;
}

export type ArenaPeriod = "daily" | "weekly";

export function getDefaultLeaders(_gameId: string): LeaderEntry[] {
  return [];
}

export function getBasePool(_gameId: string): number {
  return 0;
}

export function getBaseEntries(_gameId: string): number {
  return 0;
}

export function getPool(gameId: string): number {
  const stored = localStorage.getItem(`skz_pool_${gameId}`);
  return stored ? parseInt(stored) : getBasePool(gameId);
}

export function getEntries(gameId: string): number {
  const stored = localStorage.getItem(`skz_entries_${gameId}`);
  return stored ? parseInt(stored) : getBaseEntries(gameId);
}

export function addEntry(gameId: string, fee: number): void {
  const pool = getPool(gameId);
  const entries = getEntries(gameId);
  localStorage.setItem(`skz_pool_${gameId}`, String(pool + Math.floor(fee * getPoolShare(gameId))));
  localStorage.setItem(`skz_entries_${gameId}`, String(entries + 1));
}

export function hasPlayed(gameId: string, period: ArenaPeriod): boolean {
  const stored = localStorage.getItem(`skz_played_${gameId}`);
  if (!stored) return false;
  const ms = period === "weekly" ? 7 * 24 * 3600 * 1000 : 24 * 3600 * 1000;
  return Date.now() - parseInt(stored) < ms;
}

export function markPlayed(gameId: string): void {
  localStorage.setItem(`skz_played_${gameId}`, String(Date.now()));
}

export function getLeaderboard(gameId: string): LeaderEntry[] {
  const stored = localStorage.getItem(`skz_leaders_${gameId}`);
  return stored ? JSON.parse(stored) : getDefaultLeaders(gameId);
}

export function submitScore(gameId: string, score: number, time: number, name: string): { leaders: LeaderEntry[]; rank: number } {
  const leaders = getLeaderboard(gameId).filter(l => !l.isYou);
  const entry: LeaderEntry = { rank: 0, name, score, time, isYou: true };
  leaders.push(entry);
  leaders.sort((a, b) => b.score - a.score || a.time - b.time);
  leaders.forEach((l, i) => { l.rank = i + 1; });
  const trimmed = leaders.slice(0, 20);
  localStorage.setItem(`skz_leaders_${gameId}`, JSON.stringify(trimmed));
  const rank = trimmed.find(l => l.isYou)?.rank ?? trimmed.length;
  return { leaders: trimmed, rank };
}

export function getCountdown(period: ArenaPeriod): string {
  const now = new Date();
  let target: Date;
  if (period === "weekly") {
    target = new Date(now);
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    target.setDate(now.getDate() + daysUntilSunday);
    target.setHours(0, 0, 0, 0);
  } else {
    target = new Date(now);
    target.setDate(now.getDate() + 1);
    target.setHours(0, 0, 0, 0);
  }
  const diff = target.getTime() - now.getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m}m`;
  return `${h}h ${m}m`;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
