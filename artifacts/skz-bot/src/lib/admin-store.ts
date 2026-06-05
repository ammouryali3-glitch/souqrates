import { useSyncExternalStore } from "react";
import type { Product, Category } from "./shop-products";

// ── Keys ──────────────────────────────────────────────────────────────────────
const ADMIN_KEY = "skz_admin";
const BALANCE_KEY = "skz_balance";
const LIBRARY_KEY = "skz_library";
const DAILY_KEY = "skz_daily_bonus";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GameOverride {
  enabled: boolean;
  title?: string;
  tagline?: string;
  desc?: string;
  prize?: string; // arena display label
  entry?: number; // arena absolute entry fee
  featured?: boolean; // pin to top of its section
  /** Economy multipliers applied to a game's ticket tiers (and arena fee). */
  priceFactor?: number; // default 1 — scales ticket prices / entry
  prizeFactor?: number; // default 1 — scales ticket prizes
  targetFactor?: number; // default 1 — scales score-to-win (lower = easier)
  timeFactor?: number; // default 1 — scales time limit (higher = more time)
}

export type NotifType = "info" | "success" | "warning" | "promo";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotifType;
  startAt: number; // epoch ms
  endAt: number; // epoch ms
}

export interface AdminSettings {
  // sections
  shopEnabled: boolean;
  arenaEnabled: boolean;
  skillEnabled: boolean;
  maintenance: boolean;
  onlineCount: string;
  // identity / branding
  appName: string;
  welcomeMessage: string;
  accent: string; // hex accent used on the home hero
  // economy (global)
  freePlay: boolean; // all entries cost 0
  globalPriceFactor: number; // default 1 — multiplies every entry/price
  globalPrizeFactor: number; // default 1 — multiplies every prize
  globalDifficulty: number; // default 1 — multiplies every score-to-win
  startingBalance: number; // default 1000 — balance after reset
  winnerCut: number; // default 0.95 — arena winner share of pool
  dailyBonus: number; // default 0 — claimable once per day on home
}

export interface AdminState {
  products: Product[];
  gameOverrides: Record<string, GameOverride>;
  notifications: AppNotification[];
  banned: boolean;
  settings: AdminSettings;
}

const DEFAULT_SETTINGS: AdminSettings = {
  shopEnabled: true,
  arenaEnabled: true,
  skillEnabled: true,
  maintenance: false,
  onlineCount: "12.4k",
  appName: "SKZ Arcade",
  welcomeMessage: "العب، تنافس، واربح جوائز SKZ",
  accent: "#f5b301",
  freePlay: false,
  globalPriceFactor: 1,
  globalPrizeFactor: 1,
  globalDifficulty: 1,
  startingBalance: 1000,
  winnerCut: 0.95,
  dailyBonus: 0,
};

const DEFAULT_STATE: AdminState = {
  products: [],
  gameOverrides: {},
  notifications: [],
  banned: false,
  settings: DEFAULT_SETTINGS,
};

// ── Persistence ───────────────────────────────────────────────────────────────
function load(): AdminState {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<AdminState>;
    return {
      products: Array.isArray(parsed.products) ? parsed.products : [],
      gameOverrides: parsed.gameOverrides ?? {},
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      banned: !!parsed.banned,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

let state: AdminState = load();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function persist() {
  try {
    localStorage.setItem(ADMIN_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}
function update(mut: (s: AdminState) => AdminState) {
  state = mut(state);
  persist();
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot() {
  return state;
}

// ── Public hook ───────────────────────────────────────────────────────────────
export function useAdmin(): AdminState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ── Balance (separate key, shared with games) ─────────────────────────────────
const balListeners = new Set<() => void>();
let balance = readBalanceRaw();

function readBalanceRaw(): number {
  const stored = localStorage.getItem(BALANCE_KEY);
  if (stored === null) {
    // First-ever load: seed from the admin-configured starting balance.
    return DEFAULT_SETTINGS.startingBalance;
  }
  const v = parseInt(stored, 10);
  return Number.isFinite(v) ? v : DEFAULT_SETTINGS.startingBalance;
}
function subscribeBalance(l: () => void) {
  balListeners.add(l);
  return () => balListeners.delete(l);
}
function getBalanceSnapshot() {
  return balance;
}
export function useBalance(): number {
  return useSyncExternalStore(subscribeBalance, getBalanceSnapshot, getBalanceSnapshot);
}
function writeBalance(n: number) {
  balance = Math.max(0, Math.floor(n));
  try {
    localStorage.setItem(BALANCE_KEY, String(balance));
  } catch {
    /* ignore */
  }
  balListeners.forEach((l) => l());
}
/** Re-read from storage in case a game mutated it directly. */
export function syncBalance() {
  const v = readBalanceRaw();
  if (v !== balance) {
    balance = v;
    balListeners.forEach((l) => l());
  }
}

// ── Library helpers ───────────────────────────────────────────────────────────
export function getLibraryIds(): number[] {
  try {
    return JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]");
  } catch {
    return [];
  }
}
export function clearLibrary() {
  try {
    localStorage.setItem(LIBRARY_KEY, "[]");
  } catch {
    /* ignore */
  }
  emit();
}

// ── Active notifications ──────────────────────────────────────────────────────
export function getActiveNotifications(now = Date.now()): AppNotification[] {
  return state.notifications
    .filter((n) => now >= n.startAt && now <= n.endAt)
    .sort((a, b) => b.startAt - a.startAt);
}

function genId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
}

// ── Actions ───────────────────────────────────────────────────────────────────
export const admin = {
  // Products
  addProduct(p: Omit<Product, "id">): Product {
    const id = state.products.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    const created: Product = { ...p, id };
    update((s) => ({ ...s, products: [...s.products, created] }));
    return created;
  },
  updateProduct(id: number, patch: Partial<Product>) {
    update((s) => ({
      ...s,
      products: s.products.map((p) => (p.id === id ? { ...p, ...patch, id } : p)),
    }));
  },
  deleteProduct(id: number) {
    update((s) => ({ ...s, products: s.products.filter((p) => p.id !== id) }));
  },

  // Games
  setGameOverride(id: string, patch: Partial<GameOverride>) {
    update((s) => {
      const prev = s.gameOverrides[id] ?? { enabled: true };
      return { ...s, gameOverrides: { ...s.gameOverrides, [id]: { ...prev, ...patch } } };
    });
  },
  resetGame(id: string) {
    update((s) => {
      const next = { ...s.gameOverrides };
      delete next[id];
      return { ...s, gameOverrides: next };
    });
  },

  // Notifications
  addNotification(n: Omit<AppNotification, "id">): AppNotification {
    const created: AppNotification = { ...n, id: genId() };
    update((s) => ({ ...s, notifications: [created, ...s.notifications] }));
    return created;
  },
  deleteNotification(id: string) {
    update((s) => ({ ...s, notifications: s.notifications.filter((n) => n.id !== id) }));
  },

  // User control
  setBanned(banned: boolean) {
    update((s) => ({ ...s, banned }));
  },

  // Settings
  setSettings(patch: Partial<AdminSettings>) {
    update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },

  // Balance
  setBalance(n: number) {
    writeBalance(n);
  },
  addBalance(n: number) {
    writeBalance(balance + n);
  },
  deductBalance(n: number) {
    writeBalance(balance - n);
  },

  // Daily bonus — claimable once per calendar day. Returns granted amount (0 if none).
  claimDailyBonus(): number {
    const amount = state.settings.dailyBonus;
    if (amount <= 0) return 0;
    const today = new Date().toDateString();
    try {
      if (localStorage.getItem(DAILY_KEY) === today) return 0;
      localStorage.setItem(DAILY_KEY, today);
    } catch {
      /* ignore */
    }
    // Re-read first: a game may have mutated the balance directly since last sync.
    writeBalance(readBalanceRaw() + amount);
    return amount;
  },
  canClaimDailyBonus(): boolean {
    if (state.settings.dailyBonus <= 0) return false;
    try {
      return localStorage.getItem(DAILY_KEY) !== new Date().toDateString();
    } catch {
      return false;
    }
  },

  // Set the live balance to the configured starting balance (no full wipe).
  applyStartingBalance(): number {
    const sb = state.settings.startingBalance;
    writeBalance(sb);
    return sb;
  },

  // Danger
  resetAll() {
    // Keep the admin-configured starting balance; reset everything else to defaults.
    const startingBalance = state.settings.startingBalance;
    state = { ...DEFAULT_STATE, settings: { ...DEFAULT_SETTINGS, startingBalance } };
    persist();
    writeBalance(startingBalance);
    clearLibrary();
    try {
      localStorage.removeItem(DAILY_KEY);
    } catch {
      /* ignore */
    }
    emit();
  },
};

export type { Product, Category };
