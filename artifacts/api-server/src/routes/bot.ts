/**
 * Telegram Bot webhook handler
 *
 * POST /api/bot/webhook
 *   - Secured via X-Telegram-Bot-Api-Secret-Token header
 *   - Handles /start command → sends welcome message + Mini App button
 *   - Handles /help command
 *   - Silently ignores everything else
 */

import { Router, type Request, type Response } from "express";
import { createHmac } from "crypto";
import { logger } from "../lib/logger";

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

// ── Webhook secret token (derived from bot token — same approach Telegram recommends) ──

function webhookSecret(): string {
  // Telegram requires secret_token to be 1-256 chars, only A-Za-z0-9_-
  // We derive it by HMAC-SHA256 of "webhook" using bot token, then hex-encode
  return createHmac("sha256", TOKEN).update("webhook-secret").digest("hex").slice(0, 64);
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
  // Validate secret token header
  const secret = webhookSecret();
  const incoming = req.headers["x-telegram-bot-api-secret-token"] as string | undefined;

  if (TOKEN && incoming !== secret) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Always respond 200 immediately so Telegram doesn't retry
  res.json({ ok: true });

  // Process update async (fire and forget)
  const update = req.body as TgUpdate;

  processUpdate(update).catch((err) => {
    logger.error({ err }, "bot: unhandled error in processUpdate");
  });
});

async function processUpdate(update: TgUpdate) {
  const msg = update.message;
  if (!msg) return; // ignore non-message updates (inline queries, etc.)

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

interface TgMessage {
  chat: { id: number };
  from?: { first_name: string; language_code?: string; username?: string };
  text?: string;
}

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}

// ── Webhook registration helper (called at startup) ───────────────────────────

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
    allowed_updates: ["message"],
    drop_pending_updates: false,
  }) as { ok?: boolean; description?: string } | null;

  if (result?.ok) {
    logger.info("bot: webhook registered successfully");

    // Set bot commands so they appear in the Telegram UI
    await callTg("setMyCommands", {
      commands: [
        { command: "start",  description: "بدء التشغيل / Start" },
        { command: "help",   description: "المساعدة / Help" },
      ],
    });

    // Set bot name and description
    await callTg("setMyName", { name: "Souqrates System" }).catch(() => {});
    await callTg("setMyDescription", { description: "🎮 منصة ألعاب وكسب المكافآت | Gaming & rewards platform\nالعب، تنافس، واربح مع Souqrates System!" }).catch(() => {});
  } else {
    logger.warn({ result }, "bot: webhook registration failed");
  }
}

export default router;
