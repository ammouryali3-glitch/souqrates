---
name: Sentry Node + esbuild runtime crash
description: Why @sentry/node v8+ crashes at runtime under esbuild bundling, and why v7 is used here.
---

# Sentry Node + esbuild runtime crash

`@sentry/node` v8+ (v10 was tried here) pulls in OpenTelemetry and dynamically requires
`@opentelemetry/instrumentation`, `@opentelemetry/core`, `@opentelemetry/sdk-trace-base`,
`@opentelemetry/semantic-conventions`, and `@sentry/opentelemetry` at runtime. esbuild
bundles the app fine, but these dynamic requires are externalized and missing in the
bundled output → `ERR_MODULE_NOT_FOUND: Cannot find package '@opentelemetry/instrumentation'`
at server start.

**Why:** OTel deps are loaded via runtime dynamic resolution, not static imports esbuild
can trace, so bundling silently drops them.

**How to apply:** The api-server uses `@sentry/node@^7` (no OTel dependency) — `init` +
`captureException` only, called from the global error handler. Do NOT upgrade to v8+
without either installing the full OTel stack as runtime deps AND adding them to
`build.mjs` externals, or switching to Sentry's ESM/loader setup. v7 keeps the bundle
self-contained.
