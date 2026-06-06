import { Redis } from "@upstash/redis";
import { logger } from "../logger";

let client: Redis | null = null;

export interface RedisConfig {
  restUrl: string;
  restToken: string;
  rateLimitPerMin: number;
}

export function initRedis(config: RedisConfig): void {
  try {
    client = new Redis({ url: config.restUrl, token: config.restToken });
    logger.info("Upstash Redis client initialized");
  } catch (err) {
    client = null;
    logger.error({ err }, "Failed to initialize Redis client");
  }
}

export function destroyRedis(): void {
  client = null;
}

export function getRedisClient(): Redis | null {
  return client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!client) return null;
  try {
    return await client.get<T>(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, exSeconds?: number): Promise<void> {
  if (!client) return;
  try {
    if (exSeconds) {
      await client.set(key, value, { ex: exSeconds });
    } else {
      await client.set(key, value);
    }
  } catch {
    // ignore cache errors — app works without cache
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!client) return;
  try {
    await client.del(key);
  } catch {
    // ignore
  }
}

export async function testRedisConnection(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  if (!client) return { ok: false, error: "Client not initialized" };
  const start = Date.now();
  try {
    await client.set("__ping__", "1", { ex: 10 });
    const val = await client.get("__ping__");
    if (val !== "1") throw new Error("Ping value mismatch");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
