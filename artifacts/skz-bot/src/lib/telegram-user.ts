/**
 * Telegram WebApp user identity + server-synced balance.
 *
 * On startup this module:
 *   1. Reads window.Telegram.WebApp.initData (the signed payload from Telegram)
 *   2. Posts it to /api/user/init — the server verifies the HMAC, upserts the
 *      user in platform_users, and returns the DB record (including balance).
 *   3. Overwrites the localStorage balance with the server's value.
 *
 * Balance sync security model:
 *   - DEBITS  (spending) → POST /api/user/balance-event { type: "debit", amount }
 *   - CREDITS (earnings) → two-step nonce flow per credit claim:
 *       1. POST /api/user/game-session { gameId }  — server issues single-use nonce
 *       2. POST /api/user/game-result  { sessionId, amount }  — server validates &
 *          applies credit (cap: MAX_SESSION_REWARD SKZ per nonce)
 *
 * Nonce lifecycle:
 *   - App.tsx pre-fetches a nonce on every /games/* and /arena/* route entry
 *     (optimization — reduces latency for the first credit after entering a game).
 *   - If no pre-fetched nonce is available when a credit is needed (e.g. repeated
 *     plays without leaving the route, or arena credits), flushBalanceEvent requests
 *     a fresh nonce inline before proceeding.  This guarantees every credit is
 *     eventually persisted regardless of route context.
 */

import { useSyncExternalStore } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
}

// ── Telegram WebApp shim ──────────────────────────────────────────────────────

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TgWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    start_param?: string;
    auth_date?: number;
    hash?: string;
  };
  ready(): void;
  expand(): void;
}

function getTelegramWebApp(): TgWebApp | null {
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp ?? null;
}

// ── State ─────────────────────────────────────────────────────────────────────

export interface TelegramUserState {
  loading: boolean;
  tgUser: TelegramUser | null;
  dbUser: Record<string, unknown> | null;
  inTelegram: boolean;
  ready: boolean;
}

const initialState: TelegramUserState = {
  loading: false,
  tgUser: null,
  dbUser: null,
  inTelegram: false,
  ready: false,
};

let tgState: TelegramUserState = { ...initialState };
const tgListeners = new Set<() => void>();

function emitTg() {
  tgListeners.forEach((l) => l());
}

function setTgState(patch: Partial<TelegramUserState>) {
  tgState = { ...tgState, ...patch };
  emitTg();
}

function subscribeTg(l: () => void) {
  tgListeners.add(l);
  return () => tgListeners.delete(l);
}

function getSnapshotTg(): TelegramUserState {
  return tgState;
}

export function useTelegramUser(): TelegramUserState {
  return useSyncExternalStore(subscribeTg, getSnapshotTg, getSnapshotTg);
}

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Called once on app startup (from admin-store.ts initFromApi).
 * Returns the server-confirmed SKZ balance, or null if not available.
 */
export async function initTelegramUser(): Promise<number | null> {
  const twa = getTelegramWebApp();

  if (!twa) {
    setTgState({ loading: false, inTelegram: false, ready: true });
    return null;
  }

  const initData = twa.initData;
  const tgUser = twa.initDataUnsafe?.user ?? null;

  setTgState({ loading: true, inTelegram: true, tgUser });

  try {
    twa.ready();
    twa.expand();
  } catch {
    /* ignore */
  }

  if (!initData) {
    setTgState({ loading: false, inTelegram: false, ready: true });
    return null;
  }

  try {
    const res = await apiFetch("/api/user/init", {
      method: "POST",
      body: JSON.stringify({ initData }),
    });

    if (!res.ok) {
      console.warn("[telegram-user] /api/user/init failed:", res.status);
      setTgState({ loading: false, ready: true });
      return null;
    }

    const json = (await res.json()) as { user: Record<string, unknown> };
    const dbUser = json.user;
    const balances = (dbUser.balances ?? {}) as Record<string, number>;
    const skz = typeof balances.SKZ === "number" ? balances.SKZ : null;

    if (skz !== null) setServerConfirmedBalance(skz);

    setTgState({ loading: false, dbUser, ready: true });
    return skz;
  } catch (err) {
    console.warn("[telegram-user] /api/user/init error:", err);
    setTgState({ loading: false, ready: true });
    return null;
  }
}

// ── Game session nonces ───────────────────────────────────────────────────────

/**
 * The active pre-fetched game session nonce (optimization).
 * Set by setCurrentGameContext() when the route changes.
 * Consumed in flushBalanceEvent; if null, a fresh nonce is requested inline.
 */
let prefetchedSessionId: string | null = null;

/**
 * The game/context ID used when requesting a nonce inline (fallback).
 * Updated by setCurrentGameContext() on every relevant route change.
 */
let currentContextId = "unknown";

/**
 * Called by App.tsx on every /games/* or /arena/* route entry.
 * Pre-fetches a nonce for the first credit in this play session (optimization).
 * Subsequent plays that consume the nonce will request one inline automatically.
 */
export async function setCurrentGameContext(contextId: string): Promise<void> {
  currentContextId = contextId;
  prefetchedSessionId = null; // reset stale nonce from previous context

  if (!tgState.inTelegram || !tgState.ready || !tgState.dbUser) return;

  try {
    const res = await apiFetch("/api/user/game-session", {
      method: "POST",
      body: JSON.stringify({ gameId: contextId }),
    });
    if (res.ok) {
      const json = (await res.json()) as { sessionId: string };
      prefetchedSessionId = json.sessionId;
    }
  } catch {
    /* network error — inline fallback will handle it */
  }
}

/**
 * Request a fresh single-use nonce from the server.
 * Used as a fallback when the pre-fetched nonce has been consumed (repeated plays).
 */
async function requestFreshNonce(): Promise<string | null> {
  try {
    const res = await apiFetch("/api/user/game-session", {
      method: "POST",
      body: JSON.stringify({ gameId: currentContextId }),
    });
    if (res.ok) {
      const json = (await res.json()) as { sessionId: string };
      return json.sessionId;
    }
  } catch {
    /* network error */
  }
  return null;
}

// ── Balance sync ──────────────────────────────────────────────────────────────

/**
 * Race-free balance sync via a serialized request queue.
 *
 *   confirmedBalance — last value the server acknowledged
 *   pendingBalance   — latest value the client wants to reach
 *
 * Delta is computed at flush time from confirmedBalance.
 * Only one request is in-flight at a time (inflight flag).
 *
 * Credit path  → /api/user/game-result (with nonce, per-nonce reward cap)
 *   Large credits are automatically chunked: each flush claims at most
 *   MAX_CREDIT_PER_NONCE SKZ using one nonce, then the residual triggers
 *   another flush with a fresh nonce. This handles any credit size reliably,
 *   including daily bonuses, referral rewards, and multiple consecutive plays.
 *
 * Debit  path  → /api/user/balance-event { type: "debit", amount }
 *
 * Hard-error reconciliation:
 *   On a 400/409 rejection (nonce invalid, expired, or other validation error),
 *   the client fetches /api/user/me to learn the server's authoritative balance
 *   and resets both confirmedBalance and pendingBalance to that value. This
 *   breaks any potential retry loop and keeps client/server in sync.
 */

/** Must match MAX_SESSION_REWARD on the server (user.ts). */
const MAX_CREDIT_PER_NONCE = 2_000;

let confirmedBalance: number | null = null;
let pendingBalance: number | null = null;
let inflight = false;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

export function setServerConfirmedBalance(skz: number): void {
  confirmedBalance = skz;
  pendingBalance = skz;
}

/** Fetch server-authoritative balance and reconcile local state. */
async function reconcileFromServer(): Promise<void> {
  try {
    const res = await apiFetch("/api/user/me");
    if (res.ok) {
      const json = (await res.json()) as { user: Record<string, unknown> };
      const balances = (json.user?.balances ?? {}) as Record<string, number>;
      const serverSkz = balances.SKZ;
      if (typeof serverSkz === "number") {
        confirmedBalance = serverSkz;
        pendingBalance = serverSkz; // discard diverged pending state
      }
    }
  } catch {
    /* network error — will retry on next write */
  }
}

async function flushBalanceEvent(): Promise<void> {
  syncTimer = null;
  if (inflight || pendingBalance === null || confirmedBalance === null) return;
  if (pendingBalance === confirmedBalance) return;
  if (!tgState.inTelegram || !tgState.ready || !tgState.dbUser) return;

  const delta = pendingBalance - confirmedBalance;
  inflight = true;

  try {
    let newConfirmed: number | null = null;

    if (delta > 0) {
      // Credit path: claim at most MAX_CREDIT_PER_NONCE per flush.
      // If there is a larger delta (e.g. daily bonus stacked on game earnings),
      // the residual will trigger another flush after this one completes.
      const claimAmount = Math.min(delta, MAX_CREDIT_PER_NONCE);

      let sessionId = prefetchedSessionId;
      prefetchedSessionId = null; // consume

      if (!sessionId) {
        sessionId = await requestFreshNonce();
      }

      if (!sessionId) {
        // Network error requesting a nonce — retry after a delay.
        inflight = false;
        syncTimer = setTimeout(flushBalanceEvent, 2000);
        return;
      }

      const res = await apiFetch("/api/user/game-result", {
        method: "POST",
        body: JSON.stringify({ sessionId, amount: claimAmount }),
      });

      if (res.ok) {
        const json = (await res.json()) as { skz: number };
        newConfirmed = json.skz;
      } else if (res.status === 400 || res.status === 409) {
        // Hard validation error (nonce invalid, expired, over-cap, etc.).
        // Reconcile from server to learn authoritative balance and break loop.
        await reconcileFromServer();
        // confirmedBalance + pendingBalance already updated by reconcileFromServer.
        return;
      }
      // Other errors (5xx, network): newConfirmed stays null → retry after delay.
    } else {
      // Debit path: no nonce required.
      const res = await apiFetch("/api/user/balance-event", {
        method: "POST",
        body: JSON.stringify({ type: "debit", amount: Math.abs(delta) }),
      });
      if (res.ok) {
        const json = (await res.json()) as { skz: number };
        newConfirmed = json.skz;
      } else if (res.status === 400) {
        // Hard error (e.g. bad amount) — reconcile to break loop.
        await reconcileFromServer();
        return;
      }
    }

    if (newConfirmed !== null) confirmedBalance = newConfirmed;
  } catch {
    /* network error — retry on next write */
  } finally {
    inflight = false;
    if (pendingBalance !== confirmedBalance) {
      syncTimer = setTimeout(flushBalanceEvent, 200);
    }
  }
}

/**
 * Called from writeBalance and the localStorage interceptor in admin-store
 * whenever the balance changes.
 *
 * Queues the desired balance and schedules a debounced flush.
 * The server always determines the authoritative new balance.
 */
export function syncBalanceToServer(newAbsolute: number): void {
  if (!tgState.inTelegram || !tgState.ready || !tgState.dbUser) return;
  if (confirmedBalance === null) return;

  pendingBalance = newAbsolute;

  if (syncTimer !== null) clearTimeout(syncTimer);
  syncTimer = setTimeout(flushBalanceEvent, 500);
}
