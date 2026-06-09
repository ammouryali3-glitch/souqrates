/**
 * Shared user authentication helpers.
 *
 * Extracted here so both the route handlers (user.ts) and the rate-limiter
 * middleware (app.ts) can resolve the authenticated user identity without
 * duplicating JWT logic or creating a circular import.
 *
 * Env vars (in priority order):
 *   USER_JWT_SECRET  — dedicated user-token secret (preferred)
 *   JWT_SECRET       — legacy fallback shared secret
 */
import jwt from "jsonwebtoken";

const USER_JWT_SECRET = process.env.USER_JWT_SECRET ?? process.env.JWT_SECRET;
if (!USER_JWT_SECRET) throw new Error("USER_JWT_SECRET (or JWT_SECRET) env var must be set");

export const USER_COOKIE = "skz_user_token";

export interface UserTokenPayload {
  tgId: string;
  iat?: number;
  exp?: number;
}

export function signUserToken(tgId: string): string {
  return jwt.sign({ tgId }, USER_JWT_SECRET!, { expiresIn: "30d" });
}

export function verifyUserToken(token: string): UserTokenPayload | null {
  try {
    return jwt.verify(token, USER_JWT_SECRET!) as UserTokenPayload;
  } catch {
    return null;
  }
}
