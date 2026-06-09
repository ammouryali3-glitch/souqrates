/**
 * Client-side Clan store + API helpers.
 */
import { useSyncExternalStore } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface ClanMember {
  id: string;
  name: string;
  xp: number;
  level: number;
}

export interface ClanInfo {
  id: string;
  name: string;
  tag: string;
  ownerId: string;
  memberCount: number;
  totalXp: number;
  rank: number;
  members: ClanMember[];
}

export interface ClanLeaderEntry {
  id: string;
  name: string;
  tag: string;
  memberCount: number;
  totalXp: number;
  rank: number;
}

export interface ClanStatus {
  clan: ClanInfo | null;
  leaderboard: ClanLeaderEntry[];
}

// ── Store ─────────────────────────────────────────────────────────────────────

let _status: ClanStatus | null = null;
let _loading = false;
const _listeners = new Set<() => void>();

function notify() { _listeners.forEach((fn) => fn()); }

function subscribe(fn: () => void) {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

export function useClanStatus(): ClanStatus | null {
  return useSyncExternalStore(subscribe, () => _status);
}

export async function refreshClanStatus(): Promise<void> {
  if (_loading) return;
  _loading = true;
  try {
    const res = await fetch(`${BASE}/api/user/clan`, { credentials: "include" });
    if (!res.ok) return;
    _status = await res.json();
    notify();
  } catch {
    // silent
  } finally {
    _loading = false;
  }
}

// ── API Calls ─────────────────────────────────────────────────────────────────

export async function createClan(name: string, tag: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/api/user/clan/create`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, tag }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create clan");
  await refreshClanStatus();
  return data;
}

export async function joinClan(tag: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/api/user/clan/join`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to join clan");
  await refreshClanStatus();
  return data;
}

export async function leaveClan(): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/api/user/clan/leave`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to leave clan");
  _status = null;
  notify();
  await refreshClanStatus();
  return data;
}
