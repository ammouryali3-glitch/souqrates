---
name: drizzle-orm peer-fork breaks @workspace/db type identity
description: Why adding @upstash/redis (or other drizzle optional peers) to a consumer breaks SQL type identity, and the re-export fix.
---

# drizzle-orm peer-fork breaks @workspace/db type identity

drizzle-orm declares `@upstash/redis` and `@opentelemetry/api` as **optional peer
dependencies**. When a consumer package (e.g. `api-server`) adds one of these as a
direct dependency, pnpm resolves drizzle-orm into a *separate* peer-keyed instance for
that package (`drizzle-orm@x_@upstash+redis@y_...`). That instance's `SQL<unknown>`,
operators, and query builders are a different TS type-brand than the ones `@workspace/db`
was built against → cascading `TS2345 / TS2769` "SQL<unknown> is not assignable" errors
across every db call site, even code you didn't touch.

**Why:** type identity in TS is per-module-instance. Two copies of the same drizzle
version with different peer sets are different types.

**What does NOT fix it:** pnpm `overrides` with `"drizzle-orm>@upstash/redis": "-"`
(does not strip optional peers — the extra instances remain), nor pinning the version.

**How to apply (the fix):** Make every consumer use ONE drizzle instance by re-exporting
the operators from `@workspace/db` (`lib/db/src/index.ts` does
`export { eq, and, sql, desc, ... } from "drizzle-orm"`). Then in api-server import
operators from `"@workspace/db"`, never from `"drizzle-orm"` directly. All operators and
the `db` object then come from the same instance, so types align regardless of how many
peer-keyed copies exist on disk. After editing the db lib run `pnpm run typecheck:libs`
before leaf typechecks.
