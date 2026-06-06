import { Router } from "express";
import { requireAdminSession, requirePermission } from "./admin-auth";
import {
  getMaskedConfig,
  getCurrentIntegrationConfig,
  updateIntegrations,
  mergeWithSecrets,
  type IntegrationConfig,
} from "../lib/integrations";
import { testRedisConnection, getRedisClient } from "../lib/integrations/redis";
import { testR2Connection, getR2Client } from "../lib/integrations/r2";
import { testSentryConnection, isSentryReady } from "../lib/integrations/sentry-node";
import { uploadToR2 } from "../lib/integrations/r2";

const router = Router();

// ── GET /admin/integrations ────────────────────────────────────────────────────
router.get("/integrations", requireAdminSession, requirePermission("system"), (req, res) => {
  const masked = getMaskedConfig();
  const status = {
    redis: { connected: getRedisClient() !== null },
    r2: { connected: getR2Client() !== null },
    sentry: { connected: isSentryReady() },
    cloudflare: { connected: false }, // Cloudflare is external — we only store config
  };
  res.json({ config: masked, status });
});

// ── PUT /admin/integrations ────────────────────────────────────────────────────
router.put("/integrations", requireAdminSession, requirePermission("system"), async (req, res) => {
  const body = req.body as IntegrationConfig;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const merged = mergeWithSecrets(body);
  await updateIntegrations(merged);
  const masked = getMaskedConfig();
  const status = {
    redis: { connected: getRedisClient() !== null },
    r2: { connected: getR2Client() !== null },
    sentry: { connected: isSentryReady() },
    cloudflare: { connected: false },
  };
  res.json({ ok: true, config: masked, status });
});

// ── POST /admin/integrations/:name/test ───────────────────────────────────────
router.post("/integrations/:name/test", requireAdminSession, requirePermission("system"), async (req, res) => {
  const { name } = req.params;

  switch (name) {
    case "redis": {
      const result = await testRedisConnection();
      res.json(result);
      return;
    }
    case "r2": {
      const result = await testR2Connection();
      res.json(result);
      return;
    }
    case "sentry": {
      const cfg = getCurrentIntegrationConfig();
      const result = await testSentryConnection(cfg.sentry.backendDsn);
      res.json(result);
      return;
    }
    case "cloudflare": {
      const cfg = getCurrentIntegrationConfig();
      if (!cfg.cloudflare.workerUrl) {
        res.json({ ok: false, error: "No Worker URL configured" });
        return;
      }
      try {
        const r = await fetch(`${cfg.cloudflare.workerUrl}/health`, { signal: AbortSignal.timeout(5000) });
        res.json({ ok: r.ok, statusCode: r.status });
      } catch (err) {
        res.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }
    default:
      res.status(404).json({ error: "Unknown integration" });
  }
});

// ── POST /admin/integrations/r2/upload ────────────────────────────────────────
// Upload a file (base64 body) to R2 and get back the public URL
router.post("/integrations/r2/upload", requireAdminSession, requirePermission("system"), async (req, res) => {
  const { key, base64, contentType } = req.body as {
    key?: string;
    base64?: string;
    contentType?: string;
  };

  if (!key || !base64 || !contentType) {
    res.status(400).json({ error: "key, base64, and contentType are required" });
    return;
  }

  if (!getR2Client()) {
    res.status(503).json({ error: "R2 not configured or not enabled" });
    return;
  }

  const buffer = Buffer.from(base64, "base64");
  const url = await uploadToR2(key, buffer, contentType);
  res.json({ ok: true, url });
});

export default router;
