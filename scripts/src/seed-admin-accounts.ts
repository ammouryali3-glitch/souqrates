/**
 * Bootstrap the owner admin account.
 *
 * Run: pnpm --filter @workspace/scripts run seed-admin-accounts
 *
 * Reads ADMIN_OWNER_PASSWORD from the environment (must be set before running).
 * Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING.
 * To reset a password, update the account via the admin dashboard or directly in the DB.
 *
 * Non-owner accounts should be created through the admin dashboard by the owner.
 */
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { adminAccountsTable } from "@workspace/db";

const SALT_ROUNDS = 12;

async function main() {
  const ownerPassword = process.env.ADMIN_OWNER_PASSWORD;
  if (!ownerPassword || ownerPassword.length < 12) {
    console.error("ERROR: ADMIN_OWNER_PASSWORD env var must be set (minimum 12 characters).");
    console.error("  Example: ADMIN_OWNER_PASSWORD=<strong-random-password> pnpm --filter @workspace/scripts run seed-admin-accounts");
    process.exit(1);
  }

  console.log("Bootstrapping owner admin account…");
  const passwordHash = await bcrypt.hash(ownerPassword, SALT_ROUNDS);

  const inserted = await db
    .insert(adminAccountsTable)
    .values({
      id: "r1",
      name: "المالك",
      handle: "@owner",
      role: "owner",
      passwordHash,
      permissions: [],
      active: true,
      mustChangePassword: false,
    })
    .onConflictDoNothing()
    .returning({ id: adminAccountsTable.id });

  if (inserted.length > 0) {
    console.log("  ✓ @owner (owner) created");
  } else {
    console.log("  → @owner already exists, skipped");
  }

  console.log("Done. Create additional admins through the dashboard.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
