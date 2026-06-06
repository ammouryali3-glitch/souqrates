/**
 * GET  /api/admin/runtime-config — public, mini-app safe fields only (no PII, no sensitive data)
 * GET  /api/admin/state          — full admin state (auth required, dashboard only)
 * PUT  /api/admin/config/:key    — update a config section (auth required)
 */
import { Router } from "express";
import type { Request, Response } from "express";
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
  shopProductsTable,
  referrersTable,
  gameResultsTable,
} from "@workspace/db";
import { eq, sql } from "@workspace/db";
import { requireAdminSession } from "./admin-auth";
import { adminAccountsTable } from "@workspace/db";

const router = Router();

/** Keys that can be written via PUT /api/admin/config/:key */
const VALID_CONFIG_KEYS = new Set([
  "settings",
  "game_overrides",
  "ticket_overrides",
  "cms",
  "finance",
  "security",
  "backup",
  "referral_config",
  "daily_checkin",
  "api_keys",
  "roles",
  "deposit_config",
  "withdrawal_config",
]);

/**
 * Keys that require owner role — they touch credentials, roles, or financial data.
 * All others map to a specific permission in the admin account's permissions[] array.
 */
const OWNER_ONLY_KEYS = new Set(["roles", "api_keys", "security", "backup"]);

/** Permission required to write each non-owner-only config key */
const KEY_PERMISSION: Record<string, string> = {
  settings: "system",
  game_overrides: "games",
  ticket_overrides: "content",
  cms: "content",
  finance: "finance",
  deposit_config: "finance",
  withdrawal_config: "finance",
  referral_config: "affiliate",
  daily_checkin: "content",
};

function checkConfigPermission(
  account: typeof adminAccountsTable.$inferSelect,
  key: string,
): boolean {
  if (account.role === "owner") return true;
  if (OWNER_ONLY_KEYS.has(key)) return false;
  const perm = KEY_PERMISSION[key];
  return !!perm && Array.isArray(account.permissions) && account.permissions.includes(perm);
}

/**
 * Filter a config map to only the keys the account is allowed to read.
 * - Owners see everything.
 * - Owner-only keys (api_keys, security, backup, roles) are hidden from non-owners.
 * - Permission-gated keys are shown only when the account has the required permission.
 * - Keys with no mapping (unknown/future keys) are excluded for non-owners.
 */
function filterReadableConfig(
  config: Record<string, unknown>,
  account: typeof adminAccountsTable.$inferSelect,
): Record<string, unknown> {
  if (account.role === "owner") return config;
  const perms: string[] = Array.isArray(account.permissions) ? account.permissions : [];
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (OWNER_ONLY_KEYS.has(key)) continue; // always blocked for non-owners
    const required = KEY_PERMISSION[key];
    if (required && !perms.includes(required)) continue; // missing permission
    result[key] = value;
  }
  return result;
}

/**
 * GET /api/admin/runtime-config
 * Public endpoint — returns only mini-app safe fields.
 * Never returns PII (users, deposits, etc.) or sensitive config (api_keys, finance, security).
 * Consumed by the mini-app on startup to get game overrides, settings, and notifications.
 */
router.get("/runtime-config", async (req: Request, res: Response) => {
  try {
    const [configRows, notifications] = await Promise.all([
      db.select().from(adminConfigTable),
      db.select().from(appNotificationsTable).orderBy(appNotificationsTable.createdAt),
    ]);

    // Allowlist: only safe config keys leave this endpoint
    const SAFE_CONFIG_KEYS = new Set(["settings", "game_overrides", "ticket_overrides", "referral_config", "daily_checkin"]);
    const safeConfig: Record<string, unknown> = {};
    for (const row of configRows) {
      if (SAFE_CONFIG_KEYS.has(row.key)) {
        safeConfig[row.key] = row.value;
      }
    }

    res.json({
      config: safeConfig,
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        startAt: n.startAt,
        endAt: n.endAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "GET /admin/runtime-config error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/admin/state
 * Auth-required — returns the full admin dataset for the dashboard.
 * Never called from the mini-app; only from authenticated admin sessions.
 */
router.get("/state", requireAdminSession, async (req: Request, res: Response) => {
  try {
    const account = (req as any).adminAccount as typeof adminAccountsTable.$inferSelect;
    const isOwner = account.role === "owner";
    const perms: string[] = Array.isArray(account.permissions) ? account.permissions : [];
    const can = (perm: string) => isOwner || perms.includes(perm);

    // Fetch only data slices the account is authorized to read.
    // Entity permission mapping mirrors the read gates in admin-entities.ts.
    const [
      configRows,
      notifications,
      users,
      deposits,
      withdrawals,
      tokenPackages,
      inventory,
      socialTasks,
      promoCodes,
      broadcasts,
      tickets,
      products,
      referrers,
      gameStatsRaw,
    ] = await Promise.all([
      db.select().from(adminConfigTable),
      can("content") ? db.select().from(appNotificationsTable).orderBy(appNotificationsTable.createdAt) : Promise.resolve([]),
      can("users")   ? db.select().from(platformUsersTable) : Promise.resolve([]),
      can("finance") ? db.select().from(depositsTable) : Promise.resolve([]),
      can("finance") ? db.select().from(withdrawalsTable) : Promise.resolve([]),
      can("content") ? db.select().from(tokenPackagesTable) : Promise.resolve([]),
      can("content") ? db.select().from(inventoryItemsTable) : Promise.resolve([]),
      can("content") ? db.select().from(socialTasksTable) : Promise.resolve([]),
      can("content") ? db.select().from(promoCodesTable) : Promise.resolve([]),
      can("content") ? db.select().from(broadcastsTable) : Promise.resolve([]),
      can("users")   ? db.select().from(supportTicketsTable).orderBy(supportTicketsTable.updatedAt) : Promise.resolve([]),
      can("content") ? db.select().from(shopProductsTable) : Promise.resolve([]),
      can("affiliate") ? db.select().from(referrersTable) : Promise.resolve([]),
      can("games") ? db.execute(sql`
        SELECT
          game_id,
          COUNT(*)::int AS total_plays,
          COUNT(DISTINCT user_id)::int AS unique_players,
          MAX(score)::int AS top_score,
          COALESCE(SUM(fee_paid), 0)::int AS total_fees_collected
        FROM game_results
        GROUP BY game_id
        ORDER BY total_plays DESC
      `) : Promise.resolve({ rows: [] }),
    ]);

    const rawConfig: Record<string, unknown> = {};
    for (const row of configRows) {
      rawConfig[row.key] = row.value;
    }
    const configMap = filterReadableConfig(rawConfig, account);

    type GameStatRow = { game_id: string; total_plays: number; unique_players: number; top_score: number; total_fees_collected: number };
    const gameStats = (gameStatsRaw as { rows: GameStatRow[] }).rows.map((r) => ({
      gameId: r.game_id,
      totalPlays: Number(r.total_plays),
      uniquePlayers: Number(r.unique_players),
      topScore: Number(r.top_score),
      totalFeesCollected: Number(r.total_fees_collected),
    }));

    res.json({
      config: configMap,
      notifications: (notifications as typeof appNotificationsTable.$inferSelect[]).map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        startAt: n.startAt,
        endAt: n.endAt,
      })),
      users: (users as typeof platformUsersTable.$inferSelect[]).map((u) => u.data),
      deposits: (deposits as typeof depositsTable.$inferSelect[]).map((d) => d.data),
      withdrawals: (withdrawals as typeof withdrawalsTable.$inferSelect[]).map((w) => w.data),
      tokenPackages: (tokenPackages as typeof tokenPackagesTable.$inferSelect[]).map((p) => p.data),
      inventory: (inventory as typeof inventoryItemsTable.$inferSelect[]).map((i) => i.data),
      socialTasks: (socialTasks as typeof socialTasksTable.$inferSelect[]).map((t) => t.data),
      promoCodes: (promoCodes as typeof promoCodesTable.$inferSelect[]).map((p) => p.data),
      broadcasts: (broadcasts as typeof broadcastsTable.$inferSelect[]).map((b) => b.data),
      tickets: (tickets as typeof supportTicketsTable.$inferSelect[]).map((t) => t.data),
      products: (products as typeof shopProductsTable.$inferSelect[]).map((p) => p.data),
      referrers: (referrers as typeof referrersTable.$inferSelect[]).map((r) => r.data),
      gameStats,
    });
  } catch (err) {
    req.log.error({ err }, "GET /admin/state error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/config/:key
router.put("/config/:key", requireAdminSession, async (req: Request, res: Response) => {
  const key = String(req.params.key);
  if (!VALID_CONFIG_KEYS.has(key)) {
    res.status(400).json({ error: `Unknown config key: ${key}` });
    return;
  }

  const account = (req as any).adminAccount as typeof adminAccountsTable.$inferSelect;
  if (!checkConfigPermission(account, key)) {
    const required = OWNER_ONLY_KEYS.has(key) ? "owner role" : `'${KEY_PERMISSION[key]}' permission`;
    res.status(403).json({ error: `Permission denied: requires ${required}` });
    return;
  }

  const value = req.body;
  if (value === undefined || value === null) {
    res.status(400).json({ error: "Request body required" });
    return;
  }

  try {
    await db
      .insert(adminConfigTable)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: adminConfigTable.key,
        set: { value, updatedAt: new Date() },
      });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, `PUT /admin/config/${key} error`);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
