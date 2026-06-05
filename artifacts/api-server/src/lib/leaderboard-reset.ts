/**
 * Leaderboard reset scheduler.
 *
 * Period leaderboards (daily/weekly) are scoped by created_at in the query —
 * old game_results rows are already excluded by the WHERE created_at >= since
 * filter in the leaderboard endpoint. There is no need to delete them.
 *
 * Rows are intentionally preserved indefinitely so that the all-time Hall of
 * Fame (GET /api/user/leaderboard/:gameId?period=alltime) can query the full
 * history without any data being purged.
 *
 * This scheduler fires at every UTC midnight to:
 *   1. Award prize pool winners for the daily arena games (every night).
 *   2. Award prize pool winners for the weekly arena games (Monday nights only).
 */
import { logger } from "./logger";
import { awardPeriodWinners } from "./prize-awards";

/** Milliseconds from now until the next UTC midnight. */
function msUntilNextUtcMidnight(): number {
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  return next.getTime() - Date.now();
}

/**
 * Start the leaderboard period-boundary scheduler.
 * Call once from index.ts after the server starts listening.
 */
export function startLeaderboardResetScheduler(): void {
  function scheduleNext(): void {
    const delayMs = msUntilNextUtcMidnight();
    logger.info(
      { nextResetInMs: delayMs },
      "leaderboard reset: next period boundary scheduled at UTC midnight",
    );

    setTimeout(() => {
      // Snap to the exact midnight that just passed so period boundaries are
      // deterministic regardless of setTimeout drift.
      const periodEnd = new Date();
      periodEnd.setUTCHours(0, 0, 0, 0);

      logger.info(
        { periodEnd: periodEnd.toISOString() },
        "leaderboard reset: period boundary reached — awarding prize pool winners",
      );

      // ── 1. Daily games — award every night ──────────────────────────────
      const prevDailyStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);
      awardPeriodWinners("daily", prevDailyStart, periodEnd).catch((err) => {
        logger.error({ err }, "leaderboard reset: daily prize award failed");
      });

      // ── 2. Weekly games — award only on Monday (day 1) ──────────────────
      if (periodEnd.getUTCDay() === 1) {
        const prevWeeklyStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
        awardPeriodWinners("weekly", prevWeeklyStart, periodEnd).catch((err) => {
          logger.error({ err }, "leaderboard reset: weekly prize award failed");
        });
      }

      scheduleNext();
    }, delayMs).unref();
  }

  scheduleNext();
}
