/**
 * Public user routes — Telegram Mini App identity + balance sync.
 * No admin session required. Uses a separate JWT cookie (skz_user_token)
 * set after Telegram initData verification.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { platformUsersTable, adminConfigTable, gameResultsTable, depositsTable, withdrawalsTable, shopProductsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET env var must be set");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

if (!BOT_TOKEN && process.env.NODE_ENV === "production") {
  throw new Error(
    "TELEGRAM_BOT_TOKEN env var must be set in production. " +
    "Without it, Telegram initData cannot be verified and any user can forge identity.",
  );
}

const USER_COOKIE = "skz_user_token";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: "/",
};

export interface UserTokenPayload {
  tgId: string;
  iat?: number;
  exp?: number;
}

function signUserToken(tgId: string): string {
  return jwt.sign({ tgId }, JWT_SECRET!, { expiresIn: "30d" });
}

function verifyUserToken(token: string): UserTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET!) as UserTokenPayload;
  } catch {
    return null;
  }
}

/** Maximum age of Telegram initData auth_date before rejection (seconds). */
const AUTH_DATE_MAX_AGE_S = 300;

function verifyTelegramInitData(initData: string): Record<string, unknown> | null {
  if (!BOT_TOKEN) {
    try {
      const params = new URLSearchParams(initData);
      const userStr = params.get("user");
      if (!userStr) return null;
      return JSON.parse(userStr) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;

    const authDateStr = params.get("auth_date");
    if (!authDateStr) return null;
    const authDate = parseInt(authDateStr, 10);
    if (!Number.isFinite(authDate)) return null;
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
    if (ageSeconds > AUTH_DATE_MAX_AGE_S || ageSeconds < -60) return null;

    const dataCheckArr: string[] = [];
    params.forEach((v, k) => {
      if (k !== "hash") dataCheckArr.push(`${k}=${v}`);
    });
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join("\n");

    const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
    const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    const hashBuf = Buffer.from(hash, "hex");
    const expectedBuf = Buffer.from(expectedHash, "hex");
    if (hashBuf.length !== expectedBuf.length || !timingSafeEqual(hashBuf, expectedBuf)) {
      return null;
    }

    const userStr = params.get("user");
    if (!userStr) return null;
    return JSON.parse(userStr) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function getStartingBalance(): Promise<number> {
  try {
    const [row] = await db
      .select()
      .from(adminConfigTable)
      .where(eq(adminConfigTable.key, "settings"))
      .limit(1);
    if (row?.value) {
      const settings = row.value as Record<string, unknown>;
      const sb = Number(settings.startingBalance);
      if (Number.isFinite(sb) && sb > 0) return sb;
    }
  } catch { /* ignore */ }
  return 1000;
}

// ── POST /api/user/init ────────────────────────────────────────────────────────

router.post("/init", async (req: Request, res: Response) => {
  const { initData } = req.body ?? {};

  if (typeof initData !== "string" || !initData) {
    res.status(400).json({ error: "initData required" });
    return;
  }

  const tgUser = verifyTelegramInitData(initData);
  if (!tgUser) {
    res.status(401).json({ error: "Invalid initData" });
    return;
  }

  const tgId = String(tgUser.id ?? "");
  if (!tgId) {
    res.status(400).json({ error: "Missing user id in initData" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(platformUsersTable)
      .where(eq(platformUsersTable.id, tgId))
      .limit(1);

    let userData: Record<string, unknown>;

    if (existing) {
      userData = existing.data as Record<string, unknown>;
    } else {
      const startingBalance = await getStartingBalance();
      const firstName = String(tgUser.first_name ?? "");
      const lastName = String(tgUser.last_name ?? "");
      const username = String(tgUser.username ?? "");
      const name = [firstName, lastName].filter(Boolean).join(" ") || username || `User${tgId}`;

      userData = {
        id: tgId,
        tgId,
        name,
        username,
        wallet: "",
        refCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
        joinedAt: Date.now(),
        lastSeen: Date.now(),
        tier: "rookie",
        balances: { SKZ: startingBalance, TON: 0, USDT: 0 },
        totalDeposit: 0,
        totalWins: 0,
        status: "active",
        restrictions: { withdraw: false, play: false, chat: false },
        flagged: false,
        activity: [],
        gameSessions: [],
        dailyCredits: { date: "", total: 0 },
      };

      await db
        .insert(platformUsersTable)
        .values({ id: tgId, data: userData, updatedAt: new Date() });

      req.log.info({ tgId, name }, "new platform user created");
    }

    const updatedData = { ...userData, lastSeen: Date.now() };
    await db
      .update(platformUsersTable)
      .set({ data: updatedData, updatedAt: new Date() })
      .where(eq(platformUsersTable.id, tgId));

    const token = signUserToken(tgId);
    res.cookie(USER_COOKIE, token, COOKIE_OPTS);
    res.json({ user: updatedData });
  } catch (err) {
    req.log.error({ err }, "user init error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/user/me ───────────────────────────────────────────────────────────

router.get("/me", async (req: Request, res: Response) => {
  const token = req.cookies?.[USER_COOKIE];
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
  const payload = verifyUserToken(token);
  if (!payload) { res.status(401).json({ error: "Invalid session" }); return; }

  try {
    const [row] = await db
      .select()
      .from(platformUsersTable)
      .where(eq(platformUsersTable.id, payload.tgId))
      .limit(1);

    if (!row) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ user: row.data });
  } catch (err) {
    req.log.error({ err }, "user me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/user/balance-event ──────────────────────────────────────────────

/**
 * Debit only. Credits (game earnings, bonuses) must use /api/user/game-result.
 * Body: { type: "debit", amount: number }
 */
const MAX_DEBIT_AMOUNT = 1_000_000;

router.post("/balance-event", async (req: Request, res: Response) => {
  const token = req.cookies?.[USER_COOKIE];
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
  const payload = verifyUserToken(token);
  if (!payload) { res.status(401).json({ error: "Invalid session" }); return; }

  const { type, amount } = req.body ?? {};
  if (type !== "debit") {
    res.status(400).json({ error: "Only 'debit' is accepted here. Credits require a game session (POST /api/user/game-result)." });
    return;
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > MAX_DEBIT_AMOUNT) {
    res.status(400).json({ error: `amount must be a positive integer ≤ ${MAX_DEBIT_AMOUNT}` });
    return;
  }

  const delta = -Math.floor(amount);

  try {
    const nowMs = Date.now();
    const result = await db.execute(sql`
      UPDATE platform_users
      SET
        data = jsonb_set(
          jsonb_set(data, '{balances,SKZ}',
            to_jsonb(GREATEST(0,
              COALESCE((data #>> '{balances,SKZ}')::numeric, 0) + ${delta}::numeric
            ))
          ),
          '{lastSeen}',
          to_jsonb(${nowMs}::bigint)
        ),
        updated_at = NOW()
      WHERE id = ${payload.tgId}
      RETURNING (data #>> '{balances,SKZ}')::int AS skz
    `);

    const rows = result.rows as Array<{ skz: number }>;
    if (rows.length === 0) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ skz: rows[0].skz });
  } catch (err) {
    req.log.error({ err }, "user balance-event error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Game session system ────────────────────────────────────────────────────────
//
// Security model:
//   - Server issues a session nonce with a SERVER-DETERMINED maxReward.
//     maxReward is computed from admin-controlled globalPrizeFactor applied to
//     the absolute max game prize (diamond tier = 2000 SKZ by default).
//     Clients cannot claim more than this server-set cap per session.
//
//   - Sessions are persisted in platform_users.data.gameSessions JSONB —
//     this survives server restarts and makes replay attacks impossible
//     (the "redeemed" flag lives in the DB, not in-memory).
//
//   - A per-user per-UTC-day credit cap (DAILY_CREDIT_CAP_SKZ) limits total
//     game earnings per day regardless of number of sessions played.
//
//   - game-result atomically validates + marks redeemed + credits balance +
//     updates daily total inside a DB transaction.

/** Maximum SKZ credited from games per user per UTC day. */
const DAILY_CREDIT_CAP_SKZ = 20_000;

/** How long a session nonce is valid (milliseconds). */
const SESSION_TTL_MS = 15 * 60 * 1000;

/** Maximum number of session records kept in user JSONB (auto-pruned). */
const MAX_STORED_SESSIONS = 30;

/**
 * Absolute maximum prize for a single game play (diamond tier default = 2000).
 * Admin can raise this via globalPrizeFactor in admin_config.
 * This is the server's authoritative upper bound for any single credit.
 */
const BASE_MAX_GAME_PRIZE = 2_000;

interface StoredGameSession {
  id: string;
  gameId: string;
  maxReward: number; // server-determined at issuance time
  issuedAt: number;
  redeemed: boolean;
}

/** Read globalPrizeFactor from admin_config to compute effective max reward. */
async function getEffectiveMaxReward(): Promise<number> {
  try {
    const [row] = await db
      .select()
      .from(adminConfigTable)
      .where(eq(adminConfigTable.key, "settings"))
      .limit(1);
    if (row?.value) {
      const settings = row.value as Record<string, unknown>;
      const factor = Number(settings.globalPrizeFactor);
      if (Number.isFinite(factor) && factor > 0) {
        return Math.ceil(BASE_MAX_GAME_PRIZE * factor);
      }
    }
  } catch { /* ignore — use base value */ }
  return BASE_MAX_GAME_PRIZE;
}

// ── POST /api/user/game-session ───────────────────────────────────────────────

/**
 * Issues a single-use session nonce authorising one credit claim.
 * The maxReward is determined by the server (admin config prize factor),
 * not by the client. Stored in DB for replay protection.
 *
 * Body: { gameId: string }
 * Returns: { sessionId: string, maxReward: number }
 */
router.post("/game-session", async (req: Request, res: Response) => {
  const token = req.cookies?.[USER_COOKIE];
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
  const payload = verifyUserToken(token);
  if (!payload) { res.status(401).json({ error: "Invalid session" }); return; }

  const { gameId } = req.body ?? {};
  if (typeof gameId !== "string" || !gameId) {
    res.status(400).json({ error: "gameId required" });
    return;
  }

  try {
    const maxReward = await getEffectiveMaxReward();
    const sessionId = randomBytes(24).toString("hex");
    const now = Date.now();
    const cutoff = now - SESSION_TTL_MS;

    await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(platformUsersTable)
        .where(eq(platformUsersTable.id, payload.tgId))
        .for("update")
        .limit(1);

      if (!row) throw Object.assign(new Error("User not found"), { status: 404 });

      const data = row.data as Record<string, unknown>;
      const existing: StoredGameSession[] = Array.isArray(data.gameSessions) ? data.gameSessions : [];

      // Prune expired and redeemed sessions; keep most-recent unredeemed ones.
      const pruned = existing
        .filter((s) => !s.redeemed && s.issuedAt >= cutoff)
        .slice(-MAX_STORED_SESSIONS + 1);

      pruned.push({ id: sessionId, gameId, maxReward, issuedAt: now, redeemed: false });

      const updatedData = { ...data, gameSessions: pruned };
      await tx
        .update(platformUsersTable)
        .set({ data: updatedData, updatedAt: new Date() })
        .where(eq(platformUsersTable.id, payload.tgId));
    });

    res.json({ sessionId, maxReward });
  } catch (err) {
    const e = err as { status?: number };
    if (e.status === 404) { res.status(404).json({ error: "User not found" }); return; }
    req.log.error({ err }, "game-session error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/user/game-result ────────────────────────────────────────────────

/**
 * Redeems a game-session nonce and atomically credits the earned SKZ.
 *
 * Body: { sessionId: string, amount: number }
 *   - amount: SKZ earned (0 – session.maxReward, server-set at issuance)
 *
 * Validates inside a DB transaction:
 *   - Session exists in user's JSONB
 *   - Session belongs to this user (implicit — stored under their row)
 *   - Session is not expired (< SESSION_TTL_MS old)
 *   - Session has not been redeemed
 *   - Amount ≤ session.maxReward (server-determined at issuance)
 *   - Per-user daily credit cap not exceeded
 *
 * Returns: { skz: number } — the new confirmed DB balance.
 */
router.post("/game-result", async (req: Request, res: Response) => {
  const token = req.cookies?.[USER_COOKIE];
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
  const payload = verifyUserToken(token);
  if (!payload) { res.status(401).json({ error: "Invalid session" }); return; }

  const { sessionId, amount } = req.body ?? {};

  if (typeof sessionId !== "string" || !sessionId) {
    res.status(400).json({ error: "sessionId required" });
    return;
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
    res.status(400).json({ error: "amount must be a non-negative number" });
    return;
  }

  try {
    let newSkz = 0;

    await db.transaction(async (tx) => {
      // Lock the user row for update.
      const [row] = await tx
        .select()
        .from(platformUsersTable)
        .where(eq(platformUsersTable.id, payload.tgId))
        .for("update")
        .limit(1);

      if (!row) throw Object.assign(new Error("user_not_found"), { status: 404 });

      const data = row.data as Record<string, unknown>;
      const sessions: StoredGameSession[] = Array.isArray(data.gameSessions) ? data.gameSessions : [];

      // Find the session.
      const sessionIdx = sessions.findIndex((s) => s.id === sessionId);
      if (sessionIdx === -1) {
        throw Object.assign(new Error("Session not found or expired"), { status: 400 });
      }
      const session = sessions[sessionIdx];

      if (session.redeemed) {
        throw Object.assign(new Error("Game session already redeemed"), { status: 409 });
      }
      if (Date.now() - session.issuedAt > SESSION_TTL_MS) {
        throw Object.assign(new Error("Game session expired"), { status: 400 });
      }

      const claimAmount = Math.floor(amount);

      // Validate amount against SERVER-SET maxReward (not client-provided cap).
      if (claimAmount > session.maxReward) {
        throw Object.assign(
          new Error(`Amount ${claimAmount} exceeds session maxReward ${session.maxReward}`),
          { status: 400 },
        );
      }

      // Check per-user daily credit cap.
      const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" UTC
      const dc = (data.dailyCredits ?? { date: "", total: 0 }) as { date: string; total: number };
      const dailyTotal = dc.date === today ? dc.total : 0;
      const effectiveAmount = Math.min(claimAmount, Math.max(0, DAILY_CREDIT_CAP_SKZ - dailyTotal));

      // Mark session redeemed and update daily total.
      const updatedSessions = sessions.map((s, i) =>
        i === sessionIdx ? { ...s, redeemed: true } : s,
      );
      const currentSkz = Number((data.balances as Record<string, unknown>)?.SKZ ?? 0);
      const newSkzValue = currentSkz + effectiveAmount;

      const updatedData: Record<string, unknown> = {
        ...data,
        balances: { ...(data.balances as Record<string, unknown>), SKZ: newSkzValue },
        lastSeen: Date.now(),
        gameSessions: updatedSessions,
        dailyCredits: { date: today, total: dailyTotal + effectiveAmount },
      };

      await tx
        .update(platformUsersTable)
        .set({ data: updatedData, updatedAt: new Date() })
        .where(eq(platformUsersTable.id, payload.tgId));

      newSkz = newSkzValue;
      req.log.info(
        { tgId: payload.tgId, gameId: session.gameId, claimed: claimAmount, credited: effectiveAmount, dailyTotal: dailyTotal + effectiveAmount },
        "game credit applied",
      );
    });

    res.json({ skz: newSkz });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (e.status === 404) { res.status(404).json({ error: "User not found" }); return; }
    if (e.status === 400) { res.status(400).json({ error: e.message ?? "Invalid request" }); return; }
    if (e.status === 409) { res.status(409).json({ error: e.message ?? "Conflict" }); return; }
    req.log.error({ err }, "game-result error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Period helpers ─────────────────────────────────────────────────────────────

/** Returns UTC midnight of the current day as a Date. */
function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Returns UTC midnight of the most-recent Monday as a Date. */
function thisWeekMondayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

function periodStart(period: "daily" | "weekly"): Date {
  return period === "weekly" ? thisWeekMondayUtc() : todayUtc();
}

/**
 * Fetch pool share (1 - platformRake/100) from admin_config.
 * Defaults to 0.7 (30 % platform rake) if not configured.
 */
// Default entry fees matching games-data.ts ARENA_GAMES definitions (server-authoritative)
const DEFAULT_ENTRY_FEES: Record<string, number> = {
  detective: 180,
  cipher: 150,
  hiddenpath: 175,
  geniusgrid: 180,
  truthscale: 200,
};

interface GameEconomyConfig {
  poolShare: number;
  entryFee: number;
}

async function getGameEconomy(gameId: string): Promise<GameEconomyConfig> {
  try {
    const [overridesRows, settingsRows] = await Promise.all([
      db.select().from(adminConfigTable).where(eq(adminConfigTable.key, "game_overrides")).limit(1),
      db.select().from(adminConfigTable).where(eq(adminConfigTable.key, "settings")).limit(1),
    ]);
    const overrides = (overridesRows[0]?.value ?? {}) as Record<string, unknown>;
    const ov = (overrides[gameId] ?? {}) as Record<string, unknown>;
    const settings = (settingsRows[0]?.value ?? {}) as Record<string, unknown>;
    const rake = typeof ov.rake === "number" ? ov.rake
      : (typeof settings.platformRake === "number" ? settings.platformRake : 30);
    const poolShare = Math.min(1, Math.max(0, 1 - rake / 100));
    // Entry fee: admin override wins; fall back to hardcoded default; then 0
    const entryFee = typeof ov.entry === "number" && ov.entry >= 0
      ? Math.floor(ov.entry)
      : (DEFAULT_ENTRY_FEES[gameId] ?? 0);
    return { poolShare, entryFee };
  } catch {
    return { poolShare: 0.7, entryFee: DEFAULT_ENTRY_FEES[gameId] ?? 0 };
  }
}

// ── POST /api/user/submit-score ────────────────────────────────────────────────

/**
 * Saves a game result to the database.
 *
 * Body: { gameId: string, score: number, timeSec: number, name: string,
 *         feePaid: number, period: "daily" | "weekly" }
 * Returns: { ok: true, rank: number }
 *
 * One result per user per game per period is kept (best score).
 * Additional plays within the same period are recorded but only the best
 * score surfaces in the leaderboard query.
 */
router.post("/submit-score", async (req: Request, res: Response) => {
  const token = req.cookies?.[USER_COOKIE];
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
  const payload = verifyUserToken(token);
  if (!payload) { res.status(401).json({ error: "Invalid session" }); return; }

  const { gameId, score, timeSec, name, period } = req.body ?? {};

  if (typeof gameId !== "string" || !gameId) {
    res.status(400).json({ error: "gameId required" }); return;
  }
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
    res.status(400).json({ error: "score must be a non-negative number" }); return;
  }
  if (typeof timeSec !== "number" || !Number.isFinite(timeSec) || timeSec < 0) {
    res.status(400).json({ error: "timeSec must be a non-negative number" }); return;
  }
  if (typeof name !== "string") {
    res.status(400).json({ error: "name required" }); return;
  }
  const validPeriods = ["daily", "weekly"];
  const safePeriod: "daily" | "weekly" = validPeriods.includes(period) ? period : "daily";
  const safeName = String(name).slice(0, 64) || "Player";

  // Entry fee is always computed server-side — never trusted from the client.
  const { entryFee: baseEntryFee } = await getGameEconomy(gameId);

  try {
    const since = periodStart(safePeriod);
    let newSkz: number | null = null;
    let safeFee = 0;

    // Atomically: check existing entry, deduct fee if first play, insert result.
    // Locking the user row prevents double-charge races if two requests arrive simultaneously.
    await db.transaction(async (tx) => {
      const [userRow] = await tx
        .select()
        .from(platformUsersTable)
        .where(eq(platformUsersTable.id, payload.tgId))
        .for("update")
        .limit(1);
      if (!userRow) throw Object.assign(new Error("user_not_found"), { status: 404 });

      // First play this period = pay the fee; subsequent plays = free replays
      const existingRows = await tx.execute(sql`
        SELECT id FROM game_results
        WHERE user_id = ${payload.tgId}
          AND game_id  = ${gameId}
          AND period   = ${safePeriod}
          AND created_at >= ${since}
        LIMIT 1
      `);
      const alreadyPaid = (existingRows.rows as Array<{ id: string }>).length > 0;
      safeFee = alreadyPaid ? 0 : baseEntryFee;

      if (safeFee > 0) {
        const data = userRow.data as Record<string, unknown>;
        const currentSkz = Number(
          (data.balances as Record<string, unknown> | undefined)?.SKZ ?? 0,
        );
        if (currentSkz < safeFee) {
          throw Object.assign(
            new Error(`Insufficient balance: need ${safeFee} SKZ, have ${currentSkz}`),
            { status: 402 },
          );
        }
        newSkz = currentSkz - safeFee;
        const updatedData: Record<string, unknown> = {
          ...data,
          balances: {
            ...(data.balances as Record<string, unknown> | undefined),
            SKZ: newSkz,
          },
          lastSeen: Date.now(),
        };
        await tx
          .update(platformUsersTable)
          .set({ data: updatedData, updatedAt: new Date() })
          .where(eq(platformUsersTable.id, payload.tgId));
      }

      const id = randomBytes(12).toString("hex");
      await tx.insert(gameResultsTable).values({
        id,
        userId: payload.tgId,
        gameId,
        score: Math.floor(score),
        timeSec: Math.floor(timeSec),
        name: safeName,
        feePaid: safeFee,
        period: safePeriod,
        createdAt: new Date(),
      });
    });

    // Compute rank outside the transaction (read-only, no lock needed)
    const rankResult = await db.execute(sql`
      WITH best AS (
        SELECT DISTINCT ON (user_id) user_id, score, time_sec
        FROM game_results
        WHERE game_id = ${gameId}
          AND period  = ${safePeriod}
          AND created_at >= ${since}
        ORDER BY user_id, score DESC, time_sec ASC
      )
      SELECT COUNT(*)::int AS ahead
      FROM best
      WHERE score > ${Math.floor(score)}
        OR (score = ${Math.floor(score)} AND time_sec < ${Math.floor(timeSec)})
    `);
    const rows = rankResult.rows as Array<{ ahead: number }>;
    const rank = Number(rows[0]?.ahead ?? 0) + 1;

    req.log.info(
      { tgId: payload.tgId, gameId, score, timeSec, period: safePeriod, feePaid: safeFee },
      "game score submitted",
    );
    res.json({ ok: true, rank, ...(newSkz !== null ? { newSkz } : {}) });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (e.status === 404) { res.status(404).json({ error: "User not found" }); return; }
    if (e.status === 402) { res.status(402).json({ error: e.message ?? "Insufficient balance" }); return; }
    req.log.error({ err }, "submit-score error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/user/wallet ───────────────────────────────────────────────────────

/**
 * Returns the authenticated user's deposit addresses, their deposit memo
 * (tgId used as the transaction comment), and their recent transaction history.
 *
 * Returns: {
 *   tonDepositWallet: string,
 *   tronDepositWallet: string,
 *   depositMemo: string,          // the value to put as transaction comment/memo
 *   deposits: DepositRecord[],    // most-recent 50 confirmed deposits
 *   withdrawals: WithdrawalRecord[], // most-recent 50 withdrawals
 * }
 */
router.get("/wallet", async (req: Request, res: Response) => {
  const token = req.cookies?.[USER_COOKIE];
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
  const payload = verifyUserToken(token);
  if (!payload) { res.status(401).json({ error: "Invalid session" }); return; }

  try {
    const [userRow, depositRows, withdrawalRows] = await Promise.all([
      db.select().from(platformUsersTable).where(eq(platformUsersTable.id, payload.tgId)).limit(1),
      db.execute(sql`
        SELECT data FROM deposits
        WHERE data->>'userId' = ${payload.tgId}
        ORDER BY created_at DESC LIMIT 50
      `),
      db.execute(sql`
        SELECT data FROM withdrawals
        WHERE data->>'userId' = ${payload.tgId}
        ORDER BY created_at DESC LIMIT 50
      `),
    ]);

    if (!userRow[0]) { res.status(404).json({ error: "User not found" }); return; }

    res.json({
      tonDepositWallet: process.env.TON_DEPOSIT_WALLET ?? "",
      depositMemo: payload.tgId,
      deposits: (depositRows.rows as Array<{ data: unknown }>).map((r) => r.data),
      withdrawals: (withdrawalRows.rows as Array<{ data: unknown }>).map((r) => r.data),
    });
  } catch (err) {
    req.log.error({ err }, "user wallet error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/user/withdraw ────────────────────────────────────────────────────

/**
 * Submit a withdrawal request.
 * Immediately debits the user's SKZ balance.
 * Creates a pending withdrawal record for admin approval.
 *
 * Body: { skzAmount: number, destWallet: string }
 * Returns: { ok: true, withdrawalId: string, newSkz: number }
 */
router.post("/withdraw", async (req: Request, res: Response) => {
  const token = req.cookies?.[USER_COOKIE];
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
  const payload = verifyUserToken(token);
  if (!payload) { res.status(401).json({ error: "Invalid session" }); return; }

  const { skzAmount, destWallet } = req.body ?? {};

  if (typeof skzAmount !== "number" || !Number.isFinite(skzAmount) || skzAmount <= 0) {
    res.status(400).json({ error: "skzAmount must be a positive number" }); return;
  }
  if (typeof destWallet !== "string" || !destWallet.trim()) {
    res.status(400).json({ error: "destWallet required" }); return;
  }
  const safeCurrency = "TON" as const;
  const safeAmount = Math.floor(skzAmount);

  try {
    let newSkz = 0;
    let withdrawalId = "";

    await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(platformUsersTable)
        .where(eq(platformUsersTable.id, payload.tgId))
        .for("update")
        .limit(1);

      if (!row) throw Object.assign(new Error("User not found"), { status: 404 });

      const data = row.data as Record<string, unknown>;
      const balances = (data.balances ?? {}) as Record<string, number>;
      const currentSkz = Math.floor(Number(balances.SKZ ?? 0));

      if (currentSkz < safeAmount) {
        throw Object.assign(new Error("Insufficient SKZ balance"), { status: 400 });
      }

      // Check withdrawal restrictions
      const restrictions = (data.restrictions ?? {}) as Record<string, boolean>;
      if (restrictions.withdraw) {
        throw Object.assign(new Error("Withdrawals are restricted on this account"), { status: 403 });
      }

      const newSkzValue = currentSkz - safeAmount;
      const nowMs = Date.now();

      // Debit SKZ
      const updatedData: Record<string, unknown> = {
        ...data,
        balances: { ...balances, SKZ: newSkzValue },
        lastSeen: nowMs,
      };
      await tx
        .update(platformUsersTable)
        .set({ data: updatedData, updatedAt: new Date() })
        .where(eq(platformUsersTable.id, payload.tgId));

      // Create withdrawal record
      withdrawalId = randomBytes(12).toString("hex");
      const withdrawalData = {
        id: withdrawalId,
        userId: payload.tgId,
        userName: String(data.name ?? ""),
        currency: safeCurrency,
        amount: safeAmount,
        fee: 0,
        at: nowMs,
        status: "pending",
        wallet: destWallet.trim(),
        auto: safeAmount <= 1000, // auto-approve small amounts
      };

      await tx
        .insert(withdrawalsTable)
        .values({ id: withdrawalId, status: "pending", data: withdrawalData });

      newSkz = newSkzValue;
    });

    req.log.info(
      { tgId: payload.tgId, withdrawalId, skzAmount: safeAmount, currency: safeCurrency },
      "withdrawal submitted",
    );
    res.json({ ok: true, withdrawalId, newSkz });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (e.status === 404) { res.status(404).json({ error: "User not found" }); return; }
    if (e.status === 400) { res.status(400).json({ error: e.message ?? "Invalid request" }); return; }
    if (e.status === 403) { res.status(403).json({ error: e.message ?? "Forbidden" }); return; }
    req.log.error({ err }, "withdraw error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/user/shop/buy ───────────────────────────────────────────────────

/**
 * Purchase a shop product. Looks up the server-authoritative price from
 * shopProductsTable — the client-supplied price is NEVER trusted.
 * Atomically validates balance, deducts, and records the product ID in
 * user.data.purchases[].
 *
 * Body: { productId: number }
 */
router.post("/shop/buy", async (req: Request, res: Response) => {
  const token = req.cookies?.[USER_COOKIE];
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
  const payload = verifyUserToken(token);
  if (!payload) { res.status(401).json({ error: "Invalid session" }); return; }

  const { productId } = req.body ?? {};
  if (typeof productId !== "number" || !Number.isInteger(productId) || productId <= 0) {
    res.status(400).json({ error: "productId must be a positive integer" }); return;
  }

  try {
    let newSkz = 0;
    let serverPrice = 0;
    await db.transaction(async (tx) => {
      // ── 1. Fetch server-authoritative price ────────────────────────────────
      const [product] = await tx
        .select()
        .from(shopProductsTable)
        .where(eq(shopProductsTable.id, productId))
        .limit(1);
      if (!product) throw Object.assign(new Error("product_not_found"), { status: 404 });

      const productData = product.data as Record<string, unknown>;
      const rawPrice = Number(productData.price ?? 0);
      if (!Number.isInteger(rawPrice) || rawPrice <= 0) {
        throw Object.assign(new Error("product_price_invalid"), { status: 400 });
      }
      serverPrice = rawPrice;

      // ── 2. Lock user row and validate balance ──────────────────────────────
      const [row] = await tx
        .select()
        .from(platformUsersTable)
        .where(eq(platformUsersTable.id, payload.tgId))
        .for("update")
        .limit(1);
      if (!row) throw Object.assign(new Error("user_not_found"), { status: 404 });

      const data = row.data as Record<string, unknown>;
      const purchases: number[] = Array.isArray(data.purchases)
        ? (data.purchases as number[])
        : [];

      if (purchases.includes(productId)) {
        throw Object.assign(new Error("already_purchased"), { status: 409 });
      }

      const currentSkz = Number(
        (data.balances as Record<string, unknown> | undefined)?.SKZ ?? 0,
      );
      if (currentSkz < serverPrice) {
        throw Object.assign(new Error("insufficient_balance"), { status: 402 });
      }

      newSkz = currentSkz - serverPrice;
      const updatedData: Record<string, unknown> = {
        ...data,
        balances: {
          ...(data.balances as Record<string, unknown> | undefined),
          SKZ: newSkz,
        },
        purchases: [...purchases, productId],
        lastSeen: Date.now(),
      };

      await tx
        .update(platformUsersTable)
        .set({ data: updatedData, updatedAt: new Date() })
        .where(eq(platformUsersTable.id, payload.tgId));
    });

    req.log.info({ tgId: payload.tgId, productId, price: serverPrice }, "shop purchase");
    res.json({ ok: true, newSkz });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (e.status === 404 && e.message === "product_not_found") {
      res.status(404).json({ error: "Product not found" }); return;
    }
    if (e.status === 400) { res.status(400).json({ error: "Product price not configured" }); return; }
    if (e.status === 404) { res.status(404).json({ error: "User not found" }); return; }
    if (e.status === 402) { res.status(402).json({ error: "Insufficient balance" }); return; }
    if (e.status === 409) { res.status(409).json({ error: "Already purchased" }); return; }
    req.log.error({ err }, "shop buy error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/user/leaderboard/:gameId ─────────────────────────────────────────

/**
 * Returns the top-20 leaderboard for a game.
 * Auth is optional: if a valid session cookie is present the caller's entry
 * gets { isYou: true } and yourRank is populated.
 *
 * Query: ?period=daily|weekly|alltime  (defaults to "daily")
 *   - alltime: best score per user across all recorded history; pool is always 0.
 * Returns: { leaders: LeaderEntry[], pool: number, entries: number, yourRank: number | null }
 */
router.get("/leaderboard/:gameId", async (req: Request, res: Response) => {
  const gameId = String(req.params.gameId);
  const periodParam = req.query.period as string;
  const isAllTime = periodParam === "alltime";
  const period: "daily" | "weekly" = periodParam === "weekly" ? "weekly" : "daily";
  const since = isAllTime ? null : periodStart(period);

  // Optionally identify the caller for isYou/yourRank
  let myTgId: string | null = null;
  try {
    const token = req.cookies?.[USER_COOKIE];
    if (token) {
      const p = verifyUserToken(token);
      if (p) myTgId = p.tgId;
    }
  } catch { /* anonymous */ }

  try {
    type RawRow = { user_id: string; name: string; score: number; time_sec: number };

    let allSorted: RawRow[];
    let entries: number;
    let pool: number;

    if (isAllTime) {
      // All-time: best score per user across entire history (no date/period filter)
      const rows = await db.execute(sql`
        SELECT DISTINCT ON (user_id)
          user_id,
          name,
          score,
          time_sec
        FROM game_results
        WHERE game_id = ${gameId}
        ORDER BY user_id, score DESC, time_sec ASC
      `);
      allSorted = (rows.rows as RawRow[])
        .sort((a, b) => b.score - a.score || a.time_sec - b.time_sec);
      entries = allSorted.length;
      pool = 0;
    } else {
      // Current-period leaderboard with pool calculation
      const [rows, statsResult] = await Promise.all([
        db.execute(sql`
          SELECT DISTINCT ON (user_id)
            user_id,
            name,
            score,
            time_sec
          FROM game_results
          WHERE game_id = ${gameId}
            AND period = ${period}
            AND created_at >= ${since!}
          ORDER BY user_id, score DESC, time_sec ASC
        `),
        db.execute(sql`
          SELECT COUNT(DISTINCT user_id)::int AS entries,
                 COALESCE(SUM(fee_paid), 0)::int AS total_fees
          FROM game_results
          WHERE game_id = ${gameId}
            AND period = ${period}
            AND created_at >= ${since!}
        `),
      ]);

      allSorted = (rows.rows as RawRow[])
        .sort((a, b) => b.score - a.score || a.time_sec - b.time_sec);

      const stats = (statsResult.rows as Array<{ entries: number; total_fees: number }>)[0];
      entries = stats?.entries ?? 0;
      const totalFees = stats?.total_fees ?? 0;
      const { poolShare } = await getGameEconomy(gameId);
      pool = Math.floor(totalFees * poolShare);
    }

    // yourRank is derived from full global list (not limited to top-20)
    const yourRank = myTgId !== null
      ? (() => {
          const idx = allSorted.findIndex((r) => r.user_id === myTgId);
          return idx >= 0 ? idx + 1 : null;
        })()
      : null;

    // Only the top-20 are sent as visible leaders
    const top20 = allSorted.slice(0, 20);
    const leaders = top20.map((r, i) => ({
      rank: i + 1,
      name: r.name,
      score: Number(r.score),
      time: Number(r.time_sec),
      isYou: myTgId !== null && r.user_id === myTgId,
    }));

    res.json({ leaders, pool, entries, yourRank });
  } catch (err) {
    req.log.error({ err }, "leaderboard error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
