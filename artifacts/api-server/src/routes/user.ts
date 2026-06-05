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
import { platformUsersTable, adminConfigTable } from "@workspace/db";
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

export default router;
