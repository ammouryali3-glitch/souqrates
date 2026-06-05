import { pgTable, text, bigint, timestamp } from "drizzle-orm/pg-core";

export const appNotificationsTable = pgTable("app_notifications", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type", { enum: ["info", "success", "warning", "promo"] }).notNull(),
  startAt: bigint("start_at", { mode: "number" }).notNull(),
  endAt: bigint("end_at", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AppNotification = typeof appNotificationsTable.$inferSelect;
