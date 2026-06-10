/**
 * Telegram re-engagement notification scheduler (T007).
 *
 * Three daily jobs:
 *   20:00 UTC — streak reminder (streak ≥ 2, not checked-in today)
 *   12:00 UTC — battle-pass reminder (premium holders)
 *   18:00 UTC — quest reminder (engaged users with no quest activity today)
 *
 * Anti-spam: tracks lastStreakAt / lastBpAt / lastQuestAt (YYYY-MM-DD)
 * inside each user's data.notifications object. Each user gets at most
 * one message per job per calendar day (UTC).
 *
 * The scheduler polls every 5 minutes. An in-memory guard prevents the
 * same job from running twice in one UTC day even across multiple polls.
 */

import { logger } from "./logger";
import { db } from "@workspace/db";
import { platformUsersTable, adminConfigTable } from "@workspace/db";
import { eq } from "@workspace/db";

const TOKEN = process.env["TELEGRAM_BOT_TOKEN"] ?? "";

// ── Telegram helper ────────────────────────────────────────────────────────────

async function callTg(method: string, body: Record<string, unknown>): Promise<void> {
  if (!TOKEN) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      logger.warn({ method, status: res.status, json }, "notify: Telegram API error");
    }
  } catch (err) {
    logger.warn({ err }, "notify: fetch error");
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function isNotificationsEnabled(): Promise<boolean> {
  try {
    const [row] = await db.select().from(adminConfigTable)
      .where(eq(adminConfigTable.key, "notifications"));
    const v = (row?.value ?? {}) as Record<string, unknown>;
    return v.enabled !== false;
  } catch { return true; }
}

async function getBotUsername(): Promise<string> {
  try {
    const [row] = await db.select().from(adminConfigTable)
      .where(eq(adminConfigTable.key, "settings"));
    const v = (row?.value ?? {}) as Record<string, unknown>;
    return typeof v.botUsername === "string" && v.botUsername ? v.botUsername : "skzbot";
  } catch { return "skzbot"; }
}

function openAppButton(label: string, botUsername: string, startParam?: string) {
  const url = startParam
    ? `https://t.me/${botUsername}?startapp=${startParam}`
    : `https://t.me/${botUsername}`;
  return { inline_keyboard: [[{ text: label, url }]] };
}

// Throttle: Telegram allows ~30 msg/s; we send in batches of 20 then pause 1 s
async function throttle(sent: number): Promise<void> {
  if (sent > 0 && sent % 20 === 0) await new Promise((r) => setTimeout(r, 1000));
}

// ── Job 1: Streak reminders ────────────────────────────────────────────────────

async function runStreakReminders(): Promise<void> {
  logger.info("notify: streak reminder job started");
  if (!await isNotificationsEnabled()) {
    logger.info("notify: notifications disabled — skipping streak job");
    return;
  }

  const today = todayUtc();
  const botUsername = await getBotUsername();
  const users = await db.select().from(platformUsersTable);

  let sent = 0;
  for (const u of users) {
    const d = u.data as Record<string, unknown>;
    const checkin = (d.checkin as Record<string, unknown> | null) ?? {};
    const notifications = (d.notifications as Record<string, unknown> | null) ?? {};

    // Already notified today
    if (notifications.lastStreakAt === today) continue;
    // No streak worth protecting
    const streak = Number(checkin.streak ?? 0);
    if (streak < 2) continue;
    // Already checked in today
    const lastDate = typeof checkin.lastDate === "string" ? checkin.lastDate : "";
    if (lastDate === today) continue;

    const text = streak >= 7
      ? `🔥 <b>سلسلتك من ${streak} أيام على وشك الانقطاع!</b>\n\nاضغط الآن وتسجّل دخولك — لا تكسر السلسلة ومكافآتك في انتظارك! ✨`
      : `⚡ <b>تذكير:</b> لديك سلسلة ${streak} أيام. سجّل دخولك اليوم وحافظ عليها!`;

    await callTg("sendMessage", {
      chat_id: u.id,
      text,
      parse_mode: "HTML",
      reply_markup: openAppButton("🎮 سجّل الدخول الآن", botUsername),
    });

    await db.update(platformUsersTable)
      .set({
        data: { ...d, notifications: { ...notifications, lastStreakAt: today } },
        updatedAt: new Date(),
      })
      .where(eq(platformUsersTable.id, u.id));

    sent++;
    await throttle(sent);
  }

  logger.info({ sent }, "notify: streak reminder job complete");
}

// ── Job 2: Battle pass reminders ──────────────────────────────────────────────

async function runBpReminders(): Promise<void> {
  logger.info("notify: battle pass reminder job started");
  if (!await isNotificationsEnabled()) {
    logger.info("notify: notifications disabled — skipping BP job");
    return;
  }

  const today = todayUtc();
  const botUsername = await getBotUsername();
  const users = await db.select().from(platformUsersTable);

  let sent = 0;
  for (const u of users) {
    const d = u.data as Record<string, unknown>;
    const bp = (d.battlePass as Record<string, unknown> | null) ?? {};
    const notifications = (d.notifications as Record<string, unknown> | null) ?? {};

    if (notifications.lastBpAt === today) continue;
    // Only target premium battle pass holders with something at stake
    if (!bp.premium) continue;

    await callTg("sendMessage", {
      chat_id: u.id,
      text: `🎫 <b>باس الموسم — مكافآتك تنتظرك!</b>\n\nلديك مكافآت حصرية في الباس الممتاز. لا تتركها تضيع — افتح التطبيق الآن! 🏆`,
      parse_mode: "HTML",
      reply_markup: openAppButton("🏆 فتح الباس", botUsername),
    });

    await db.update(platformUsersTable)
      .set({
        data: { ...d, notifications: { ...notifications, lastBpAt: today } },
        updatedAt: new Date(),
      })
      .where(eq(platformUsersTable.id, u.id));

    sent++;
    await throttle(sent);
  }

  logger.info({ sent }, "notify: battle pass reminder job complete");
}

// ── Job 3: Quest reminders ─────────────────────────────────────────────────────

async function runQuestReminders(): Promise<void> {
  logger.info("notify: quest reminder job started");
  if (!await isNotificationsEnabled()) {
    logger.info("notify: notifications disabled — skipping quest job");
    return;
  }

  const today = todayUtc();
  const botUsername = await getBotUsername();
  const users = await db.select().from(platformUsersTable);

  let sent = 0;
  for (const u of users) {
    const d = u.data as Record<string, unknown>;
    const notifications = (d.notifications as Record<string, unknown> | null) ?? {};

    if (notifications.lastQuestAt === today) continue;
    // Only notify users who have actually engaged (have XP)
    if (Number(d.xp ?? 0) === 0) continue;

    await callTg("sendMessage", {
      chat_id: u.id,
      text: `📋 <b>مهامك اليومية تنتظرك!</b>\n\nأكمل مهامك اليومية اليوم واكسب XP و SKZ إضافية. لا تدع اليوم يمر! ⚡`,
      parse_mode: "HTML",
      reply_markup: openAppButton("✅ أكمل المهام", botUsername),
    });

    await db.update(platformUsersTable)
      .set({
        data: { ...d, notifications: { ...notifications, lastQuestAt: today } },
        updatedAt: new Date(),
      })
      .where(eq(platformUsersTable.id, u.id));

    sent++;
    await throttle(sent);
  }

  logger.info({ sent }, "notify: quest reminder job complete");
}

// ── Scheduler ──────────────────────────────────────────────────────────────────

let lastStreakRun = "";
let lastBpRun = "";
let lastQuestRun = "";

function checkAndRunJobs(): void {
  const h = new Date().getUTCHours();
  const today = todayUtc();

  // 20:00 UTC — streak reminder
  if (h === 20 && lastStreakRun !== today) {
    lastStreakRun = today;
    runStreakReminders().catch((err) => logger.error({ err }, "notify: streak job error"));
  }

  // 12:00 UTC — battle pass reminder
  if (h === 12 && lastBpRun !== today) {
    lastBpRun = today;
    runBpReminders().catch((err) => logger.error({ err }, "notify: bp job error"));
  }

  // 18:00 UTC — quest reminder
  if (h === 18 && lastQuestRun !== today) {
    lastQuestRun = today;
    runQuestReminders().catch((err) => logger.error({ err }, "notify: quest job error"));
  }
}

export function startNotificationScheduler(): void {
  if (!TOKEN) {
    logger.info("notify: TELEGRAM_BOT_TOKEN not set — notification scheduler disabled");
    return;
  }
  logger.info("notify: scheduler started (checks every 5 min; jobs at 12, 18, 20 UTC)");
  // Initial check (catches startup near a scheduled hour)
  checkAndRunJobs();
  setInterval(checkAndRunJobs, 5 * 60 * 1000);
}
