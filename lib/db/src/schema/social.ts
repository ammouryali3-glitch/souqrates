import { pgTable, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Clans — user-created teams that compete on the global leaderboard by
 * total member XP. A user can belong to at most one clan at a time.
 * Membership is recorded in platform_users.data.clanId (JSONB).
 */
export const clansTable = pgTable("clans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tag: text("tag").notNull(),          // 3-6 uppercase alphanumeric, unique
  ownerId: text("owner_id").notNull(), // platform_users.id of the founder
  memberCount: integer("member_count").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("clans_tag_idx").on(t.tag),
]);

/**
 * Game challenges — one user sets a score; another user tries to beat it.
 * Links are shared via Telegram deep link: ?startapp=ch_<id>
 */
export const gameChallengesTable = pgTable("game_challenges", {
  id: text("id").primaryKey(),
  challengerId: text("challenger_id").notNull(),
  challengerName: text("challenger_name").notNull(),
  gameId: text("game_id").notNull(),
  gameName: text("game_name").notNull(),
  score: integer("score").notNull(),
  status: text("status", { enum: ["open", "beaten", "expired"] })
    .notNull()
    .default("open"),
  opponentId: text("opponent_id"),
  opponentScore: integer("opponent_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
