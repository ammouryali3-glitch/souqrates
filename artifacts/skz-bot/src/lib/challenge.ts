/**
 * Client-side game challenge helpers.
 * A challenge = user A plays a game and dares user B to beat their score.
 * Deep link: https://t.me/BOT?startapp=ch_<id>
 */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ACTIVE_CHALLENGE_KEY = "skz_active_challenge";

export interface ChallengeInfo {
  id: string;
  challengerName: string;
  gameId: string;
  gameName: string;
  score: number;
  status: "open" | "beaten" | "expired";
  opponentScore: number | null;
  createdAt: string;
  expiresAt: string;
}

export interface CreateChallengeResult {
  id: string;
  shareUrl: string;
}

export async function createChallenge(
  gameId: string,
  gameName: string,
  score: number,
): Promise<CreateChallengeResult> {
  const res = await fetch(`${BASE}/api/user/challenge/create`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId, gameName, score }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create challenge");
  return data as CreateChallengeResult;
}

export async function getChallenge(id: string): Promise<ChallengeInfo | null> {
  try {
    const res = await fetch(`${BASE}/api/user/challenge/${encodeURIComponent(id)}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export interface BeatChallengeResult {
  beaten: boolean;
  newSkz?: number;
  reward?: number;
}

export async function beatChallenge(id: string, score: number): Promise<BeatChallengeResult> {
  const res = await fetch(`${BASE}/api/user/challenge/${encodeURIComponent(id)}/beat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ score }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to submit challenge score");
  return data as BeatChallengeResult;
}

/** Store the active challenge ID in sessionStorage so arena-shell can pick it up. */
export function setActiveChallenge(id: string) {
  sessionStorage.setItem(ACTIVE_CHALLENGE_KEY, id);
}

export function getActiveChallenge(): string | null {
  return sessionStorage.getItem(ACTIVE_CHALLENGE_KEY);
}

export function clearActiveChallenge() {
  sessionStorage.removeItem(ACTIVE_CHALLENGE_KEY);
}
