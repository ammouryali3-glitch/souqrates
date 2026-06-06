import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";

// Re-export drizzle-orm query operators from this package so that all consumers
// (api-server, etc.) use the SAME drizzle-orm instance. drizzle-orm declares
// @upstash/redis and @opentelemetry/api as optional peers; when a consumer also
// depends on @upstash/redis, pnpm forks drizzle-orm into a separate peer-resolved
// instance, breaking SQL<unknown> type identity with this package's query builders.
// Importing operators from here guarantees a single instance.
export {
  eq,
  ne,
  and,
  or,
  not,
  sql,
  desc,
  asc,
  gt,
  gte,
  lt,
  lte,
  inArray,
  notInArray,
  isNull,
  isNotNull,
  like,
  ilike,
  count,
  sum,
  avg,
  min,
  max,
  between,
  exists,
} from "drizzle-orm";
