// Shared domain types for the full web admin dashboard.
// Kept separate from admin-store to avoid a giant file and to let section
// pages import types without pulling the whole store.

export type Currency = "SKZ" | "TON" | "USDT";
export const CURRENCIES: Currency[] = ["SKZ", "TON", "USDT"];

export type UserTier = "rookie" | "silver" | "gold" | "vip";

export const TIER_LABEL: Record<UserTier, string> = {
  rookie: "مبتدئ",
  silver: "فضي",
  gold: "ذهبي",
  vip: "VIP",
};

export interface UserActivity {
  id: string;
  type: "game" | "purchase" | "deposit" | "withdraw" | "login";
  label: string;
  amount?: number;
  currency?: Currency;
  at: number;
  result?: "win" | "loss";
}

export interface ManagedUser {
  id: string;
  name: string;
  tgId: string; // telegram numeric id
  username: string; // @handle
  wallet: string; // TON address
  refCode: string;
  joinedAt: number;
  lastSeen: number;
  tier: UserTier;
  balances: Record<Currency, number>;
  totalDeposit: number; // USDT-equivalent, used for "top depositor" ranking
  totalWins: number; // count of wins, used for "top winner" ranking
  status: "active" | "banned";
  restrictions: { withdraw: boolean; play: boolean; chat: boolean };
  flagged: boolean; // suspicious / multi-account
  activity: UserActivity[];
}

export interface Deposit {
  id: string;
  userId: string;
  userName: string;
  currency: Currency;
  amount: number;
  at: number;
  status: "pending" | "confirmed";
  txHash: string;
}

export interface Withdrawal {
  id: string;
  userId: string;
  userName: string;
  currency: Currency;
  amount: number;
  fee: number;
  at: number;
  status: "pending" | "approved" | "rejected" | "completed";
  wallet: string;
  auto: boolean; // queued for auto-approval (small amount)
}

export interface ReferralLevel {
  level: number; // 1,2,3
  enabled: boolean;
  commission: number; // percent
  currency: Currency;
}

export type ReferralTrigger = "signup" | "firstDeposit" | "recurring";

export interface Referrer {
  id: string;
  name: string;
  refCode: string;
  tier: UserTier;
  directRefs: number;
  totalRefs: number; // whole downline
  activeRefs: number;
  earned: number; // SKZ earned in commissions
  children: { name: string; refs: number; earned: number }[];
}

export interface TokenPackage {
  id: string;
  skz: number;
  price: number;
  currency: Currency;
  bonus: number; // extra SKZ granted
  active: boolean;
  popular?: boolean;
}

export interface InventoryItem {
  id: string;
  title: string;
  category: string;
  priceSkz: number;
  priceTon: number;
  priceUsdt: number;
  stock: number; // derived from codes length but stored for display
  safeThreshold: number; // low-stock alert level
  codes: string[]; // delivered automatically on purchase
  active: boolean;
}

export interface SocialTask {
  id: string;
  title: string;
  platform: "telegram" | "twitter" | "other";
  url: string;
  reward: number; // SKZ
  active: boolean;
  completions: number;
}

export interface PromoCode {
  id: string;
  code: string;
  reward: number;
  currency: Currency;
  totalUses: number;
  usedCount: number;
  perUser: number;
  expiry: number; // epoch ms
  active: boolean;
}

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  media?: string; // image url
  audience: "all" | "non-depositors" | "active" | "vip";
  scheduledAt: number;
  status: "scheduled" | "sent" | "draft";
  buttonText?: string;
  buttonUrl?: string;
  reach: number; // estimated recipients
}

export interface TicketMsg {
  from: "user" | "admin";
  text: string;
  at: number;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  status: "open" | "answered" | "closed";
  messages: TicketMsg[];
  updatedAt: number;
}

export type Permission =
  | "users"
  | "games"
  | "economy"
  | "affiliate"
  | "finance"
  | "security"
  | "gamification"
  | "content"
  | "system";

export const ALL_PERMISSIONS: Permission[] = [
  "users", "games", "economy", "affiliate", "finance",
  "security", "gamification", "content", "system",
];

export interface AdminRole {
  id: string;
  name: string;
  handle: string;
  role: "owner" | "support" | "accountant" | "moderator";
  permissions: Permission[]; // "owner" implicitly has all
  active: boolean;
  password?: string; // hashed via btoa for storage (plaintext comparison in proto)
}

export interface ApiKey {
  id: string;
  label: string;
  value: string; // stored masked-ish; this is a mock
  updatedAt: number;
}

export interface CmsTexts {
  welcome: string;
  gameHelp: string;
  shopTerms: string;
  winMessage: string;
  lossMessage: string;
  tos: string;
}

export interface ContactInfo {
  email: string;
  supportEmail: string;
  phone: string;
  address: string;
  telegramChannel: string;
  telegramSupport: string;
  twitter: string;
  instagram: string;
  workingHours: string;
}

export interface PolicyTexts {
  privacyPolicy: string;
  termsOfService: string;
  refundPolicy: string;
}

export interface FinanceSettings {
  autoWithdrawMax: number; // USDT-eq threshold for instant auto-approval
  withdrawMin: Record<Currency, number>;
  withdrawMax: Record<Currency, number>; // per-operation
  dailyMax: Record<Currency, number>;
  gasFee: Record<Currency, number>;
  hotWalletCap: number; // USDT — overflow auto-swept to cold wallet
  coldWallet: string;
  autoSweep: boolean;
  hotWalletBalance: number; // simulated current hot-wallet USDT balance
  priceBufferBuy: number; // percent added on buy
  priceBufferSell: number; // percent removed on sell
  tonPrice: number; // simulated live TON/USDT
}

export interface SecuritySettings {
  antiDrainEnabled: boolean;
  antiDrainHourlyCap: number; // USDT in one hour before auto-freeze
  withdrawalsFrozen: boolean;
  multiAccountAuto: boolean; // auto-restrict detected multi-accounts
}

export interface BackupSettings {
  autoBackup: boolean;
  intervalHours: number;
  destination: "telegram" | "cloud";
  lastBackupAt: number;
}
