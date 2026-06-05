import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adminAccountsTable = pgTable("admin_accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  handle: text("handle").notNull().unique(),
  role: text("role", { enum: ["owner", "support", "accountant", "moderator"] }).notNull(),
  passwordHash: text("password_hash").notNull(),
  permissions: text("permissions").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAdminAccountSchema = createInsertSchema(adminAccountsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertAdminAccount = z.infer<typeof insertAdminAccountSchema>;
export type AdminAccount = typeof adminAccountsTable.$inferSelect;
