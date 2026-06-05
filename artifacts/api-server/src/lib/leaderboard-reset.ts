/**
 * Leaderboard reset scheduler.
 *
 * Purges game_results rows that fall outside the current period:
 *   - daily  → rows with created_at before UTC midnight today
 *   - weekly → rows with created_at before UTC midnight of the most-recent Monday
 *
 * Runs once on startup (to clear any accumulated stale rows) and then
 * reschedules itself to fire at every subsequent UTC midnight.
 * Uses .unref() so the timer never prevents a clean process exit.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function thisWeekMondayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

/** Milliseconds from now until the next UTC midnight. */
function msUntilNextUtcMidnight(): number {
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0); // advances date by 1 day at midnight
  return next.getTime() - Date.now();
}

/** Delete game_results rows that belong to a past period. */
async function purgeExpiredResults(): Promise<void> {
  const dailyCutoff = todayUtc();
  const weeklyCutoff = thisWeekMondayUtc();

  const [dailyResult, weeklyResult] = await Promise.all([
    db.execute(sql`
      DELETE FROM game_results
      WHERE period = 'daily' AND created_at < ${dailyCutoff}
    `),
    db.execute(sql`
      DELETE FROM game_results
      WHERE period = 'weekly' AND created_at < ${weeklyCutoff}
    `),
  ]);

  const dailyDeleted = Number(dailyResult.rowCount ?? 0);
  const weeklyDeleted = Number(weeklyResult.rowCount ?? 0);

  logger.info(
    { dailyDeleted, weeklyDeleted, dailyCutoff, weeklyCutoff },
    "leaderboard reset: purge complete",
  );
}

/**
 * Start the leaderboard reset scheduler.
 * Call once from index.ts after the server starts listening.
 */
export function startLeaderboardResetScheduler(): void {
  // Purge any stale rows immediately on startup.
  purgeExpiredResults().catch((err: unknown) => {
    logger.error({ err }, "leaderboard reset: startup purge failed");
  });

  function scheduleNext(): void {
    const delayMs = msUntilNextUtcMidnight();
    logger.info(
      { nextResetInMs: delayMs },
      "leaderboard reset: next purge scheduled at UTC midnight",
    );

    setTimeout(() => {
      purgeExpiredResults()
        .catch((err: unknown) => {
          logger.error({ err }, "leaderboard reset: scheduled purge failed");
        })
        .finally(() => {
          scheduleNext();
        });
    }, delayMs).unref();
  }

  scheduleNext();
}
