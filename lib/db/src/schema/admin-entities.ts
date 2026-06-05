import { pgTable, text, jsonb, timestamp, integer } from "drizzle-orm/pg-core";

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
