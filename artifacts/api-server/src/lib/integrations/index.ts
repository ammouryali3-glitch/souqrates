import { db } from "@workspace/db";
import { adminConfigTable } from "@workspace/db/schema";
import { eq } from "@workspace/db";
import { logger } from "../logger";
import { initRedis, destroyRedis } from "./redis";
import { initR2, destroyR2 } from "./r2";
import { initSentry, destroySentry } from "./sentry-node";

export interface IntegrationConfig {
  redis: {
    enabled: boolean;
    restUrl: string;
    restToken: string;
    rateLimitPerMin: number;
  };
  r2: {
    enabled: boolean;
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    publicUrl: string;
  };
  sentry: {
    enabled: boolean;
    backendDsn: string;
    frontendDsn: string;
  };
  cloudflare: {
    enabled: boolean;
    workerUrl: string;
    zoneId: string;
    apiToken: string;
  };
}

export const DEFAULT_INTEGRATION_CONFIG: IntegrationConfig = {
  redis: { enabled: false, restUrl: "", restToken: "", rateLimitPerMin: 120 },
  r2: { enabled: false, accountId: "", accessKeyId: "", secretAccessKey: "", bucketName: "", publicUrl: "" },
  sentry: { enabled: false, backendDsn: "", frontendDsn: "" },
  cloudflare: { enabled: false, workerUrl: "", zoneId: "", apiToken: "" },
};

let currentConfig: IntegrationConfig = structuredClone(DEFAULT_INTEGRATION_CONFIG);

function applyConfig(config: IntegrationConfig): void {
  // Redis
  destroyRedis();
  if (config.redis.enabled && config.redis.restUrl && config.redis.restToken) {
    initRedis({ restUrl: config.redis.restUrl, restToken: config.redis.restToken, rateLimitPerMin: config.redis.rateLimitPerMin });
  }

  // R2
  destroyR2();
  if (config.r2.enabled && config.r2.accountId && config.r2.accessKeyId && config.r2.secretAccessKey && config.r2.bucketName) {
    initR2({
      accountId: config.r2.accountId,
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
      bucketName: config.r2.bucketName,
      publicUrl: config.r2.publicUrl,
    });
  }

  // Sentry
  destroySentry();
  if (config.sentry.enabled && config.sentry.backendDsn) {
    initSentry({ backendDsn: config.sentry.backendDsn });
  }

  currentConfig = config;
}

export async function loadAndApplyIntegrations(): Promise<void> {
  try {
    const [row] = await db.select().from(adminConfigTable).where(eq(adminConfigTable.key, "integrations"));
    if (row?.value) {
      const saved = row.value as Partial<IntegrationConfig>;
      const merged: IntegrationConfig = {
        redis: { ...DEFAULT_INTEGRATION_CONFIG.redis, ...(saved.redis ?? {}) },
        r2: { ...DEFAULT_INTEGRATION_CONFIG.r2, ...(saved.r2 ?? {}) },
        sentry: { ...DEFAULT_INTEGRATION_CONFIG.sentry, ...(saved.sentry ?? {}) },
        cloudflare: { ...DEFAULT_INTEGRATION_CONFIG.cloudflare, ...(saved.cloudflare ?? {}) },
      };
      applyConfig(merged);
      logger.info("Integration config loaded from DB");
    } else {
      logger.info("No integrations config in DB — using defaults (all disabled)");
    }
  } catch (err) {
    logger.error({ err }, "Failed to load integrations config");
  }
}

export async function updateIntegrations(incoming: IntegrationConfig): Promise<void> {
  const merged: IntegrationConfig = {
    redis: { ...currentConfig.redis, ...incoming.redis },
    r2: { ...currentConfig.r2, ...incoming.r2 },
    sentry: { ...currentConfig.sentry, ...incoming.sentry },
    cloudflare: { ...currentConfig.cloudflare, ...incoming.cloudflare },
  };
  await db.insert(adminConfigTable)
    .values({ key: "integrations", value: merged })
    .onConflictDoUpdate({ target: adminConfigTable.key, set: { value: merged, updatedAt: new Date() } });
  applyConfig(merged);
  logger.info("Integration config updated and reloaded");
}

export function getCurrentIntegrationConfig(): IntegrationConfig {
  return currentConfig;
}

/** Returns config with secrets masked for sending to the frontend */
export function getMaskedConfig(): IntegrationConfig {
  const c = currentConfig;
  return {
    redis: {
      ...c.redis,
      restUrl: c.redis.restUrl ? c.redis.restUrl : "",
      restToken: c.redis.restToken ? "••••••••" : "",
    },
    r2: {
      ...c.r2,
      accessKeyId: c.r2.accessKeyId ? "••••••••" : "",
      secretAccessKey: c.r2.secretAccessKey ? "••••••••" : "",
      apiToken: "",
    } as IntegrationConfig["r2"],
    sentry: {
      ...c.sentry,
      // backendDsn is a server-side secret; frontendDsn is intentionally public
      // (it ships in the client bundle), so it stays unmasked for the UI to use.
      backendDsn: c.sentry.backendDsn ? "••••••••" : "",
    },
    cloudflare: {
      ...c.cloudflare,
      apiToken: c.cloudflare.apiToken ? "••••••••" : "",
    },
  };
}

/** Merges incoming form data, keeping "••••••••" values as the existing secret */
export function mergeWithSecrets(incoming: IntegrationConfig): IntegrationConfig {
  const cur = currentConfig;
  return {
    redis: {
      ...incoming.redis,
      restToken: incoming.redis.restToken === "••••••••" ? cur.redis.restToken : incoming.redis.restToken,
    },
    r2: {
      ...incoming.r2,
      accessKeyId: incoming.r2.accessKeyId === "••••••••" ? cur.r2.accessKeyId : incoming.r2.accessKeyId,
      secretAccessKey: incoming.r2.secretAccessKey === "••••••••" ? cur.r2.secretAccessKey : incoming.r2.secretAccessKey,
    },
    sentry: {
      ...incoming.sentry,
      backendDsn: incoming.sentry.backendDsn === "••••••••" ? cur.sentry.backendDsn : incoming.sentry.backendDsn,
    },
    cloudflare: {
      ...incoming.cloudflare,
      apiToken: incoming.cloudflare.apiToken === "••••••••" ? cur.cloudflare.apiToken : incoming.cloudflare.apiToken,
    },
  };
}
