/**
 * Prize pool awards — credits the top-ranked player for each arena game
 * at the end of each period (daily at every UTC midnight, weekly on Mondays).
 *
 * Called from leaderboard-reset.ts after each period boundary.
 *
 * Credit path:
 *   - Reads the best score row(s) from game_results for the period that just ended.
 *   - Calculates the prize pool the same way the leaderboard endpoint does:
 *     floor(totalFees * poolShare).
 *   - Credits the winner's data.balances.SKZ field inside a locked transaction.
 *   - Inserts a broadcast app_notification so the winner (and all players) see the result.
 *
 * Admin activity:
 *   - Every payout, skip, and error is logged with structured fields that admins
 *     can observe in the server log stream.
 */
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { recordLedger } from "./ledger";
import { bumpQuests } from "./quests";
import {
  platformUsersTable,
  gameResultsTable as _gameResultsTable,
  adminConfigTable,
  appNotificationsTable,
  prizePaidOutsTable,
} from "@workspace/db";
import { eq, sql } from "@workspace/db";
import { logger } from "./logger";

// ── Arena game catalogue (server-authoritative, mirrors games-data.ts tags) ───

interface ArenaGameMeta {
  id: string;
  period: "daily" | "weekly";
  title: string;
}

const ARENA_GAMES: ArenaGameMeta[] = [
  { id: "detective",  period: "weekly", title: "The Detective" },
  { id: "cipher",     period: "daily",  title: "Cipher Rush" },
  { id: "hiddenpath", period: "weekly", title: "Hidden Path" },
  { id: "geniusgrid", period: "daily",  title: "Genius Grid" },
  { id: "truthscale", period: "weekly", title: "Truth Scale" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

interface WinnerRow {
  user_id: string;
  name: string;
  score: number;
  time_sec: number;
  total_fees: number;
}

/** Fetch the poolShare fraction (1 − rake/100) from admin_config. */
async function getPoolShare(gameId: string): Promise<number> {
  try {
    const [overridesRow, settingsRow] = await Promise.all([
      db.select().from(adminConfigTable).where(eq(adminConfigTable.key, "game_overrides")).limit(1),
      db.select().from(adminConfigTable).where(eq(adminConfigTable.key, "settings")).limit(1),
    ]);
    const overrides = (overridesRow[0]?.value ?? {}) as Record<string, unknown>;
    const ov = (overrides[gameId] ?? {}) as Record<string, unknown>;
    const settings = (settingsRow[0]?.value ?? {}) as Record<string, unknown>;
    const rake =
      typeof ov.rake === "number"
        ? ov.rake
        : typeof settings.platformRake === "number"
          ? settings.platformRake
          : 30;
    return Math.min(1, Math.max(0, 1 - rake / 100));
  } catch {
    return 0.7;
  }
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Award the prize pool winner for every arena game whose period type matches
 * the one that just ended.
 *
 * @param period     - The period type ("daily" | "weekly") that just closed.
 * @param prevStart  - The UTC start of the period that just ended.
 * @param periodEnd  - The UTC boundary (midnight) at which the period closed.
 */
export async function awardPeriodWinners(
  period: "daily" | "weekly",
  prevStart: Date,
  periodEnd: Date,
): Promise<void> {
  const games = ARENA_GAMES.filter((g) => g.period === period);

  for (const game of games) {
    try {
      // ── 1. Find the winning player and the total fee pot for the period ──

      const result = await db.execute(sql`
        WITH best AS (
          SELECT DISTINCT ON (user_id)
            user_id,
            name,
            score,
            time_sec
          FROM game_results
          WHERE game_id    = ${game.id}
            AND period     = ${period}
            AND created_at >= ${prevStart}
            AND created_at <  ${periodEnd}
          ORDER BY user_id, score DESC, time_sec ASC
        ),
        fees AS (
          SELECT COALESCE(SUM(fee_paid), 0)::int AS total_fees
          FROM game_results
          WHERE game_id    = ${game.id}
            AND period     = ${period}
            AND created_at >= ${prevStart}
            AND created_at <  ${periodEnd}
        )
        SELECT
          b.user_id,
          b.name,
          b.score::int      AS score,
          b.time_sec::int   AS time_sec,
          f.total_fees
        FROM (
          SELECT * FROM best ORDER BY score DESC, time_sec ASC LIMIT 1
        ) b
        CROSS JOIN fees f
      `);

      const rows = result.rows as unknown as WinnerRow[];

      if (rows.length === 0 || !rows[0]?.user_id) {
        logger.info(
          { gameId: game.id, period },
          "prize-award: no entries for period — skipping",
        );
        continue;
      }

      const winner = rows[0];
      const poolShare = await getPoolShare(game.id);
      const prize = Math.floor(Number(winner.total_fees) * poolShare);

      if (prize <= 0) {
        logger.info(
          { gameId: game.id, period, totalFees: winner.total_fees },
          "prize-award: zero prize pool — skipping",
        );
        continue;
      }

      // ── 2. Claim payout slot + credit winner inside one atomic transaction ──
      // The unique index on (game_id, period_end) ensures a duplicate scheduler
      // run cannot credit the winner twice — onConflictDoNothing returns 0 rows.

      const payoutId = randomBytes(12).toString("hex");
      let credited = false;
      let newSkz = 0;

      await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(prizePaidOutsTable)
          .values({
            id: payoutId,
            gameId: game.id,
            period,
            periodEnd,
            winnerId: winner.user_id,
            prize,
            createdAt: new Date(),
          })
          .onConflictDoNothing()
          .returning({ id: prizePaidOutsTable.id });

        if (inserted.length === 0) return; // already paid

        credited = true;

        const [row] = await tx
          .select()
          .from(platformUsersTable)
          .where(eq(platformUsersTable.id, winner.user_id))
          .for("update")
          .limit(1);

        if (!row) throw new Error(`User ${winner.user_id} not found`);

        const data = row.data as Record<string, unknown>;
        const currentSkz = Number(
          (data.balances as Record<string, unknown> | undefined)?.SKZ ?? 0,
        );
        newSkz = currentSkz + prize;

        const questsAfter = bumpQuests(data.quests, { skz_earned: prize }, new Date());

        await tx
          .update(platformUsersTable)
          .set({
            data: {
              ...data,
              balances: {
                ...(data.balances as Record<string, unknown> | undefined),
                SKZ: newSkz,
              },
              quests: questsAfter,
            },
            updatedAt: new Date(),
          })
          .where(eq(platformUsersTable.id, winner.user_id));

        await recordLedger(tx, {
          userId: winner.user_id,
          type: "credit",
          reason: "prize",
          amount: prize,
          balanceBefore: currentSkz,
          balanceAfter: newSkz,
          ref: `${game.id}:${period}`,
          meta: { gameTitle: game.title, score: winner.score, periodEnd: periodEnd.toISOString() },
        });
      });

      if (!credited) {
        logger.info(
          { gameId: game.id, period, periodEnd },
          "prize-award: duplicate run detected — payout already recorded, skipping",
        );
        continue;
      }

      logger.info(
        {
          gameId: game.id,
          gameTitle: game.title,
          period,
          winnerId: winner.user_id,
          winnerName: winner.name,
          score: winner.score,
          totalFees: winner.total_fees,
          poolShare,
          prize,
          newSkz,
        },
        "prize-award: winner credited — admin activity log",
      );

      // ── 3. Create a public broadcast notification ────────────────────────

      const notifId = randomBytes(12).toString("hex");
      const nowMs = Date.now();
      const periodLabel = period === "daily" ? "Daily" : "Weekly";

      await db.insert(appNotificationsTable).values({
        id: notifId,
        title: `🏆 ${periodLabel} Winner — ${game.title}`,
        message: `Congratulations to ${winner.name} for winning ${prize.toLocaleString()} SKZ in ${game.title}!`,
        type: "success",
        startAt: nowMs,
        endAt: nowMs + 24 * 60 * 60 * 1000, // visible for 24 h
        createdAt: new Date(),
      });

      logger.info(
        { notifId, gameId: game.id, winnerId: winner.user_id, prize },
        "prize-award: winner notification created",
      );
    } catch (err) {
      logger.error(
        { err, gameId: game.id, period },
        "prize-award: failed to award winner for game",
      );
    }
  }
}
