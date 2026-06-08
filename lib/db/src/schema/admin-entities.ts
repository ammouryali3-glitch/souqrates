import { pgTable, text, jsonb, timestamp, integer, index, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Platform (mini-app) users managed in the admin dashboard.
 * Full ManagedUser object stored as JSONB to preserve nested shape.
 */
export const platformUsersTable = pgTable("platform_users", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const depositsTable = pgTable("deposits", {
  id: text("id").primaryKey(),
  status: text("status", { enum: ["pending", "confirmed"] }).notNull().default("pending"),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const withdrawalsTable = pgTable("withdrawals", {
  id: text("id").primaryKey(),
  status: text("status", {
    enum: ["pending", "approved", "rejected", "completed"],
  }).notNull().default("pending"),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tokenPackagesTable = pgTable("token_packages", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inventoryItemsTable = pgTable("inventory_items", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const socialTasksTable = pgTable("social_tasks", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const promoCodesTable = pgTable("promo_codes", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const broadcastsTable = pgTable("broadcasts", {
  id: text("id").primaryKey(),
  status: text("status", { enum: ["scheduled", "sent", "draft"] }).notNull().default("draft"),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportTicketsTable = pgTable("support_tickets", {
  id: text("id").primaryKey(),
  status: text("status", { enum: ["open", "answered", "closed"] }).notNull().default("open"),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shopProductsTable = pgTable("shop_products", {
  id: integer("id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const referrersTable = pgTable("referrers", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Email OTP codes for browser-based login (non-Telegram users).
 * Each row is single-use; expired or used rows are cleaned up on login.
 */
export const emailOtpsTable = pgTable("email_otps", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  used: boolean("used").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("email_otps_email_idx").on(t.email),
]);

/**
 * Financial ledger — one immutable row for every SKZ credit or debit.
 * Provides a full audit trail so any balance can be reconstructed from history.
 */
export const balanceTransactionsTable = pgTable("balance_transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type", { enum: ["credit", "debit"] }).notNull(),
  reason: text("reason").notNull(), // game_win | game_fee | deposit | withdrawal | prize | referral | checkin | purchase | refund | starting_balance | admin
  currency: text("currency").notNull().default("SKZ"),
  amount: integer("amount").notNull(),          // always positive; direction is in `type`
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  ref: text("ref"),                             // external ID (depositId, gameId, …)
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("bal_tx_user_created_idx").on(t.userId, t.createdAt),
  index("bal_tx_reason_idx").on(t.reason),
]);

/**
 * Daily check-in records — one row per user per UTC day.
 * Unique index on (user_id, date) prevents double check-ins.
 */
export const dailyCheckinsTable = pgTable("daily_checkins", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),                 // "YYYY-MM-DD" UTC
  streak: integer("streak").notNull().default(1),
  reward: integer("reward").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("daily_checkins_user_date_idx").on(t.userId, t.date),
  index("daily_checkins_user_idx").on(t.userId),
]);

/**
 * Individual game result records — one row per play per user.
 * Leaderboards are computed from this table (best score per user per period).
 * Pool is derived from SUM(fee_paid) for the current period.
 */
export const gameResultsTable = pgTable("game_results", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  gameId: text("game_id").notNull(),
  score: integer("score").notNull(),
  timeSec: integer("time_sec").notNull(),
  name: text("name").notNull(),
  feePaid: integer("fee_paid").notNull().default(0),
  period: text("period", { enum: ["daily", "weekly"] }).notNull().default("daily"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("game_results_game_period_idx").on(t.gameId, t.period, t.createdAt),
  index("game_results_user_game_idx").on(t.userId, t.gameId),
]);

/**
 * Idempotency guard for prize payouts.
 * One row per (game_id, period_end) — if the row already exists the scheduler
 * skips crediting the winner a second time, making payouts safe to retry.
 */
export const prizePaidOutsTable = pgTable("prize_payouts", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull(),
  period: text("period", { enum: ["daily", "weekly"] }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  winnerId: text("winner_id").notNull(),
  prize: integer("prize").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("prize_payouts_game_period_end_idx").on(t.gameId, t.periodEnd),
]);
