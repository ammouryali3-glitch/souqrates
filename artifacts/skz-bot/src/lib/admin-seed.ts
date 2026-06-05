// Deterministic seed data for the admin dashboard mock.
// All values are illustrative; the dashboard is a UI-only mock over localStorage.

import type {
  AdminRole, ApiKey, BackupSettings, Broadcast, CmsTexts, Deposit, FinanceSettings,
  InventoryItem, ManagedUser, PromoCode, ReferralLevel, Referrer, SecuritySettings,
  SocialTask, SupportTicket, TokenPackage, UserActivity, UserTier, Withdrawal, Currency,
} from "./admin-types";

const NOW = Date.now();
const H = 60 * 60 * 1000;
const D = 24 * H;

const FIRST = ["أحمد", "سارة", "محمد", "ليلى", "يوسف", "نور", "خالد", "مريم", "عمر", "هدى", "علي", "رنا", "زياد", "دانا", "طارق", "ميساء", "فادي", "جنى", "سامي", "ريم", "باسل", "لين", "كريم", "تالا"];
const LAST = ["العتيبي", "الحربي", "القحطاني", "السبيعي", "المطيري", "الدوسري", "الزهراني", "الشمري"];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function tonAddr(i: number): string {
  const base = "EQAbcdefghijklmnopqrstuvwxyz0123456789ABCDEF";
  let s = "EQ";
  for (let k = 0; k < 46; k++) s += base[(i * 7 + k * 13) % base.length];
  return s;
}

function txHash(i: number): string {
  const hex = "0123456789abcdef";
  let s = "";
  for (let k = 0; k < 16; k++) s += hex[(i * 11 + k * 5) % 16];
  return s;
}

function activityFor(i: number, name: string): UserActivity[] {
  const acts: UserActivity[] = [];
  const games = ["Stack & Match", "Knife Master", "Bubble Shooter", "Cipher Rush", "The Detective"];
  for (let k = 0; k < 6; k++) {
    const win = (i + k) % 3 !== 0;
    acts.push({
      id: `${i}-act-${k}`,
      type: "game",
      label: pick(games, i + k),
      amount: win ? 140 + ((i + k) % 5) * 60 : -(30 + ((i + k) % 5) * 20),
      currency: "SKZ",
      at: NOW - k * 3 * H - i * H,
      result: win ? "win" : "loss",
    });
  }
  acts.push({ id: `${i}-dep`, type: "deposit", label: "إيداع TON", amount: 5, currency: "TON", at: NOW - 2 * D - i * H });
  acts.push({ id: `${i}-buy`, type: "purchase", label: "شراء حزمة SKZ", amount: -10, currency: "USDT", at: NOW - 3 * D - i * H });
  return acts.sort((a, b) => b.at - a.at);
}

export function seedUsers(): ManagedUser[] {
  const tiers: UserTier[] = ["vip", "gold", "gold", "silver", "silver", "silver", "rookie", "rookie"];
  return Array.from({ length: 24 }, (_, i) => {
    const name = `${pick(FIRST, i)} ${pick(LAST, i)}`;
    const tier = pick(tiers, i);
    const dep = tier === "vip" ? 1200 - i * 7 : tier === "gold" ? 600 - i * 5 : tier === "silver" ? 220 - i * 3 : 40 + i;
    return {
      id: `u${1000 + i}`,
      name,
      tgId: String(50000000 + i * 13337),
      username: `@${["sk", "ace", "pro", "win", "zee"][i % 5]}_${1000 + i}`,
      wallet: tonAddr(i),
      refCode: `SKZ${(i * 9301 + 49297) % 100000}`.padEnd(8, "0").slice(0, 8),
      joinedAt: NOW - (90 - i * 2) * D,
      lastSeen: NOW - (i % 7) * H - (i % 3) * 10 * 60 * 1000,
      tier,
      balances: {
        SKZ: 800 + ((i * 137) % 9000),
        TON: Number((((i * 31) % 50) / 10).toFixed(2)),
        USDT: Number((((i * 53) % 300)).toFixed(2)),
      },
      totalDeposit: Math.max(0, dep),
      totalWins: 12 + ((i * 7) % 180),
      status: i === 17 ? "banned" : "active",
      restrictions: { withdraw: i === 9, play: false, chat: i === 17 },
      flagged: i === 4 || i === 9 || i === 20,
      activity: activityFor(i, name),
    };
  });
}

export function seedDeposits(): Deposit[] {
  const cur: Currency[] = ["TON", "USDT", "TON", "USDT"];
  return Array.from({ length: 8 }, (_, i) => ({
    id: `dep${i}`,
    userId: `u${1000 + i * 2}`,
    userName: `${pick(FIRST, i * 2)} ${pick(LAST, i * 2)}`,
    currency: pick(cur, i),
    amount: pick(cur, i) === "TON" ? Number((2 + i * 0.7).toFixed(2)) : 10 + i * 15,
    at: NOW - i * 5 * H,
    status: i < 2 ? "pending" : "confirmed",
    txHash: txHash(i),
  }));
}

export function seedWithdrawals(): Withdrawal[] {
  const cur: Currency[] = ["TON", "USDT"];
  return Array.from({ length: 10 }, (_, i) => {
    const currency = pick(cur, i);
    const amount = currency === "TON" ? Number((1 + i * 0.9).toFixed(2)) : 15 + i * 12;
    const usdtEq = currency === "TON" ? amount * 5.2 : amount;
    return {
      id: `wd${i}`,
      userId: `u${1000 + i}`,
      userName: `${pick(FIRST, i)} ${pick(LAST, i)}`,
      currency,
      amount,
      fee: currency === "TON" ? 0.05 : 1,
      at: NOW - i * 4 * H,
      status: i < 3 ? "pending" : i === 3 ? "approved" : i === 4 ? "rejected" : "completed",
      wallet: tonAddr(i + 3),
      auto: usdtEq <= 50,
    };
  });
}

export function seedReferralLevels(): ReferralLevel[] {
  return [
    { level: 1, enabled: true, commission: 10, currency: "SKZ" },
    { level: 2, enabled: true, commission: 5, currency: "SKZ" },
    { level: 3, enabled: false, commission: 2, currency: "SKZ" },
  ];
}

export function seedReferrers(): Referrer[] {
  const tiers: UserTier[] = ["vip", "gold", "gold", "silver", "silver", "rookie"];
  return Array.from({ length: 10 }, (_, i) => {
    const direct = 3 + ((i * 5) % 40);
    return {
      id: `ref${i}`,
      name: `${pick(FIRST, i + 3)} ${pick(LAST, i + 1)}`,
      refCode: `SKZ${(i * 7919) % 100000}`.slice(0, 8),
      tier: pick(tiers, i),
      directRefs: direct,
      totalRefs: direct + ((i * 11) % 60),
      activeRefs: Math.floor(direct * 0.6),
      earned: 1500 - i * 80 + ((i * 137) % 400),
      children: Array.from({ length: 3 }, (_, k) => ({
        name: `${pick(FIRST, i + k + 5)} ${pick(LAST, i + k)}`,
        refs: (k + 1) * 2 + (i % 4),
        earned: 200 - k * 40 + (i % 5) * 20,
      })),
    };
  });
}

export function seedTokenPackages(): TokenPackage[] {
  return [
    { id: "pkg1", skz: 1000, price: 1, currency: "USDT", bonus: 0, active: true },
    { id: "pkg2", skz: 5500, price: 5, currency: "USDT", bonus: 500, active: true, popular: true },
    { id: "pkg3", skz: 12000, price: 10, currency: "USDT", bonus: 2000, active: true },
    { id: "pkg4", skz: 65000, price: 50, currency: "USDT", bonus: 15000, active: true },
    { id: "pkg5", skz: 2000, price: 0.4, currency: "TON", bonus: 100, active: true },
  ];
}

export function seedInventory(): InventoryItem[] {
  const cats = ["💻 برمجة", "🎨 تصميم", "🤖 ذكاء اصطناعي", "📊 مالية", "🎓 كورسات"];
  return Array.from({ length: 6 }, (_, i) => {
    const codes = Array.from({ length: i === 2 ? 2 : 5 + i }, (_, k) => `CODE-${i}${k}${(i * 37 + k * 11) % 100}`);
    return {
      id: `inv${i}`,
      title: ["دورة React الشاملة", "حزمة قوالب Figma", "اشتراك ChatGPT Plus", "قالب تحليل مالي", "دورة Python", "حزمة أيقونات"][i],
      category: pick(cats, i),
      priceSkz: 1500 + i * 500,
      priceTon: Number((0.3 + i * 0.1).toFixed(2)),
      priceUsdt: 2 + i * 2,
      stock: codes.length,
      safeThreshold: 3,
      codes,
      active: true,
    };
  });
}

export function seedSocialTasks(): SocialTask[] {
  return [
    { id: "st1", title: "انضم لقناة تيليجرام", platform: "telegram", url: "https://t.me/skz", reward: 200, active: true, completions: 1843 },
    { id: "st2", title: "تابعنا على X", platform: "twitter", url: "https://x.com/skz", reward: 150, active: true, completions: 921 },
    { id: "st3", title: "شارك المنشور", platform: "twitter", url: "https://x.com/skz/post", reward: 100, active: false, completions: 412 },
  ];
}

export function seedPromoCodes(): PromoCode[] {
  return [
    { id: "pc1", code: "WELCOME50", reward: 500, currency: "SKZ", totalUses: 1000, usedCount: 643, perUser: 1, expiry: NOW + 20 * D, active: true },
    { id: "pc2", code: "TON5", reward: 1, currency: "TON", totalUses: 200, usedCount: 200, perUser: 1, expiry: NOW - 2 * D, active: false },
    { id: "pc3", code: "VIP1000", reward: 1000, currency: "SKZ", totalUses: 50, usedCount: 12, perUser: 1, expiry: NOW + 5 * D, active: true },
  ];
}

export function seedBroadcasts(): Broadcast[] {
  return [
    { id: "bc1", title: "عرض نهاية الأسبوع 🎉", body: "ضاعف رصيدك مع كل إيداع اليوم!", audience: "all", scheduledAt: NOW + 6 * H, status: "scheduled", buttonText: "إيداع الآن", buttonUrl: "/wallet", reach: 24310 },
    { id: "bc2", title: "بطولة Cipher Rush", body: "انضم للبطولة الأسبوعية واربح 18K", audience: "active", scheduledAt: NOW - 2 * D, status: "sent", reach: 9120 },
    { id: "bc3", title: "مسودة إعلان", body: "...", audience: "non-depositors", scheduledAt: NOW + 2 * D, status: "draft", reach: 5400 },
  ];
}

export function seedTickets(): SupportTicket[] {
  return [
    {
      id: "tk1", userId: "u1003", userName: `${pick(FIRST, 3)} ${pick(LAST, 3)}`, subject: "لم يصل السحب",
      status: "open", updatedAt: NOW - 2 * H,
      messages: [{ from: "user", text: "طلبت سحب 5 TON قبل ساعتين ولم يصل.", at: NOW - 2 * H }],
    },
    {
      id: "tk2", userId: "u1007", userName: `${pick(FIRST, 7)} ${pick(LAST, 7)}`, subject: "كود غير صالح",
      status: "answered", updatedAt: NOW - 8 * H,
      messages: [
        { from: "user", text: "اشتريت دورة ولم يصل الكود.", at: NOW - 10 * H },
        { from: "admin", text: "تم إرسال الكود لبريدك، يرجى التحقق.", at: NOW - 8 * H },
      ],
    },
    {
      id: "tk3", userId: "u1011", userName: `${pick(FIRST, 11)} ${pick(LAST, 11)}`, subject: "استفسار عن الإحالة",
      status: "closed", updatedAt: NOW - 2 * D,
      messages: [{ from: "user", text: "كيف أحصل على عمولة المستوى الثاني؟", at: NOW - 2 * D }],
    },
  ];
}

export function seedRoles(): AdminRole[] {
  return [
    { id: "r1", name: "المالك", handle: "@owner", role: "owner", permissions: [], active: true },
    { id: "r2", name: "الدعم الفني", handle: "@support_skz", role: "support", permissions: ["users", "content"], active: true },
    { id: "r3", name: "المحاسب", handle: "@finance_skz", role: "accountant", permissions: ["finance", "economy"], active: true },
    { id: "r4", name: "مشرف", handle: "@mod_skz", role: "moderator", permissions: ["users", "security"], active: false },
  ];
}

export function seedApiKeys(): ApiKey[] {
  return [
    { id: "k1", label: "Telegram Bot Token", value: "••••••••••••:AAH••••••••••••", updatedAt: NOW - 30 * D },
    { id: "k2", label: "TON API Key", value: "••••••••••••••••••••", updatedAt: NOW - 15 * D },
    { id: "k3", label: "TON Center Endpoint", value: "https://toncenter.com/api/v2", updatedAt: NOW - 15 * D },
  ];
}

export function seedCmsTexts(): CmsTexts {
  return {
    welcome: "أهلاً بك في SKZ — العب، اربح، واسحب أرباحك بسهولة!",
    gameHelp: "اختر لعبة، ادفع رسوم الدخول بـ SKZ، وحقّق الهدف لتربح الجائزة.",
    shopTerms: "جميع المنتجات رقمية وتُسلّم تلقائياً بعد الشراء. لا يوجد استرداد.",
    winMessage: "مبروك! لقد ربحت 🎉",
    lossMessage: "حظ أوفر في المرة القادمة 💪",
    tos: "باستخدامك للتطبيق فإنك توافق على الشروط والأحكام. الألعاب تعتمد على المهارة.",
  };
}

export function seedFinanceSettings(): FinanceSettings {
  return {
    autoWithdrawMax: 50,
    withdrawMin: { SKZ: 1000, TON: 1, USDT: 5 },
    withdrawMax: { SKZ: 100000, TON: 100, USDT: 500 },
    dailyMax: { SKZ: 500000, TON: 500, USDT: 2000 },
    gasFee: { SKZ: 0, TON: 0.05, USDT: 1 },
    hotWalletCap: 5000,
    coldWallet: tonAddr(99),
    autoSweep: true,
    hotWalletBalance: 3820,
    priceBufferBuy: 3,
    priceBufferSell: 3,
    tonPrice: 5.24,
  };
}

export function seedSecuritySettings(): SecuritySettings {
  return {
    antiDrainEnabled: true,
    antiDrainHourlyCap: 2000,
    withdrawalsFrozen: false,
    multiAccountAuto: false,
  };
}

export function seedBackupSettings(): BackupSettings {
  return {
    autoBackup: true,
    intervalHours: 24,
    destination: "telegram",
    lastBackupAt: NOW - 6 * H,
  };
}
