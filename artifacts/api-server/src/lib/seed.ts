/**
 * Server-side seed: populates the Postgres DB with default config on first startup.
 * Only seeds admin configuration (settings, cms, finance, etc.) — never fake entity data.
 * Called once during server init if the DB is found to be empty.
 */
import { db } from "@workspace/db";
import { adminConfigTable, adminAccountsTable } from "@workspace/db";
import { eq } from "@workspace/db";
import bcrypt from "bcryptjs";
import { logger } from "./logger";

const NOW = Date.now();
const H = 60 * 60 * 1000;
const D = 24 * H;

function tonAddr(i: number): string {
  const base = "EQAbcdefghijklmnopqrstuvwxyz0123456789ABCDEF";
  let s = "EQ";
  for (let k = 0; k < 46; k++) s += base[(i * 7 + k * 13) % base.length];
  return s;
}

const DEFAULT_CONFIG = {
  settings: {
    shopEnabled: true, arenaEnabled: true, skillEnabled: true, maintenance: false,
    onlineCount: "0", appName: "SKZ Arcade", welcomeMessage: "العب، تنافس، واربح جوائز SKZ",
    accent: "#f5b301", freePlay: false, globalPriceFactor: 1, globalPrizeFactor: 1,
    globalDifficulty: 1, startingBalance: 1000, winnerCut: 0.95, dailyBonus: 0,
    platformRake: 5, tosEnabled: false, botUsername: "",
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
    autoSweep: true, hotWalletBalance: 0, priceBufferBuy: 3, priceBufferSell: 3, tonPrice: 5.24,
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
    { id: "k1", label: "Telegram Bot Token", value: "", updatedAt: NOW - 30 * D },
    { id: "k2", label: "TON API Key", value: "", updatedAt: NOW - 15 * D },
    { id: "k3", label: "TON Center Endpoint", value: "https://toncenter.com/api/v2", updatedAt: NOW - 15 * D },
  ],
  deposit_config: {
    skzPerUsdt: 100,
    skzPerTon: 500,
  },
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

/**
 * Bootstrap the default owner account if no owner exists yet.
 *
 * Safe to call on every startup — it's a no-op once any owner account is
 * present. This guarantees that a freshly deployed (production) database always
 * has a working admin login, since admin_accounts is never populated by config
 * seeding.
 *
 * Default credentials (changeable from the System section after first login):
 *   handle:   @admin
 *   password: Souqrates@2025
 *
 * Override via env: BOOTSTRAP_OWNER_HANDLE / BOOTSTRAP_OWNER_PASSWORD.
 */
export async function ensureOwnerAccount(): Promise<void> {
  try {
    const [existingOwner] = await db
      .select({ id: adminAccountsTable.id })
      .from(adminAccountsTable)
      .where(eq(adminAccountsTable.role, "owner"))
      .limit(1);

    if (existingOwner) {
      logger.info("Owner account already present, skipping bootstrap");
      return;
    }

    // Match the login route's normalization exactly: strip leading @, lowercase,
    // then re-prepend @. A mismatch here makes login silently fail.
    const rawHandle = (process.env.BOOTSTRAP_OWNER_HANDLE ?? "@admin").trim();
    const handle = `@${rawHandle.toLowerCase().replace(/^@+/, "")}`;
    const password = process.env.BOOTSTRAP_OWNER_PASSWORD ?? "Souqrates@2025";

    const passwordHash = await bcrypt.hash(password, 12);

    await db
      .insert(adminAccountsTable)
      .values({
        id: "admin_owner",
        name: "المالك",
        handle,
        role: "owner",
        passwordHash,
        permissions: [],
        active: true,
        // Force password change on first login if the default password is in use.
        // If the operator set BOOTSTRAP_OWNER_PASSWORD, they chose a custom password
        // and we trust they know it — no forced change needed.
        mustChangePassword: !process.env.BOOTSTRAP_OWNER_PASSWORD,
      })
      .onConflictDoNothing();

    // Verify an owner actually exists now (the fixed id could collide with a
    // pre-existing non-owner row, in which case the insert is a no-op).
    const [confirmed] = await db
      .select({ id: adminAccountsTable.id })
      .from(adminAccountsTable)
      .where(eq(adminAccountsTable.role, "owner"))
      .limit(1);

    if (confirmed) {
      logger.info({ handle }, "Bootstrapped default owner account");
    } else {
      logger.error(
        { handle },
        "Owner bootstrap insert was a no-op (id collision?); no owner account exists",
      );
    }
  } catch (err) {
    logger.error({ err }, "ensureOwnerAccount failed");
  }
}

export async function seedDatabaseIfEmpty(): Promise<void> {
  try {
    // Check if DB is already seeded (check config table)
    const existing = await db.select().from(adminConfigTable).limit(1);
    if (existing.length > 0) {
      logger.info("Database already seeded, skipping");
      return;
    }

    logger.info("Seeding database with default config...");

    // Only seed admin configuration — no fake entity data (users, deposits, etc.)
    const configs = Object.entries(DEFAULT_CONFIG);
    for (const [key, value] of configs) {
      await db.insert(adminConfigTable).values({ key, value, updatedAt: new Date() }).onConflictDoNothing();
    }

    logger.info("Database config seeded successfully");
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
