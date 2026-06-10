/**
 * Server-side seed: populates the Postgres DB with default config on first startup.
 * Only seeds admin configuration (settings, cms, finance, etc.) — never fake entity data.
 * Called once during server init if the DB is found to be empty.
 */
import { db } from "@workspace/db";
import { adminConfigTable, adminAccountsTable, shopProductsTable } from "@workspace/db";
import { eq, sql } from "@workspace/db";
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
 * Ensures the admin tables (admin_accounts, admin_config) exist in the database.
 * Uses CREATE TABLE IF NOT EXISTS so it is safe to call on every startup.
 * This is the self-healing guard for production databases that were deployed
 * before the admin schema migration ran — it creates the tables in-process
 * using only the existing DATABASE_URL connection, with no external tooling.
 */
export async function ensureAdminSchema(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_accounts (
        id                  text        PRIMARY KEY,
        name                text        NOT NULL,
        handle              text        NOT NULL UNIQUE,
        role                text        NOT NULL,
        password_hash       text        NOT NULL,
        permissions         text[]      NOT NULL DEFAULT '{}',
        active              boolean     NOT NULL DEFAULT true,
        must_change_password boolean    NOT NULL DEFAULT true,
        created_at          timestamptz NOT NULL DEFAULT now(),
        updated_at          timestamptz NOT NULL DEFAULT now()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_config (
        key        text        PRIMARY KEY,
        value      jsonb       NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    logger.info("ensureAdminSchema: tables verified");
  } catch (err) {
    logger.error({ err }, "ensureAdminSchema failed");
  }
}

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
 * Ensures performance indexes that cannot be expressed in the Drizzle schema DSL.
 * Functional (expression) indexes on JSONB columns must be created via raw SQL.
 * Safe to call on every startup — CREATE INDEX IF NOT EXISTS is a no-op when
 * the index already exists.
 */
export async function ensureIndexes(): Promise<void> {
  try {
    // Functional indexes on deposits/withdrawals userId for O(log n) user history lookups.
    // Without these, every wallet history query does a full table scan.
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS deposits_user_id_idx
        ON deposits ((data->>'userId'))
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS deposits_status_idx
        ON deposits (status)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS withdrawals_user_id_idx
        ON withdrawals ((data->>'userId'))
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS withdrawals_status_idx
        ON withdrawals (status)
    `);
    logger.info("ensureIndexes: all indexes verified");
  } catch (err) {
    // Non-fatal — log and continue. Indexes are a performance optimization,
    // not a correctness requirement.
    logger.warn({ err }, "ensureIndexes: failed to create one or more indexes");
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
/**
 * Seeds default shop products (books, courses, templates) if none exist yet.
 * Uses onConflictDoNothing so it is idempotent and admin edits are preserved.
 */
export async function ensureShopProducts(): Promise<void> {
  try {
    const existing = await db.select().from(shopProductsTable).limit(1);
    if (existing.length > 0) {
      logger.info("Shop products already seeded, skipping");
      return;
    }

    const books = [
      { id: 1,  data: { id: 1,  title: "Meditations", titleAr: "تأملات — ماركوس أوريليوس", category: "📚 كتب مترجمة", price: 150, pages: 204, desc: "أعمق كتب الفلسفة الرواقية، كتبه الإمبراطور ماركوس أوريليوس لنفسه خلال حروبه — دليل عملي للصمود والفضيلة وعدم الاستسلام.", badge: "BESTSELLER", rating: 5, downloads: 2847, image: "🏛️" } },
      { id: 2,  data: { id: 2,  title: "The Art of War", titleAr: "فن الحرب — سون تزو", category: "📚 كتب مترجمة", price: 120, pages: 160, desc: "الكتاب الأكثر قراءة في تاريخ الاستراتيجية. مبادئ سون تزو تتحكم في النجاح منذ 2500 عام في الأعمال والقيادة والحياة.", badge: "HOT", rating: 5, downloads: 3921, image: "⚔️" } },
      { id: 3,  data: { id: 3,  title: "Man's Search for Meaning", titleAr: "الإنسان يبحث عن معنى — فيكتور فرانكل", category: "📚 كتب مترجمة", price: 180, pages: 165, desc: "شهادة حية من الهولوكوست — فرانكل يكشف كيف أن البحث عن المعنى هو أقوى دافع بشري حتى في أشد الظروف قسوة.", badge: "TOP", rating: 5, downloads: 4102, image: "💡" } },
      { id: 4,  data: { id: 4,  title: "The Power of the Subconscious Mind", titleAr: "قوة العقل الباطن — جوزيف ميرفي", category: "📚 كتب مترجمة", price: 140, pages: 280, desc: "ميرفي يكشف أسرار العقل الباطن وكيف تستخدمه لتحقيق الصحة والثروة والسعادة من خلال تقنيات مجربة علمياً.", badge: "NEW", rating: 4, downloads: 1567, image: "🧠" } },
      { id: 5,  data: { id: 5,  title: "The Crowd: A Study of the Popular Mind", titleAr: "سيكولوجيا الجماهير — غوستاف لوبون", category: "📚 كتب مترجمة", price: 130, pages: 190, desc: "لوبون يكشف العقل الجماعي وكيف تتصرف الجماهير — أساس علم النفس الاجتماعي الذي يقرأه كل سياسي وقائد.", rating: 4, downloads: 2341, image: "👥" } },
      { id: 6,  data: { id: 6,  title: "Think and Grow Rich", titleAr: "فكر وازدد ثروة — نابليون هيل", category: "📚 كتب مترجمة", price: 160, pages: 238, desc: "13 مبدأً للثروة استخلصها هيل من 20 عاماً دراسة أنجح الرجال في أمريكا. الكتاب الذي غير مسار ملايين الأشخاص.", badge: "BESTSELLER", rating: 5, downloads: 6102, image: "💰" } },
      { id: 7,  data: { id: 7,  title: "The Richest Man in Babylon", titleAr: "أغنى رجل في بابل — جورج كلاسون", category: "📚 كتب مترجمة", price: 100, pages: 144, desc: "قصص من بابل القديمة تحمل حكماً مالية خالدة. أرقش يعلمك قوانين الثروة التي لم تتغير منذ آلاف السنين.", badge: "HOT", rating: 5, downloads: 5234, image: "🏺" } },
      { id: 8,  data: { id: 8,  title: "As a Man Thinketh", titleAr: "كما يفكر الإنسان — جيمس ألن", category: "📚 كتب مترجمة", price: 80,  pages: 65,  desc: "65 صفحة غيّرت ملايين الأرواح — ألن يثبت أن أفكارك تشكّل واقعك بالكامل. أقوى كتاب تنمية بشرية مختصر.", badge: "FREE", rating: 4, downloads: 2198, image: "🌱" } },
      { id: 9,  data: { id: 9,  title: "The 7 Habits of Highly Effective People", titleAr: "العادات السبع للناس الأكثر فاعلية — ستيفن كوفي", category: "💼 أعمال", price: 200, pages: 381, desc: "الإطار الكامل للنجاح الشخصي والمهني. كوفي يقدم منهجاً شاملاً يغير طريقة تفكيرك في العمل والحياة والعلاقات.", badge: "BESTSELLER", rating: 5, downloads: 6741, image: "🏆" } },
      { id: 10, data: { id: 10, title: "Start With Why", titleAr: "ابدأ بلماذا — سايمون سينك", category: "💼 أعمال", price: 160, pages: 256, desc: "لماذا تختار بعض الشركات التأثير بينما يفشل الآخرون؟ سينك يكشف النمط الذهبي الذي يقود Apple و Martin Luther King.", badge: "HOT", rating: 4, downloads: 3102, image: "❓" } },
      { id: 11, data: { id: 11, title: "Zero to One", titleAr: "من الصفر إلى الواحد — بيتر ثيل", category: "💼 أعمال", price: 175, pages: 195, desc: "مؤسس PayPal يشرح فلسفته في بناء الشركات الثورية — لا تنافس، ابتكر. الفرق بين ابتكار شيء جديد والنسخ.", badge: "NEW", rating: 4, downloads: 2443, image: "🚀" } },
      { id: 12, data: { id: 12, title: "ChatGPT & AI Mastery Guide", titleAr: "الدليل الاحترافي للذكاء الاصطناعي — ChatGPT وأدوات 2024", category: "🤖 ذكاء اصطناعي", price: 250, pages: 180, desc: "كل ما تحتاجه للسيطرة على أدوات الذكاء الاصطناعي في عملك — من ChatGPT لـ Midjourney. 200+ حالة استخدام عملي.", badge: "HOT", rating: 5, downloads: 8901, image: "🤖" } },
      { id: 13, data: { id: 13, title: "Prompt Engineering Masterclass", titleAr: "إتقان فن البرومبت — دليل المحترفين", category: "🤖 ذكاء اصطناعي", price: 300, pages: 220, desc: "تقنيات البرومبت المتقدمة: Zero-Shot، Chain-of-Thought، Role Prompting وأكثر من 150 مثال جاهز للاستخدام.", badge: "NEW", rating: 5, downloads: 4521, image: "⚡" } },
      { id: 14, data: { id: 14, title: "Python Programming: Zero to Pro", titleAr: "Python من الصفر للاحتراف — الدليل الشامل", category: "💻 برمجة", price: 220, pages: 310, desc: "أشمل مرجع Python بالعربية — من الأساسيات للخوارزميات للمشاريع. 50+ تمرين محلول و10 مشاريع كاملة.", badge: "BESTSELLER", rating: 4, downloads: 5678, image: "🐍" } },
      { id: 15, data: { id: 15, title: "Smart Money Investor Guide", titleAr: "المستثمر الذكي — حرية مالية للجيل الجديد", category: "📊 مالية", price: 190, pages: 240, desc: "خارطة طريق مالية كاملة — ميزانية، طوارئ، استثمار، تقاعد مبكر. استراتيجيات مجربة تناسب السوق العربي.", badge: "TOP", rating: 5, downloads: 3891, image: "📈" } },
      { id: 16, data: { id: 16, title: "Graphic Design Fundamentals", titleAr: "أساسيات التصميم الجرافيكي — من المبتدئ للمحترف", category: "🎨 تصميم", price: 200, pages: 190, desc: "أكثر من 120 مبدأ تصميم مع أمثلة مرئية وتمارين عملية. يغطي Figma وAdobe والتصميم للمواقع والتطبيقات.", badge: "NEW", rating: 4, downloads: 2134, image: "🎨" } },
      { id: 17, data: { id: 17, title: "E-commerce Masterclass 2024", titleAr: "كورس التجارة الإلكترونية الشامل — من الصفر للربح", category: "🎓 كورسات", price: 350, pages: 420, desc: "150 درس تفصيلي من المنتج حتى التوسع الدولي — Dropshipping، منتجات رقمية، Marketing، وأتمتة كاملة.", badge: "HOT", rating: 5, downloads: 7823, image: "🛒" } },
      { id: 18, data: { id: 18, title: "Professional Templates Bundle", titleAr: "حزمة القوالب الاحترافية — خطط وتقارير وعروض", category: "📐 قوالب", price: 120, pages: 85,  desc: "50+ قالب جاهز للاستخدام — خطة أعمال، تقرير مالي، عرض تقديمي، عقود، CV. متوافق مع Word و PowerPoint.", rating: 4, downloads: 1923, image: "📐" } },
    ] as const;

    for (const book of books) {
      await db
        .insert(shopProductsTable)
        .values({ id: book.id, data: book.data, updatedAt: new Date() })
        .onConflictDoNothing();
    }

    logger.info({ count: books.length }, "Shop products seeded successfully");
  } catch (err) {
    logger.error({ err }, "ensureShopProducts failed");
  }
}

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
