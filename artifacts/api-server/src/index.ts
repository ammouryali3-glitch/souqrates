import app from "./app";
import { logger } from "./lib/logger";
import { seedDatabaseIfEmpty, migrateRolesConfigIfNeeded, ensureOwnerAccount, ensureIndexes, ensureShopProducts, ensureAdminSchema } from "./lib/seed";
import { startDepositPoller } from "./lib/ton-poller";
import { startLeaderboardResetScheduler } from "./lib/leaderboard-reset";
import { registerWebhook } from "./routes/bot";
import { loadAndApplyIntegrations } from "./lib/integrations";
import { startNotificationScheduler } from "./lib/notifications";

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

  // Run startup tasks sequentially where ordering matters:
  // 1. Ensure schema tables exist FIRST (creates admin_accounts / admin_config if missing).
  // 2. Then seed / bootstrap data that depends on those tables.
  // The rest (indexes, products, roles migration) are independent and fire in parallel.
  ensureAdminSchema()
    .then(() => Promise.all([
      seedDatabaseIfEmpty().catch((err) => logger.error({ err }, "Failed to seed database")),
      migrateRolesConfigIfNeeded().catch((err) => logger.error({ err }, "Failed to migrate roles config")),
      ensureOwnerAccount().catch((err) => logger.error({ err }, "Failed to ensure owner account")),
      ensureIndexes().catch((err) => logger.error({ err }, "Failed to ensure indexes")),
      ensureShopProducts().catch((err) => logger.error({ err }, "Failed to seed shop products")),
    ]))
    .catch((err) => logger.error({ err }, "Failed to ensure admin schema"));

  // Start the blockchain deposit poller (non-blocking; log errors but keep server alive)
  try {
    startDepositPoller();
  } catch (err) {
    logger.error({ err }, "Failed to start deposit poller");
  }

  // Purge stale leaderboard rows and schedule recurring resets at UTC midnight
  try {
    startLeaderboardResetScheduler();
  } catch (err) {
    logger.error({ err }, "Failed to start leaderboard reset scheduler");
  }

  // Register Telegram bot webhook (non-blocking)
  registerWebhook().catch((err) => {
    logger.error({ err }, "Failed to register Telegram webhook");
  });

  // Load and apply external integrations config from DB (Redis, R2, Sentry, Cloudflare)
  loadAndApplyIntegrations().catch((err) => {
    logger.error({ err }, "Failed to load integrations config");
  });

  // Start Telegram re-engagement notification scheduler (streak, BP, quests)
  try {
    startNotificationScheduler();
  } catch (err) {
    logger.error({ err }, "Failed to start notification scheduler");
  }
});
