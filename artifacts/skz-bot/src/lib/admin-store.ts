import { useSyncExternalStore } from "react";
import type { Product, Category } from "./shop-products";
import type {
  AdminRole, ApiKey, BackupSettings, Broadcast, CmsTexts, Currency, Deposit,
  FinanceSettings, InventoryItem, ManagedUser, PromoCode, ReferralLevel,
  ReferralTrigger, Referrer, SecuritySettings, SocialTask, SupportTicket,
  TicketMsg, TokenPackage, Withdrawal,
} from "./admin-types";
import {
  seedApiKeys, seedBackupSettings, seedBroadcasts, seedCmsTexts, seedDeposits,
  seedFinanceSettings, seedInventory, seedPromoCodes, seedReferralLevels,
  seedReferrers, seedRoles, seedSecuritySettings, seedSocialTasks, seedTickets,
  seedTokenPackages, seedUsers, seedWithdrawals,
} from "./admin-seed";

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
  entryCurrency?: Currency; // currency charged for entry (default SKZ)
  mode?: "pvp" | "pve"; // competitive (player-vs-player pool) or solo (player-vs-environment)
  matchmaking?: string; // free-text matchmaking notes (pool size, bracketing, etc.)
  featured?: boolean; // pin to top of its section
  /** Economy multipliers applied to a game's ticket tiers (and arena fee). */
  priceFactor?: number; // default 1 — scales ticket prices / entry
  prizeFactor?: number; // default 1 — scales ticket prizes
  targetFactor?: number; // default 1 — scales score-to-win (lower = easier)
  timeFactor?: number; // default 1 — scales time limit (higher = more time)
  /** Per-game rake / house cut percentage (overrides global platformRake). */
  rake?: number;
}

/** Absolute per-ticket override values (replace the game's defaults when set). */
export interface TicketPatch {
  price?: number;
  prize?: number;
  target?: number;
  time?: number;
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
  // platform economy
  platformRake: number; // default house cut % across games
  // legal
  tosEnabled: boolean; // show terms acceptance gate
}

export interface AdminState {
  products: Product[];
  gameOverrides: Record<string, GameOverride>;
  /** Per-game, per-ticket absolute overrides: ticketOverrides[gameId][ticketId] */
  ticketOverrides: Record<string, Record<string, TicketPatch>>;
  notifications: AppNotification[];
  banned: boolean;
  settings: AdminSettings;
  // ── Web dashboard slices (mock data) ──
  users: ManagedUser[];
  deposits: Deposit[];
  withdrawals: Withdrawal[];
  referralLevels: ReferralLevel[];
  referralTriggers: ReferralTrigger[];
  referrers: Referrer[];
  tokenPackages: TokenPackage[];
  inventory: InventoryItem[];
  socialTasks: SocialTask[];
  dailyCheckin: number[]; // 7-day reward ladder
  promoCodes: PromoCode[];
  broadcasts: Broadcast[];
  tickets: SupportTicket[];
  roles: AdminRole[];
  apiKeys: ApiKey[];
  cms: CmsTexts;
  finance: FinanceSettings;
  security: SecuritySettings;
  backup: BackupSettings;
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
  platformRake: 5,
  tosEnabled: false,
};

const DEFAULT_CHECKIN = [50, 75, 100, 150, 200, 300, 500];

function freshSlices() {
  return {
    users: seedUsers(),
    deposits: seedDeposits(),
    withdrawals: seedWithdrawals(),
    referralLevels: seedReferralLevels(),
    referralTriggers: ["signup", "firstDeposit"] as ReferralTrigger[],
    referrers: seedReferrers(),
    tokenPackages: seedTokenPackages(),
    inventory: seedInventory(),
    socialTasks: seedSocialTasks(),
    dailyCheckin: [...DEFAULT_CHECKIN],
    promoCodes: seedPromoCodes(),
    broadcasts: seedBroadcasts(),
    tickets: seedTickets(),
    roles: seedRoles(),
    apiKeys: seedApiKeys(),
    cms: seedCmsTexts(),
    finance: seedFinanceSettings(),
    security: seedSecuritySettings(),
    backup: seedBackupSettings(),
  };
}

function defaultState(): AdminState {
  return {
    products: [],
    gameOverrides: {},
    ticketOverrides: {},
    notifications: [],
    banned: false,
    settings: DEFAULT_SETTINGS,
    ...freshSlices(),
  };
}

// ── Persistence ───────────────────────────────────────────────────────────────
function load(): AdminState {
  const seeded = freshSlices();
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<AdminState>;
    return {
      products: Array.isArray(parsed.products) ? parsed.products : [],
      gameOverrides: parsed.gameOverrides ?? {},
      ticketOverrides: parsed.ticketOverrides ?? {},
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      banned: !!parsed.banned,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      users: parsed.users ?? seeded.users,
      deposits: parsed.deposits ?? seeded.deposits,
      withdrawals: parsed.withdrawals ?? seeded.withdrawals,
      referralLevels: parsed.referralLevels ?? seeded.referralLevels,
      referralTriggers: parsed.referralTriggers ?? seeded.referralTriggers,
      referrers: parsed.referrers ?? seeded.referrers,
      tokenPackages: parsed.tokenPackages ?? seeded.tokenPackages,
      inventory: parsed.inventory ?? seeded.inventory,
      socialTasks: parsed.socialTasks ?? seeded.socialTasks,
      dailyCheckin: Array.isArray(parsed.dailyCheckin) ? parsed.dailyCheckin : seeded.dailyCheckin,
      promoCodes: parsed.promoCodes ?? seeded.promoCodes,
      broadcasts: parsed.broadcasts ?? seeded.broadcasts,
      tickets: parsed.tickets ?? seeded.tickets,
      roles: parsed.roles ?? seeded.roles,
      apiKeys: parsed.apiKeys ?? seeded.apiKeys,
      cms: { ...seeded.cms, ...(parsed.cms ?? {}) },
      finance: { ...seeded.finance, ...(parsed.finance ?? {}) },
      security: { ...seeded.security, ...(parsed.security ?? {}) },
      backup: { ...seeded.backup, ...(parsed.backup ?? {}) },
    };
  } catch {
    return defaultState();
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

/**
 * Non-reactive: fraction of an arena entry fee that flows into the prize pool
 * after the house cut (rake). Per-game `rake` overrides the global
 * `settings.platformRake`. Used by `arena.addEntry` outside React.
 */
export function getPoolShare(gameId: string): number {
  const o = state.gameOverrides[gameId];
  const rakePct = typeof o?.rake === "number" ? o.rake : state.settings.platformRake;
  return Math.min(1, Math.max(0, 1 - rakePct / 100));
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
      const nextTickets = { ...s.ticketOverrides };
      delete nextTickets[id];
      return { ...s, gameOverrides: next, ticketOverrides: nextTickets };
    });
  },

  // Per-ticket economy — set one absolute field for one tier of one game.
  setTicketField(gameId: string, ticketId: string, field: keyof TicketPatch, value: number) {
    update((s) => {
      const game = s.ticketOverrides[gameId] ?? {};
      const tier = game[ticketId] ?? {};
      return {
        ...s,
        ticketOverrides: {
          ...s.ticketOverrides,
          [gameId]: { ...game, [ticketId]: { ...tier, [field]: value } },
        },
      };
    });
  },
  // Clear a single overridden field (revert that field to the game default).
  clearTicketField(gameId: string, ticketId: string, field: keyof TicketPatch) {
    update((s) => {
      const game = s.ticketOverrides[gameId];
      if (!game || !game[ticketId]) return s;
      const tier = { ...game[ticketId] };
      delete tier[field];
      const nextGame = { ...game, [ticketId]: tier };
      if (Object.keys(tier).length === 0) delete nextGame[ticketId];
      const nextTickets = { ...s.ticketOverrides, [gameId]: nextGame };
      if (Object.keys(nextGame).length === 0) delete nextTickets[gameId];
      return { ...s, ticketOverrides: nextTickets };
    });
  },
  // Revert all tiers of a game to their defaults.
  resetGameTickets(gameId: string) {
    update((s) => {
      const next = { ...s.ticketOverrides };
      delete next[gameId];
      return { ...s, ticketOverrides: next };
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

  // User control (mini-app player ban — kept for backwards compat)
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

  // ── Users ──────────────────────────────────────────────────────────────────
  updateUser(id: string, patch: Partial<ManagedUser>) {
    update((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? { ...u, ...patch, id } : u)) }));
  },
  setUserStatus(id: string, status: ManagedUser["status"]) {
    update((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? { ...u, status } : u)) }));
  },
  setUserRestriction(id: string, key: keyof ManagedUser["restrictions"], value: boolean) {
    update((s) => ({
      ...s,
      users: s.users.map((u) => (u.id === id ? { ...u, restrictions: { ...u.restrictions, [key]: value } } : u)),
    }));
  },
  setUserFlag(id: string, flagged: boolean) {
    update((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? { ...u, flagged } : u)) }));
  },
  adjustUserBalance(id: string, currency: Currency, delta: number) {
    update((s) => ({
      ...s,
      users: s.users.map((u) =>
        u.id === id ? { ...u, balances: { ...u.balances, [currency]: Math.max(0, (u.balances[currency] ?? 0) + delta) } } : u,
      ),
    }));
  },
  setUserTier(id: string, tier: ManagedUser["tier"]) {
    update((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? { ...u, tier } : u)) }));
  },

  // ── Finance: deposits & withdrawals ─────────────────────────────────────────
  setDepositStatus(id: string, status: Deposit["status"]) {
    update((s) => ({ ...s, deposits: s.deposits.map((d) => (d.id === id ? { ...d, status } : d)) }));
  },
  setWithdrawalStatus(id: string, status: Withdrawal["status"]) {
    update((s) => ({ ...s, withdrawals: s.withdrawals.map((w) => (w.id === id ? { ...w, status } : w)) }));
  },
  approveAllAutoWithdrawals() {
    update((s) => ({
      ...s,
      withdrawals: s.withdrawals.map((w) => (w.status === "pending" && w.auto ? { ...w, status: "approved" } : w)),
    }));
  },
  setFinance(patch: Partial<FinanceSettings>) {
    update((s) => ({ ...s, finance: { ...s.finance, ...patch } }));
  },
  sweepHotWallet() {
    update((s) => ({ ...s, finance: { ...s.finance, hotWalletBalance: Math.min(s.finance.hotWalletBalance, s.finance.hotWalletCap) } }));
  },

  // ── Security ─────────────────────────────────────────────────────────────────
  setSecurity(patch: Partial<SecuritySettings>) {
    update((s) => ({ ...s, security: { ...s.security, ...patch } }));
  },

  // ── Affiliate ────────────────────────────────────────────────────────────────
  setReferralLevel(level: number, patch: Partial<ReferralLevel>) {
    update((s) => ({
      ...s,
      referralLevels: s.referralLevels.map((l) => (l.level === level ? { ...l, ...patch } : l)),
    }));
  },
  toggleReferralTrigger(t: ReferralTrigger) {
    update((s) => ({
      ...s,
      referralTriggers: s.referralTriggers.includes(t)
        ? s.referralTriggers.filter((x) => x !== t)
        : [...s.referralTriggers, t],
    }));
  },

  // ── Token packages ───────────────────────────────────────────────────────────
  addTokenPackage(p: Omit<TokenPackage, "id">): TokenPackage {
    const created: TokenPackage = { ...p, id: genId() };
    update((s) => ({ ...s, tokenPackages: [...s.tokenPackages, created] }));
    return created;
  },
  updateTokenPackage(id: string, patch: Partial<TokenPackage>) {
    update((s) => ({ ...s, tokenPackages: s.tokenPackages.map((p) => (p.id === id ? { ...p, ...patch, id } : p)) }));
  },
  deleteTokenPackage(id: string) {
    update((s) => ({ ...s, tokenPackages: s.tokenPackages.filter((p) => p.id !== id) }));
  },

  // ── Inventory ────────────────────────────────────────────────────────────────
  addInventory(i: Omit<InventoryItem, "id">): InventoryItem {
    const created: InventoryItem = { ...i, id: genId() };
    update((s) => ({ ...s, inventory: [...s.inventory, created] }));
    return created;
  },
  updateInventory(id: string, patch: Partial<InventoryItem>) {
    update((s) => ({
      ...s,
      inventory: s.inventory.map((i) => {
        if (i.id !== id) return i;
        const merged = { ...i, ...patch, id };
        if (patch.codes) merged.stock = patch.codes.length;
        return merged;
      }),
    }));
  },
  deleteInventory(id: string) {
    update((s) => ({ ...s, inventory: s.inventory.filter((i) => i.id !== id) }));
  },

  // ── Social tasks ─────────────────────────────────────────────────────────────
  addSocialTask(t: Omit<SocialTask, "id">): SocialTask {
    const created: SocialTask = { ...t, id: genId() };
    update((s) => ({ ...s, socialTasks: [...s.socialTasks, created] }));
    return created;
  },
  updateSocialTask(id: string, patch: Partial<SocialTask>) {
    update((s) => ({ ...s, socialTasks: s.socialTasks.map((t) => (t.id === id ? { ...t, ...patch, id } : t)) }));
  },
  deleteSocialTask(id: string) {
    update((s) => ({ ...s, socialTasks: s.socialTasks.filter((t) => t.id !== id) }));
  },

  // ── Daily check-in ───────────────────────────────────────────────────────────
  setCheckinDay(index: number, value: number) {
    update((s) => ({ ...s, dailyCheckin: s.dailyCheckin.map((v, i) => (i === index ? Math.max(0, value) : v)) }));
  },

  // ── Promo codes ──────────────────────────────────────────────────────────────
  addPromoCode(p: Omit<PromoCode, "id" | "usedCount">): PromoCode {
    const created: PromoCode = { ...p, id: genId(), usedCount: 0 };
    update((s) => ({ ...s, promoCodes: [created, ...s.promoCodes] }));
    return created;
  },
  updatePromoCode(id: string, patch: Partial<PromoCode>) {
    update((s) => ({ ...s, promoCodes: s.promoCodes.map((p) => (p.id === id ? { ...p, ...patch, id } : p)) }));
  },
  deletePromoCode(id: string) {
    update((s) => ({ ...s, promoCodes: s.promoCodes.filter((p) => p.id !== id) }));
  },

  // ── Broadcasts ───────────────────────────────────────────────────────────────
  addBroadcast(b: Omit<Broadcast, "id">): Broadcast {
    const created: Broadcast = { ...b, id: genId() };
    update((s) => ({ ...s, broadcasts: [created, ...s.broadcasts] }));
    return created;
  },
  updateBroadcast(id: string, patch: Partial<Broadcast>) {
    update((s) => ({ ...s, broadcasts: s.broadcasts.map((b) => (b.id === id ? { ...b, ...patch, id } : b)) }));
  },
  deleteBroadcast(id: string) {
    update((s) => ({ ...s, broadcasts: s.broadcasts.filter((b) => b.id !== id) }));
  },

  // ── Support tickets ──────────────────────────────────────────────────────────
  replyTicket(id: string, text: string) {
    const msg: TicketMsg = { from: "admin", text, at: Date.now() };
    update((s) => ({
      ...s,
      tickets: s.tickets.map((t) =>
        t.id === id ? { ...t, messages: [...t.messages, msg], status: "answered", updatedAt: Date.now() } : t,
      ),
    }));
  },
  setTicketStatus(id: string, status: SupportTicket["status"]) {
    update((s) => ({ ...s, tickets: s.tickets.map((t) => (t.id === id ? { ...t, status, updatedAt: Date.now() } : t)) }));
  },

  // ── CMS texts ────────────────────────────────────────────────────────────────
  setCms(patch: Partial<CmsTexts>) {
    update((s) => ({ ...s, cms: { ...s.cms, ...patch } }));
  },

  // ── Roles ────────────────────────────────────────────────────────────────────
  addRole(r: Omit<AdminRole, "id">): AdminRole {
    const created: AdminRole = { ...r, id: genId() };
    update((s) => ({ ...s, roles: [...s.roles, created] }));
    return created;
  },
  updateRole(id: string, patch: Partial<AdminRole>) {
    update((s) => ({ ...s, roles: s.roles.map((r) => (r.id === id ? { ...r, ...patch, id } : r)) }));
  },
  deleteRole(id: string) {
    update((s) => ({ ...s, roles: s.roles.filter((r) => r.id !== id) }));
  },

  // ── API keys / backup ────────────────────────────────────────────────────────
  updateApiKey(id: string, value: string) {
    update((s) => ({ ...s, apiKeys: s.apiKeys.map((k) => (k.id === id ? { ...k, value, updatedAt: Date.now() } : k)) }));
  },
  setBackup(patch: Partial<BackupSettings>) {
    update((s) => ({ ...s, backup: { ...s.backup, ...patch } }));
  },
  runBackupNow() {
    update((s) => ({ ...s, backup: { ...s.backup, lastBackupAt: Date.now() } }));
  },

  // Danger
  resetAll() {
    // Keep the admin-configured starting balance; reset everything else to defaults.
    const startingBalance = state.settings.startingBalance;
    state = { ...defaultState(), settings: { ...DEFAULT_SETTINGS, startingBalance } };
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
