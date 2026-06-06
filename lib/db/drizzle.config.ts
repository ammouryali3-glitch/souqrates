import { defineConfig } from "drizzle-kit";
import path from "path";

// Migrations must go through the DIRECT connection (not the session/transaction
// pooler) because drizzle-kit uses multiple statements in a single transaction.
// - Supabase direct URL  → DATABASE_DIRECT_URL (port 5432, db.xxx.supabase.co)
// - Supabase pooler URL  → DATABASE_URL        (port 5432, pooler.supabase.com)
// Fall back to DATABASE_URL when DIRECT isn't set (local / Replit dev).
const migrationUrl = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error(
    "DATABASE_URL (or DATABASE_DIRECT_URL) must be set for migrations",
  );
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: migrationUrl,
    ssl: process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  },
});
