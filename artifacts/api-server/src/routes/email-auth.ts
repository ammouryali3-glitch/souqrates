/**
 * Email OTP authentication — for browser users without Telegram.
 * POST /api/user/email/send-otp   — send 6-digit code to email
 * POST /api/user/email/verify-otp — verify code, set skz_user_token cookie
 * POST /api/user/email/logout     — clear cookie
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { randomBytes, randomInt } from "crypto";
// Resend email integration (Replit connector) — see blueprint id "resend"
import { ReplitConnectors } from "@replit/connectors-sdk";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { emailOtpsTable, platformUsersTable, adminConfigTable } from "@workspace/db";
import { eq, and, desc } from "@workspace/db";

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

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RATE_LIMIT_MS = 60 * 1000;

function makeEmailId(email: string): string {
  return `email:${email.toLowerCase().trim()}`;
}

function signUserToken(userId: string): string {
  return jwt.sign({ tgId: userId }, JWT_SECRET!, { expiresIn: "30d" });
}

const connectors = new ReplitConnectors();

// Direct Resend REST API key. PREFERRED in production (Contabo) because the
// Replit connector SDK cannot authenticate outside a Repl (it needs the
// `replit identity` CLI or REPL_IDENTITY/WEB_REPL_RENEWAL env vars, none of
// which exist on Contabo). When RESEND_API_KEY is set we call api.resend.com
// directly; otherwise we fall back to the Replit connector (dev on Replit).
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// "from" address. With a fresh Resend account use the shared onboarding sender;
// once souqrates.com is verified in Resend, set RESEND_FROM to a branded address
// e.g. "Souqrates System <noreply@souqrates.com>".
const RESEND_FROM =
  process.env.RESEND_FROM || "Souqrates System <onboarding@resend.dev>";

function otpEmailHtml(code: string): string {
  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0614; color: #fff; padding: 32px; border-radius: 12px;">
      <h2 style="color: #f0d060; margin: 0 0 16px;">رمز تسجيل الدخول</h2>
      <p style="color: rgba(255,255,255,0.7); margin: 0 0 24px;">
        استخدم هذا الرمز للدخول إلى حسابك في Souqrates System:
      </p>
      <div style="background: #1a0e3a; border: 1px solid #7c3aed; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px;">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #f0d060;">${code}</span>
      </div>
      <p style="color: rgba(255,255,255,0.4); font-size: 13px; margin: 0;">
        صالح لمدة 10 دقائق. لا تشاركه مع أحد.
      </p>
    </div>
  `;
}

// Sends the OTP email. Throws on failure.
// Preferred path: direct Resend REST API (works on any host, including Contabo).
// Fallback path: Replit Resend connector (Replit-hosted dev only).
async function sendOtpEmail(to: string, code: string): Promise<void> {
  const payload = {
    from: RESEND_FROM,
    to: [to],
    subject: "رمز تسجيل الدخول — Souqrates",
    html: otpEmailHtml(code),
  };

  if (RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Resend API send failed (${response.status}): ${detail}`);
    }
    return;
  }

  const response = await connectors.proxy("resend", "/emails", {
    method: "POST",
    body: payload,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend connector send failed (${response.status}): ${detail}`);
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

// POST /api/user/email/send-otp
router.post("/send-otp", async (req: Request, res: Response) => {
  const { email } = req.body ?? {};
  if (typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const now = new Date();

    // Rate limit: one OTP per minute per email. Use desc to find the most recent.
    const [recent] = await db
      .select()
      .from(emailOtpsTable)
      .where(eq(emailOtpsTable.email, normalizedEmail))
      .orderBy(desc(emailOtpsTable.createdAt))
      .limit(1);

    if (recent) {
      const age = now.getTime() - new Date(recent.createdAt).getTime();
      if (age < OTP_RATE_LIMIT_MS) {
        res.status(429).json({ error: "انتظر دقيقة قبل إرسال رمز جديد" });
        return;
      }
    }

    // Clean up old OTPs for this email
    await db
      .delete(emailOtpsTable)
      .where(eq(emailOtpsTable.email, normalizedEmail));

    const code = String(randomInt(100000, 999999));
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    const id = randomBytes(16).toString("hex");

    await db.insert(emailOtpsTable).values({
      id,
      email: normalizedEmail,
      code,
      used: false,
      expiresAt,
    });

    // If email send fails, delete the inserted OTP so the user is not trapped
    // by the rate limit on their next retry attempt.
    try {
      await sendOtpEmail(normalizedEmail, code);
    } catch (sendErr) {
      await db.delete(emailOtpsTable).where(eq(emailOtpsTable.id, id));
      throw sendErr;
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "email-auth: send-otp error");
    res.status(500).json({ error: "فشل إرسال الرمز" });
  }
});

// POST /api/user/email/verify-otp
router.post("/verify-otp", async (req: Request, res: Response) => {
  const { email, code } = req.body ?? {};
  if (typeof email !== "string" || typeof code !== "string") {
    res.status(400).json({ error: "email and code required" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const now = new Date();

    const [otp] = await db
      .select()
      .from(emailOtpsTable)
      .where(and(
        eq(emailOtpsTable.email, normalizedEmail),
        eq(emailOtpsTable.used, false),
      ))
      .limit(1);

    if (!otp || otp.code !== code.trim()) {
      res.status(401).json({ error: "رمز غير صحيح" });
      return;
    }

    if (new Date(otp.expiresAt) < now) {
      res.status(401).json({ error: "انتهت صلاحية الرمز" });
      return;
    }

    // Mark used
    await db
      .update(emailOtpsTable)
      .set({ used: true })
      .where(eq(emailOtpsTable.id, otp.id));

    const userId = makeEmailId(normalizedEmail);

    // Upsert user
    const [existing] = await db
      .select()
      .from(platformUsersTable)
      .where(eq(platformUsersTable.id, userId))
      .limit(1);

    if (!existing) {
      const startingBalance = await getStartingBalance();
      const name = normalizedEmail.split("@")[0] ?? "User";
      const userData = {
        id: userId,
        tgId: null,
        email: normalizedEmail,
        name,
        username: "",
        wallet: "",
        refCode: randomBytes(3).toString("hex").toUpperCase(),
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

      await db.insert(platformUsersTable).values({
        id: userId,
        data: userData,
      });
    } else {
      // Update lastSeen
      const data = existing.data as Record<string, unknown>;
      await db
        .update(platformUsersTable)
        .set({ data: { ...data, lastSeen: Date.now() }, updatedAt: new Date() })
        .where(eq(platformUsersTable.id, userId));
    }

    const [user] = await db
      .select()
      .from(platformUsersTable)
      .where(eq(platformUsersTable.id, userId))
      .limit(1);

    const token = signUserToken(userId);
    res.cookie(USER_COOKIE, token, COOKIE_OPTS);
    res.json({ ok: true, user: user!.data });
  } catch (err) {
    req.log.error(err, "email-auth: verify-otp error");
    res.status(500).json({ error: "فشل التحقق" });
  }
});

// POST /api/user/email/logout
router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(USER_COOKIE, { path: "/" });
  res.json({ ok: true });
});

export default router;
