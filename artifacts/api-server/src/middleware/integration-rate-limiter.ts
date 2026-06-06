import type { Request, Response, NextFunction } from "express";
import { getRedisClient } from "../lib/integrations/redis";
import { getCurrentIntegrationConfig } from "../lib/integrations";

/**
 * Redis-based sliding rate limiter.
 * Falls back gracefully if Redis is not configured.
 */
export async function redisRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    next();
    return;
  }

  const config = getCurrentIntegrationConfig();
  const limit = config.redis.rateLimitPerMin ?? 120;
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.ip ?? "unknown";
  const key = `rl:${ip}:${Math.floor(Date.now() / 60000)}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);

    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - count)));

    if (count > limit) {
      res.status(429).json({ error: "Too many requests — please slow down" });
      return;
    }
  } catch {
    // If Redis fails, let the request through
  }

  next();
}
