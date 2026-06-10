/**
 * Telegram Magic Link — browser authentication without email.
 *
 * Flow:
 *  1. Browser  → POST /request          gets {token, botLink, expiresAt}
 *  2. User       taps botLink in Telegram bot
 *  3. Bot        receives /start login_<token>  → marks token "claimed"
 *  4. Browser  → GET  /poll?token=xxx   polls until status === "claimed"
 *  5. Browser  → POST /claim            exchanges token for skz_user_token cookie
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import {
  browserAuthTokensTable,
  platformUsersTable,
  adminConfigTable,
  balanceTransactionsTable,
} from "@workspace/db";
import { eq } from "@workspace/db";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET env var must be set");

const USER_COOKIE = "skz_user_token";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: "/",
};

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

function signUserToken(userId: string): string {
  return jwt.sign({ tgId: userId }, JWT_SECRET!, { expiresIn: "30d" });
}

// Cache the bot username (populated once from Telegram getMe)
let _botUsername: string | null = null;

async function getBotUsername(): Promise<string> {
  if (_botUsername) return _botUsername;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return "";
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const json = (await res.json()) as { ok?: boolean; result?: { username?: string } };
    if (json.ok && json.result?.username) {
      _botUsername = json.result.username;
      return _botUsername;
    }
  } catch { /* ignore — bot might not be configured */ }
  return "";
}

async function getStartingBalance(): Promise<number> {
  try {
    const [row] = await db
      .select()
      .from(adminConfigTable)
      .where(eq(adminConfigTable.key, "settings"))
      .limit(1);
    if (row?.value) {
      const s = row.value as Record<string, unknown>;
      const sb = Number(s.startingBalance);
      if (Number.isFinite(sb) && sb > 0) return sb;
    }
  } catch { /* ignore */ }
  return 1000;
}

// ── POST /api/user/browser-auth/request ──────────────────────────────────────
// Creates a short-lived magic token and returns the Telegram deep link.

router.post("/request", async (req: Request, res: Response) => {
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  try {
    await db.insert(browserAuthTokensTable).values({
      id: token,
      status: "pending",
      expiresAt,
    });

    const botUsername = await getBotUsername();
    const botLink = botUsername
      ? `https://t.me/${botUsername}?start=login_${token}`
      : "";

    res.json({ token, botLink, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "browser-auth: request error");
    res.status(500).json({ error: "Failed to create auth token" });
  }
});

// ── GET /api/user/browser-auth/poll?token=xxx ────────────────────────────────
// Lightweight status check — client polls every 2 s.

router.get("/poll", async (req: Request, res: Response) => {
  const { token } = req.query;
  if (typeof token !== "string" || !token) {
    res.status(400).json({ error: "token required" });
    return;
  }

  try {
    const [row] = await db
      .select()
      .from(browserAuthTokensTable)
      .where(eq(browserAuthTokensTable.id, token))
      .limit(1);

    if (!row || new Date(row.expiresAt) < new Date()) {
      res.json({ status: "expired" });
      return;
    }

    res.json({ status: row.status });
  } catch (err) {
    req.log.error({ err }, "browser-auth: poll error");
    res.status(500).json({ error: "Poll failed" });
  }
});

// ── POST /api/user/browser-auth/claim ────────────────────────────────────────
// Exchanges a "claimed" token for a session cookie.
// Body: { token: string }

router.post("/claim", async (req: Request, res: Response) => {
  const { token } = req.body ?? {};
  if (typeof token !== "string" || !token) {
    res.status(400).json({ error: "token required" });
    return;
  }

  try {
    const [row] = await db
      .select()
      .from(browserAuthTokensTable)
      .where(eq(browserAuthTokensTable.id, token))
      .limit(1);

    if (!row) {
      res.status(401).json({ error: "Token not found" });
      return;
    }
    if (new Date(row.expiresAt) < new Date()) {
      res.status(401).json({ error: "Token expired" });
      return;
    }
    if (row.status !== "claimed") {
      res.status(401).json({ error: "Token not yet claimed" });
      return;
    }

    // Mark used so the token cannot be replayed
    await db
      .update(browserAuthTokensTable)
      .set({ status: "used" })
      .where(eq(browserAuthTokensTable.id, token));

    const tgId = row.tgId!;

    // Upsert user — same structure as Telegram /init
    const [existing] = await db
      .select()
      .from(platformUsersTable)
      .where(eq(platformUsersTable.id, tgId))
      .limit(1);

    let userData: Record<string, unknown>;

    if (existing) {
      userData = { ...(existing.data as Record<string, unknown>), lastSeen: Date.now() };
      await db
        .update(platformUsersTable)
        .set({ data: userData, updatedAt: new Date() })
        .where(eq(platformUsersTable.id, tgId));
    } else {
      const startingBalance = await getStartingBalance();
      userData = {
        id: tgId,
        tgId,
        name: row.tgName ?? `User${tgId}`,
        username: row.tgUsername ?? "",
        wallet: "",
        refCode: randomBytes(3).toString("hex").toUpperCase(),
        joinedAt: Date.now(),
        lastSeen: Date.now(),
        tier: "rookie",
        balances: { SKZ: startingBalance, TON: 0, USDT: 0 },
        xp: 0,
        level: 1,
        totalDeposit: 0,
        totalWins: 0,
        status: "active",
        restrictions: { withdraw: false, play: false, chat: false },
        flagged: false,
        activity: [],
        gameSessions: [],
        dailyCredits: { date: "", total: 0 },
      };
      await db.insert(platformUsersTable).values({ id: tgId, data: userData });

      if (startingBalance > 0) {
        db.insert(balanceTransactionsTable).values({
          id: randomBytes(8).toString("hex"),
          userId: tgId,
          type: "credit",
          reason: "starting_balance",
          currency: "SKZ",
          amount: startingBalance,
          balanceBefore: 0,
          balanceAfter: startingBalance,
          createdAt: new Date(),
        }).catch(() => {});
      }
    }

    const jwtToken = signUserToken(tgId);
    res.cookie(USER_COOKIE, jwtToken, COOKIE_OPTS);
    res.json({ ok: true, user: userData });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "browser-auth: claim error");
    res.status(500).json({ error: "Claim failed", detail: msg });
  }
});

export default router;
