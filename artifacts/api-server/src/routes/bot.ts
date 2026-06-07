/**
 * Telegram Bot webhook handler + Telegram Stars payment support.
 *
 * POST /api/bot/webhook
 *   - Secured via X-Telegram-Bot-Api-Secret-Token header
 *   - Handles /start and /help commands
 *   - Handles pre_checkout_query → answers immediately (required within 10 s)
 *   - Handles successful_payment → credits SKZ to user
 */

import { Router, type Request, type Response } from "express";
import { createHmac } from "crypto";
import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { platformUsersTable, tokenPackagesTable, depositsTable } from "@workspace/db";
import { eq, sql } from "@workspace/db";
import { recordLedger } from "../lib/ledger";

const router = Router();

const TOKEN = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
const MINI_APP_URL =
  process.env["MINI_APP_URL"] ??
  (() => {
    const domain = (process.env["REPLIT_DOMAINS"] ?? "").split(",")[0]?.trim();
    return domain ? `https://${domain}/` : "";
  })();

// ── Telegram Bot API helper ───────────────────────────────────────────────────

async function callTg(method: string, body: Record<string, unknown>): Promise<unknown> {
  if (!TOKEN) return null;
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    logger.warn({ method, status: res.status, response: json }, "bot: Telegram API error");
  }
  return json;
}

// ── Webhook secret token ──────────────────────────────────────────────────────

function webhookSecret(): string {
  return createHmac("sha256", TOKEN).update("webhook-secret").digest("hex").slice(0, 64);
}

// ── Telegram Stars — invoice creation ────────────────────────────────────────

/**
 * Create a Telegram Stars invoice link.
 * Currency code for Stars is "XTR". provider_token must be empty.
 * Returns the invoice URL or null on failure.
 */
export async function createStarsInvoiceLink(params: {
  title: string;
  description: string;
  payload: string;
  stars: number;
}): Promise<string | null> {
  const result = await callTg("createInvoiceLink", {
    title: params.title,
    description: params.description,
    payload: params.payload,
    provider_token: "",
    currency: "XTR",
    prices: [{ label: params.title, amount: params.stars }],
  }) as { ok?: boolean; result?: string } | null;
  if (!result?.ok) return null;
  return result.result ?? null;
}

// ── Stars payment handlers ────────────────────────────────────────────────────

async function handlePreCheckoutQuery(query: TgPreCheckoutQuery): Promise<void> {
  // Must answer within 10 seconds — always approve here; fraud checks happen post-payment
  await callTg("answerPreCheckoutQuery", {
    pre_checkout_query_id: query.id,
    ok: true,
  });
  logger.info({ queryId: query.id, fromId: query.from.id }, "stars: pre_checkout approved");
}

async function handleSuccessfulPayment(tgId: string, payment: TgSuccessfulPayment): Promise<void> {
  const chargeId = payment.telegram_payment_charge_id;
  try {
    const invoicePayload = JSON.parse(payment.invoice_payload) as { packageId?: string };
    const packageId = invoicePayload.packageId;
    if (!packageId) {
      logger.warn({ tgId, chargeId }, "stars: missing packageId in invoice_payload");
      return;
    }

    await db.transaction(async (tx) => {
      // Lock user row first for accurate balance reading
      const [userRow] = await tx
        .select()
        .from(platformUsersTable)
        .where(eq(platformUsersTable.id, tgId))
        .for("update")
        .limit(1);

      if (!userRow) {
        logger.warn({ tgId, chargeId }, "stars: user not found");
        return;
      }

      // Idempotency: use chargeId as deposit PK — skip if already processed
      const existing = await tx.execute(
        sql`SELECT id FROM deposits WHERE id = ${chargeId} LIMIT 1`,
      );
      if ((existing.rows as unknown[]).length > 0) {
        logger.info({ chargeId }, "stars: already credited — skipping duplicate");
        return;
      }

      // Look up package
      const [pkg] = await tx
        .select()
        .from(tokenPackagesTable)
        .where(eq(tokenPackagesTable.id, packageId))
        .limit(1);

      if (!pkg) {
        logger.warn({ packageId, chargeId }, "stars: package not found");
        return;
      }

      const pkgData = pkg.data as { skz?: number; bonus?: number };
      const totalSkz = (pkgData.skz ?? 0) + (pkgData.bonus ?? 0);
      if (totalSkz <= 0) {
        logger.warn({ packageId, totalSkz }, "stars: zero SKZ package — skipping");
        return;
      }

      const userData = userRow.data as Record<string, unknown>;
      const balances = (userData.balances ?? {}) as Record<string, number>;
      const skzBefore = Math.floor(Number(balances.SKZ ?? 0));
      const skzAfter = skzBefore + totalSkz;
      const nowMs = Date.now();

      // Insert deposit record (idempotency anchor)
      await tx.insert(depositsTable).values({
        id: chargeId,
        status: "confirmed",
        data: {
          id: chargeId,
          userId: tgId,
          userName: String(userData.name ?? ""),
          currency: "STARS",
          amount: payment.total_amount,
          skzCredited: totalSkz,
          txHash: chargeId,
          packageId,
          status: "confirmed",
          at: nowMs,
        },
      }).onConflictDoNothing();

      // Credit SKZ balance
      await tx.execute(sql`
        UPDATE platform_users
        SET
          data = jsonb_set(
            jsonb_set(data,
              '{balances,SKZ}',
              to_jsonb(COALESCE((data #>> '{balances,SKZ}')::numeric, 0) + ${totalSkz}::numeric)
            ),
            '{lastSeen}',
            to_jsonb(${nowMs}::bigint)
          ),
          updated_at = NOW()
        WHERE id = ${tgId}
      `);

      // Audit ledger
      await recordLedger(tx, {
        userId: tgId,
        type: "credit",
        reason: "stars_purchase",
        amount: totalSkz,
        balanceBefore: skzBefore,
        balanceAfter: skzAfter,
        ref: chargeId,
        meta: { stars: payment.total_amount, packageId },
      });
    });

    logger.info({ tgId, packageId, chargeId, stars: payment.total_amount }, "stars: purchase credited");
  } catch (err) {
    logger.error({ err, tgId, chargeId }, "stars: handleSuccessfulPayment failed");
  }
}

// ── Message builders ──────────────────────────────────────────────────────────

function buildWelcomeMessage(firstName: string) {
  return (
    `🌟 *أهلاً وسهلاً ${firstName}!*\n\n` +
    `مرحباً بك في *Souqrates System* — المنصة الأمتع لكسب المكافآت والمنافسة مع اللاعبين من حول العالم.\n\n` +
    `🎮 *ما الذي ينتظرك؟*\n` +
    `• ألعاب مشوّقة وبطولات يومية\n` +
    `• متجر مكافآت حصري\n` +
    `• نظام إحالة مربح\n` +
    `• محفظة رقمية متكاملة\n\n` +
    `اضغط الزر أدناه لفتح التطبيق والبدء الآن! 👇`
  );
}

function buildWelcomeMessageEn(firstName: string) {
  return (
    `🌟 *Welcome, ${firstName}!*\n\n` +
    `Welcome to *Souqrates System* — the most exciting platform to earn rewards and compete with players worldwide.\n\n` +
    `🎮 *What awaits you?*\n` +
    `• Exciting games & daily tournaments\n` +
    `• Exclusive rewards shop\n` +
    `• Profitable referral system\n` +
    `• Integrated digital wallet\n\n` +
    `Tap the button below to open the app and start now! 👇`
  );
}

// ── Command handlers ──────────────────────────────────────────────────────────

async function handleStart(chatId: number, firstName: string, languageCode?: string) {
  const isArabic = !languageCode || languageCode.startsWith("ar");
  const text = isArabic ? buildWelcomeMessage(firstName) : buildWelcomeMessageEn(firstName);

  await callTg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: isArabic ? "🚀 فتح Souqrates System" : "🚀 Open Souqrates System",
            web_app: { url: MINI_APP_URL },
          },
        ],
      ],
    },
  });
}

async function handleHelp(chatId: number, _firstName: string, languageCode?: string) {
  const isArabic = !languageCode || languageCode.startsWith("ar");
  const text = isArabic
    ? (
      `📖 *مساعدة Souqrates System*\n\n` +
      `/start — ابدأ واعرض رسالة الترحيب\n` +
      `/help — عرض هذه المساعدة\n\n` +
      `لفتح التطبيق مباشرةً اضغط الزر أدناه:`
    )
    : (
      `📖 *Souqrates System Help*\n\n` +
      `/start — Start and show the welcome message\n` +
      `/help — Show this help\n\n` +
      `To open the app directly, tap the button below:`
    );

  await callTg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: isArabic ? "🎮 فتح التطبيق" : "🎮 Open App",
            web_app: { url: MINI_APP_URL },
          },
        ],
      ],
    },
  });
}

// ── Webhook endpoint ──────────────────────────────────────────────────────────

router.post("/webhook", (req: Request, res: Response) => {
  const secret = webhookSecret();
  const incoming = req.headers["x-telegram-bot-api-secret-token"] as string | undefined;

  if (TOKEN && incoming !== secret) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Respond 200 immediately — Telegram requires it before processing
  res.json({ ok: true });

  const update = req.body as TgUpdate;
  processUpdate(update).catch((err) => {
    logger.error({ err }, "bot: unhandled error in processUpdate");
  });
});

async function processUpdate(update: TgUpdate) {
  // Stars: pre_checkout_query must be answered within 10 seconds
  if (update.pre_checkout_query) {
    await handlePreCheckoutQuery(update.pre_checkout_query);
    return;
  }

  const msg = update.message;
  if (!msg) return;

  // Stars: successful_payment arrives as a message field
  if (msg.successful_payment && msg.from?.id) {
    await handleSuccessfulPayment(String(msg.from.id), msg.successful_payment);
    return;
  }

  const chatId = msg.chat.id;
  const text = msg.text ?? "";
  const firstName = msg.from?.first_name ?? "there";
  const langCode = msg.from?.language_code;

  if (text.startsWith("/start")) {
    await handleStart(chatId, firstName, langCode);
  } else if (text.startsWith("/help")) {
    await handleHelp(chatId, firstName, langCode);
  }
  // silently ignore everything else
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TgSuccessfulPayment {
  currency: string;
  total_amount: number;
  invoice_payload: string;
  telegram_payment_charge_id: string;
}

interface TgPreCheckoutQuery {
  id: string;
  from: { id: number };
  currency: string;
  total_amount: number;
  invoice_payload: string;
}

interface TgMessage {
  chat: { id: number };
  from?: { id: number; first_name: string; language_code?: string; username?: string };
  text?: string;
  successful_payment?: TgSuccessfulPayment;
}

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  pre_checkout_query?: TgPreCheckoutQuery;
}

// ── Webhook registration ──────────────────────────────────────────────────────

export async function registerWebhook(): Promise<void> {
  if (!TOKEN) {
    logger.warn("bot: TELEGRAM_BOT_TOKEN not set — skipping webhook registration");
    return;
  }

  if (!MINI_APP_URL) {
    logger.warn("bot: MINI_APP_URL / REPLIT_DOMAINS not set — skipping webhook registration");
    return;
  }

  const webhookUrl = MINI_APP_URL.replace(/\/$/, "") + "/api/bot/webhook";
  const secret = webhookSecret();

  logger.info({ webhookUrl }, "bot: registering webhook");

  const result = await callTg("setWebhook", {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ["message", "pre_checkout_query"],
    drop_pending_updates: false,
  }) as { ok?: boolean; description?: string } | null;

  if (result?.ok) {
    logger.info("bot: webhook registered successfully");

    await callTg("setMyCommands", {
      commands: [
        { command: "start",  description: "بدء التشغيل / Start" },
        { command: "help",   description: "المساعدة / Help" },
      ],
    });

    await callTg("setMyName", { name: "Souqrates System" }).catch(() => {});
    await callTg("setMyDescription", { description: "🎮 منصة ألعاب وكسب المكافآت | Gaming & rewards platform\nالعب، تنافس، واربح مع Souqrates System!" }).catch(() => {});
  } else {
    logger.warn({ result }, "bot: webhook registration failed");
  }
}

export default router;
