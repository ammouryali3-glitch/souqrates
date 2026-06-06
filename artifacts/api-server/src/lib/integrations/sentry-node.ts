import * as Sentry from "@sentry/node";
import { logger } from "../logger";

let initialized = false;

export interface SentryConfig {
  backendDsn: string;
}

export function initSentry(config: SentryConfig): void {
  if (!config.backendDsn) return;
  try {
    Sentry.init({
      dsn: config.backendDsn,
      tracesSampleRate: 0.1,
      environment: process.env["NODE_ENV"] ?? "production",
    });
    initialized = true;
    logger.info("Sentry Node initialized");
  } catch (err) {
    logger.error({ err }, "Failed to initialize Sentry");
  }
}

export function destroySentry(): void {
  initialized = false;
}

export function isSentryReady(): boolean {
  return initialized;
}

export function captureException(err: unknown): void {
  if (initialized) {
    Sentry.captureException(err);
  }
}

export function getSentryErrorHandler() {
  return Sentry.expressErrorHandler();
}

export async function testSentryConnection(dsn: string): Promise<{ ok: boolean; error?: string }> {
  if (!dsn) return { ok: false, error: "No DSN provided" };
  try {
    const url = new URL(dsn);
    if (!url.hostname.includes("sentry.io") && !url.hostname.includes("ingest.")) {
      return { ok: false, error: "DSN does not appear to be a valid Sentry DSN" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Invalid DSN format" };
  }
}
