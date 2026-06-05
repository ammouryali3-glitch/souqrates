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
 * This scheduler fires at every UTC midnight to log the reset event and, in
 * the future, can be extended to archive snapshots or award prize pool winners.
 */
import { logger } from "./logger";

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
      logger.info("leaderboard reset: period boundary reached — no rows deleted (history preserved for all-time leaderboard)");
      scheduleNext();
    }, delayMs).unref();
  }

  scheduleNext();
}
