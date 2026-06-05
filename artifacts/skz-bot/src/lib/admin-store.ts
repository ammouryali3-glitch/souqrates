import { useSyncExternalStore } from "react";
import type { Product, Category } from "./shop-products";

// ── Keys ──────────────────────────────────────────────────────────────────────
const ADMIN_KEY = "skz_admin";
const BALANCE_KEY = "skz_balance";
const LIBRARY_KEY = "skz_library";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GameOverride {
  enabled: boolean;
  title?: string;
  tagline?: string;
  prize?: string;
  entry?: number;
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
  shopEnabled: boolean;
  arenaEnabled: boolean;
  skillEnabled: boolean;
  maintenance: boolean;
  onlineCount: string;
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
  const v = parseInt(localStorage.getItem(BALANCE_KEY) || "1000", 10);
  return Number.isFinite(v) ? v : 1000;
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

  // Danger
  resetAll() {
    state = { ...DEFAULT_STATE, settings: { ...DEFAULT_SETTINGS } };
    persist();
    writeBalance(1000);
    clearLibrary();
    emit();
  },
};

export type { Product, Category };
