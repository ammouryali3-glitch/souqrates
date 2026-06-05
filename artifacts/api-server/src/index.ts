import app from "./app";
import { logger } from "./lib/logger";
import { seedDatabaseIfEmpty, migrateRolesConfigIfNeeded } from "./lib/seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Seed database with demo data if empty (non-blocking)
  seedDatabaseIfEmpty().catch((err) => {
    logger.error({ err }, "Failed to seed database");
  });

  // Fix roles config shape from old object-permissions format to AdminRole[]
  migrateRolesConfigIfNeeded().catch((err) => {
    logger.error({ err }, "Failed to migrate roles config");
  });
});
