import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Key-value store for single-row admin configuration blobs.
 * Keys: "settings", "game_overrides", "ticket_overrides", "cms",
 *       "finance", "security", "backup", "referral_config",
 *       "daily_checkin", "api_keys"
 */
export const adminConfigTable = pgTable("admin_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminConfig = typeof adminConfigTable.$inferSelect;
