import { pgTable, text, jsonb, timestamp, integer, index } from "drizzle-orm/pg-core";

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
