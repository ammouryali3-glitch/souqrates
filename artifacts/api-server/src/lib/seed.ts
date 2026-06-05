/**
 * Server-side seed: populates the Postgres DB with demo data on first startup.
 * Called once during server init if the DB is found to be empty.
 */
import { db } from "@workspace/db";
import {
  adminConfigTable,
  appNotificationsTable,
  platformUsersTable,
  depositsTable,
  withdrawalsTable,
  tokenPackagesTable,
  inventoryItemsTable,
  socialTasksTable,
  promoCodesTable,
  broadcastsTable,
  supportTicketsTable,
  referrersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const NOW = Date.now();
const H = 60 * 60 * 1000;
const D = 24 * H;

const FIRST = ["أحمد", "سارة", "محمد", "ليلى", "يوسف", "نور", "خالد", "مريم", "عمر", "هدى", "علي", "رنا", "زياد", "دانا", "طارق", "ميساء", "فادي", "جنى", "سامي", "ريم", "باسل", "لين", "كريم", "تالا"];
const LAST = ["العتيبي", "الحربي", "القحطاني", "السبيعي", "المطيري", "الدوسري", "الزهراني", "الشمري"];

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }

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

function activityFor(i: number): object[] {
  const acts: object[] = [];
  const games = ["Stack & Match", "Knife Master", "Bubble Shooter", "Cipher Rush", "The Detective"];
  for (let k = 0; k < 6; k++) {
    const win = (i + k) % 3 !== 0;
    acts.push({
      id: `${i}-act-${k}`, type: "game", label: pick(games, i + k),
      amount: win ? 140 + ((i + k) % 5) * 60 : -(30 + ((i + k) % 5) * 20),
      currency: "SKZ", at: NOW - k * 3 * H - i * H, result: win ? "win" : "loss",
    });
  }
  acts.push({ id: `${i}-dep`, type: "deposit", label: "إيداع TON", amount: 5, currency: "TON", at: NOW - 2 * D - i * H });
  acts.push({ id: `${i}-buy`, type: "purchase", label: "شراء حزمة SKZ", amount: -10, currency: "USDT", at: NOW - 3 * D - i * H });
  return acts.sort((a: any, b: any) => b.at - a.at);
}

const seedUsers = () => {
  const tiers = ["vip", "gold", "gold", "silver", "silver", "silver", "rookie", "rookie"];
  return Array.from({ length: 24 }, (_, i) => {
    const name = `${pick(FIRST, i)} ${pick(LAST, i)}`;
    const tier = pick(tiers, i);
    const dep = tier === "vip" ? 1200 - i * 7 : tier === "gold" ? 600 - i * 5 : tier === "silver" ? 220 - i * 3 : 40 + i;
    return {
      id: `u${1000 + i}`, name, tgId: String(50000000 + i * 13337),
      username: `@${["sk", "ace", "pro", "win", "zee"][i % 5]}_${1000 + i}`,
      wallet: tonAddr(i), refCode: `SKZ${(i * 9301 + 49297) % 100000}`.padEnd(8, "0").slice(0, 8),
      joinedAt: NOW - (90 - i * 2) * D, lastSeen: NOW - (i % 7) * H - (i % 3) * 10 * 60 * 1000,
      tier,
      balances: { SKZ: 800 + ((i * 137) % 9000), TON: Number((((i * 31) % 50) / 10).toFixed(2)), USDT: Number((((i * 53) % 300)).toFixed(2)) },
      totalDeposit: Math.max(0, dep), totalWins: 12 + ((i * 7) % 180),
      status: i === 17 ? "banned" : "active",
      restrictions: { withdraw: i === 9, play: false, chat: i === 17 },
      flagged: i === 4 || i === 9 || i === 20,
      activity: activityFor(i),
    };
  });
};

const seedDeposits = () => {
  const cur = ["TON", "USDT", "TON", "USDT"];
  return Array.from({ length: 8 }, (_, i) => ({
    id: `dep${i}`, userId: `u${1000 + i * 2}`, userName: `${pick(FIRST, i * 2)} ${pick(LAST, i * 2)}`,
    currency: pick(cur, i), amount: pick(cur, i) === "TON" ? Number((2 + i * 0.7).toFixed(2)) : 10 + i * 15,
    at: NOW - i * 5 * H, status: i < 2 ? "pending" : "confirmed", txHash: txHash(i),
  }));
};

const seedWithdrawals = () => {
  const cur = ["TON", "USDT"];
  return Array.from({ length: 10 }, (_, i) => {
    const currency = pick(cur, i);
    const amount = currency === "TON" ? Number((1 + i * 0.9).toFixed(2)) : 15 + i * 12;
    const usdtEq = currency === "TON" ? amount * 5.2 : amount;
    return {
      id: `wd${i}`, userId: `u${1000 + i}`, userName: `${pick(FIRST, i)} ${pick(LAST, i)}`,
      currency, amount, fee: currency === "TON" ? 0.05 : 1, at: NOW - i * 4 * H,
      status: i < 3 ? "pending" : i === 3 ? "approved" : i === 4 ? "rejected" : "completed",
      wallet: tonAddr(i + 3), auto: usdtEq <= 50,
    };
  });
};

const DEFAULT_CONFIG = {
  settings: {
    shopEnabled: true, arenaEnabled: true, skillEnabled: true, maintenance: false,
    onlineCount: "12.4k", appName: "SKZ Arcade", welcomeMessage: "العب، تنافس، واربح جوائز SKZ",
    accent: "#f5b301", freePlay: false, globalPriceFactor: 1, globalPrizeFactor: 1,
    globalDifficulty: 1, startingBalance: 1000, winnerCut: 0.95, dailyBonus: 0,
    platformRake: 5, tosEnabled: false,
  },
  game_overrides: {},
  ticket_overrides: {},
  cms: {
    welcome: "أهلاً بك في SKZ — العب، اربح، واسحب أرباحك بسهولة!",
    gameHelp: "اختر لعبة، ادفع رسوم الدخول بـ SKZ، وحقّق الهدف لتربح الجائزة.",
    shopTerms: "جميع المنتجات رقمية وتُسلّم تلقائياً بعد الشراء. لا يوجد استرداد.",
    winMessage: "مبروك! لقد ربحت 🎉", lossMessage: "حظ أوفر في المرة القادمة 💪",
    tos: "باستخدامك للتطبيق فإنك توافق على الشروط والأحكام. الألعاب تعتمد على المهارة.",
  },
  finance: {
    autoWithdrawMax: 50, withdrawMin: { SKZ: 1000, TON: 1, USDT: 5 },
    withdrawMax: { SKZ: 100000, TON: 100, USDT: 500 }, dailyMax: { SKZ: 500000, TON: 500, USDT: 2000 },
    gasFee: { SKZ: 0, TON: 0.05, USDT: 1 }, hotWalletCap: 5000, coldWallet: tonAddr(99),
    autoSweep: true, hotWalletBalance: 3820, priceBufferBuy: 3, priceBufferSell: 3, tonPrice: 5.24,
  },
  security: {
    antiDrainEnabled: true, antiDrainHourlyCap: 2000, withdrawalsFrozen: false, multiAccountAuto: false,
  },
  backup: {
    autoBackup: true, intervalHours: 24, destination: "telegram", lastBackupAt: NOW - 6 * H,
  },
  referral_config: {
    levels: [
      { level: 1, enabled: true, commission: 10, currency: "SKZ" },
      { level: 2, enabled: true, commission: 5, currency: "SKZ" },
      { level: 3, enabled: false, commission: 2, currency: "SKZ" },
    ],
    triggers: ["signup", "firstDeposit"],
  },
  daily_checkin: [50, 75, 100, 150, 200, 300, 500],
  api_keys: [
    { id: "k1", label: "Telegram Bot Token", value: "••••••••••••:AAH••••••••••••", updatedAt: NOW - 30 * D },
    { id: "k2", label: "TON API Key", value: "••••••••••••••••••••", updatedAt: NOW - 15 * D },
    { id: "k3", label: "TON Center Endpoint", value: "https://toncenter.com/api/v2", updatedAt: NOW - 15 * D },
  ],
  roles: [
    {
      id: "role_super", name: "Super Admin", handle: "@super_admin",
      role: "owner", color: "#f5b301", active: true,
      permissions: ["users", "games", "economy", "affiliate", "finance", "security", "gamification", "content", "system"],
    },
    {
      id: "role_mod", name: "Moderator", handle: "@moderator",
      role: "moderator", color: "#3b82f6", active: true,
      permissions: ["users", "games", "content", "gamification"],
    },
    {
      id: "role_support", name: "Support", handle: "@support",
      role: "support", color: "#10b981", active: true,
      permissions: ["users"],
    },
  ],
};

const seedTokenPackages = () => [
  { id: "pkg1", skz: 1000, price: 1, currency: "USDT", bonus: 0, active: true },
  { id: "pkg2", skz: 5500, price: 5, currency: "USDT", bonus: 500, active: true, popular: true },
  { id: "pkg3", skz: 12000, price: 10, currency: "USDT", bonus: 2000, active: true },
  { id: "pkg4", skz: 65000, price: 50, currency: "USDT", bonus: 15000, active: true },
  { id: "pkg5", skz: 2000, price: 0.4, currency: "TON", bonus: 100, active: true },
];

const seedSocialTasks = () => [
  { id: "st1", title: "انضم لقناة تيليجرام", platform: "telegram", url: "https://t.me/skz", reward: 200, active: true, completions: 1843 },
  { id: "st2", title: "تابعنا على X", platform: "twitter", url: "https://x.com/skz", reward: 150, active: true, completions: 921 },
  { id: "st3", title: "شارك المنشور", platform: "twitter", url: "https://x.com/skz/post", reward: 100, active: false, completions: 412 },
];

const seedPromoCodes = () => [
  { id: "pc1", code: "WELCOME50", reward: 500, currency: "SKZ", totalUses: 1000, usedCount: 643, perUser: 1, expiry: NOW + 20 * D, active: true },
  { id: "pc2", code: "TON5", reward: 1, currency: "TON", totalUses: 200, usedCount: 200, perUser: 1, expiry: NOW - 2 * D, active: false },
  { id: "pc3", code: "VIP1000", reward: 1000, currency: "SKZ", totalUses: 50, usedCount: 12, perUser: 1, expiry: NOW + 5 * D, active: true },
];

const seedBroadcasts = () => [
  { id: "bc1", title: "عرض نهاية الأسبوع 🎉", body: "ضاعف رصيدك مع كل إيداع اليوم!", audience: "all", scheduledAt: NOW + 6 * H, status: "scheduled", buttonText: "إيداع الآن", buttonUrl: "/wallet", reach: 24310 },
  { id: "bc2", title: "بطولة Cipher Rush", body: "انضم للبطولة الأسبوعية واربح 18K", audience: "active", scheduledAt: NOW - 2 * D, status: "sent", reach: 9120 },
  { id: "bc3", title: "مسودة إعلان", body: "...", audience: "non-depositors", scheduledAt: NOW + 2 * D, status: "draft", reach: 5400 },
];

const seedTickets = () => [
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
];

const seedReferrers = () => {
  const tiers = ["vip", "gold", "gold", "silver", "silver", "rookie"];
  return Array.from({ length: 10 }, (_, i) => {
    const direct = 3 + ((i * 5) % 40);
    return {
      id: `ref${i}`, name: `${pick(FIRST, i + 3)} ${pick(LAST, i + 1)}`,
      refCode: `SKZ${(i * 7919) % 100000}`.slice(0, 8), tier: pick(tiers, i),
      directRefs: direct, totalRefs: direct + ((i * 11) % 60), activeRefs: Math.floor(direct * 0.6),
      earned: 1500 - i * 80 + ((i * 137) % 400),
      children: Array.from({ length: 3 }, (_, k) => ({
        name: `${pick(FIRST, i + k + 5)} ${pick(LAST, i + k)}`,
        refs: (k + 1) * 2 + (i % 4), earned: 200 - k * 40 + (i % 5) * 20,
      })),
    };
  });
};

const seedInventory = () => {
  const cats = ["💻 برمجة", "🎨 تصميم", "🤖 ذكاء اصطناعي", "📊 مالية", "🎓 كورسات"];
  return Array.from({ length: 6 }, (_, i) => {
    const codes = Array.from({ length: i === 2 ? 2 : 5 + i }, (_, k) => `CODE-${i}${k}${(i * 37 + k * 11) % 100}`);
    return {
      id: `inv${i}`,
      title: ["دورة React الشاملة", "حزمة قوالب Figma", "اشتراك ChatGPT Plus", "قالب تحليل مالي", "دورة Python", "حزمة أيقونات"][i],
      category: pick(cats, i), priceSkz: 1500 + i * 500, priceTon: Number((0.3 + i * 0.1).toFixed(2)),
      priceUsdt: 2 + i * 2, stock: codes.length, safeThreshold: 3, codes, active: true,
    };
  });
};

export async function seedDatabaseIfEmpty(): Promise<void> {
  try {
    // Check if DB is already seeded (check config table)
    const existing = await db.select().from(adminConfigTable).limit(1);
    if (existing.length > 0) {
      logger.info("Database already seeded, skipping");
      return;
    }

    logger.info("Seeding database with demo data...");

    // Config blobs
    const configs = Object.entries(DEFAULT_CONFIG);
    for (const [key, value] of configs) {
      await db.insert(adminConfigTable).values({ key, value, updatedAt: new Date() }).onConflictDoNothing();
    }

    // Entity lists
    const users = seedUsers();
    for (const u of users) {
      await db.insert(platformUsersTable).values({ id: u.id, data: u, updatedAt: new Date() }).onConflictDoNothing();
    }

    for (const d of seedDeposits()) {
      const dep = d as any;
      await db.insert(depositsTable).values({ id: dep.id, status: dep.status, data: dep }).onConflictDoNothing();
    }

    for (const w of seedWithdrawals()) {
      const wd = w as any;
      await db.insert(withdrawalsTable).values({ id: wd.id, status: wd.status, data: wd }).onConflictDoNothing();
    }

    for (const p of seedTokenPackages()) {
      await db.insert(tokenPackagesTable).values({ id: p.id, data: p, updatedAt: new Date() }).onConflictDoNothing();
    }

    for (const i of seedInventory()) {
      await db.insert(inventoryItemsTable).values({ id: i.id, data: i, updatedAt: new Date() }).onConflictDoNothing();
    }

    for (const t of seedSocialTasks()) {
      await db.insert(socialTasksTable).values({ id: t.id, data: t, updatedAt: new Date() }).onConflictDoNothing();
    }

    for (const p of seedPromoCodes()) {
      await db.insert(promoCodesTable).values({ id: p.id, data: p, updatedAt: new Date() }).onConflictDoNothing();
    }

    for (const b of seedBroadcasts()) {
      const bc = b as any;
      await db.insert(broadcastsTable).values({ id: bc.id, status: bc.status, data: bc, updatedAt: new Date() }).onConflictDoNothing();
    }

    for (const t of seedTickets()) {
      const tk = t as any;
      await db.insert(supportTicketsTable).values({ id: tk.id, status: tk.status, data: tk, updatedAt: new Date() }).onConflictDoNothing();
    }

    for (const r of seedReferrers()) {
      await db.insert(referrersTable).values({ id: r.id, data: r, updatedAt: new Date() }).onConflictDoNothing();
    }

    logger.info("Database seeded successfully");
  } catch (err) {
    logger.error({ err }, "Database seed failed");
  }
}

/**
 * One-time migration: if the "roles" config row was seeded with the old
 * object-permissions format `{ permissions: { users: true, ... } }`, rewrite
 * it to the canonical AdminRole array format the frontend expects:
 * `{ permissions: string[], handle, role, active }`.
 *
 * Safe to call on every startup — it's a no-op if the data is already correct.
 */
export async function migrateRolesConfigIfNeeded(): Promise<void> {
  try {
    const [row] = await db
      .select()
      .from(adminConfigTable)
      .where(eq(adminConfigTable.key, "roles"))
      .limit(1);

    if (!row) return;

    const roles = row.value as unknown;
    if (!Array.isArray(roles) || roles.length === 0) return;

    const first = roles[0] as Record<string, unknown>;
    // Old format has permissions as a plain object (not array)
    if (Array.isArray(first.permissions)) return; // already correct

    const PERMISSION_MAP: Record<string, string> = {
      users: "users", games: "games", finance: "finance",
      content: "content", system: "system", security: "security",
      affiliate: "affiliate", gamification: "gamification",
    };
    const BASE_ROLE_MAP: Record<string, string> = {
      role_super: "owner", role_mod: "moderator", role_support: "support",
    };
    const HANDLE_MAP: Record<string, string> = {
      role_super: "@super_admin", role_mod: "@moderator", role_support: "@support",
    };

    const migrated = roles.map((r: any) => {
      const oldPerms: Record<string, boolean> = r.permissions ?? {};
      const newPerms = Object.entries(PERMISSION_MAP)
        .filter(([k]) => oldPerms[k] === true)
        .map(([, v]) => v);
      return {
        id: r.id,
        name: r.name,
        handle: r.handle ?? HANDLE_MAP[r.id] ?? `@${r.id}`,
        role: r.role ?? BASE_ROLE_MAP[r.id] ?? "moderator",
        color: r.color,
        active: r.active ?? true,
        permissions: newPerms,
      };
    });

    await db
      .update(adminConfigTable)
      .set({ value: migrated, updatedAt: new Date() })
      .where(eq(adminConfigTable.key, "roles"));

    logger.info("Migrated roles config to canonical AdminRole format");
  } catch (err) {
    logger.error({ err }, "migrateRolesConfigIfNeeded error");
  }
}
