import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { adminAccountsTable } from "@workspace/db";
import { eq, and, ne } from "@workspace/db";

const router = Router();

// Dedicated admin secret; falls back to shared JWT_SECRET for zero-downtime migration.
// Set ADMIN_JWT_SECRET in production to fully isolate admin tokens from user tokens.
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET ?? process.env.JWT_SECRET;
if (!ADMIN_JWT_SECRET) throw new Error("ADMIN_JWT_SECRET (or JWT_SECRET) env var must be set");

const COOKIE_NAME = "skz_admin_token";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 8 * 60 * 60 * 1000, // 8 hours
  path: "/",
};

const BCRYPT_ROUNDS = 12;

export interface AdminTokenPayload {
  sub: string;
  handle: string;
  role: string;
  iat?: number;
  exp?: number;
}

function signToken(payload: Omit<AdminTokenPayload, "iat" | "exp">): string {
  return jwt.sign(payload, ADMIN_JWT_SECRET!, { expiresIn: "8h" });
}

function verifyToken(token: string): AdminTokenPayload | null {
  try {
    return jwt.verify(token, ADMIN_JWT_SECRET!) as AdminTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Log a structured admin audit event. Call from any admin route that mutates
 * state (config changes, user edits, deposit/withdrawal approvals, etc.).
 *
 * Output goes to the structured pino log so it can be queried/alerted on.
 * Format: { adminAudit: { adminId, adminHandle, adminRole, action, ip, ...details } }
 */
export function logAdminAction(
  req: Request,
  action: string,
  details: Record<string, unknown> = {},
): void {
  const account = (req as any).adminAccount as (typeof adminAccountsTable.$inferSelect) | undefined;
  req.log.info(
    {
      adminAudit: {
        adminId: account?.id ?? "unknown",
        adminHandle: account?.handle ?? "unknown",
        adminRole: account?.role ?? "unknown",
        action,
        ip: req.ip,
        ...details,
      },
    },
    "admin action",
  );
}

// ── Middleware ─────────────────────────────────────────────────────────────────

// Verify JWT signature + load current account state from DB.
// This ensures deactivated accounts and role-changes take effect immediately.
export async function requireAdminSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.status(401).json({ error: "Session expired" });
    return;
  }

  try {
    const [account] = await db
      .select()
      .from(adminAccountsTable)
      .where(eq(adminAccountsTable.id, payload.sub))
      .limit(1);

    if (!account || !account.active) {
      res.clearCookie(COOKIE_NAME, { path: "/" });
      res.status(401).json({ error: "Account inactive or not found" });
      return;
    }

    // Attach live DB state — never stale JWT claims
    (req as any).adminAccount = account;
    next();
  } catch (err) {
    req.log.error({ err }, "session middleware DB error");
    res.status(500).json({ error: "Internal server error" });
  }
}

// Owner check against live DB role (not JWT claim)
async function requireOwner(req: Request, res: Response, next: NextFunction) {
  const account = (req as any).adminAccount as typeof adminAccountsTable.$inferSelect;
  if (account?.role !== "owner") {
    res.status(403).json({ error: "Owner access required" });
    return;
  }
  next();
}

/**
 * Permission check middleware. Owners always pass.
 * Other accounts must have the section name in their permissions[] array.
 *
 * Usage: router.patch("/deposits/:id", requireAdminSession, requirePermission("finance"), handler)
 */
export function requirePermission(section: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const account = (req as any).adminAccount as typeof adminAccountsTable.$inferSelect;
    if (account?.role === "owner") {
      next();
      return;
    }
    if (Array.isArray(account?.permissions) && account.permissions.includes(section)) {
      next();
      return;
    }
    res.status(403).json({ error: `Permission denied: requires '${section}'` });
  };
}

// Helper: serialize account for client (never expose passwordHash)
function serializeAccount(acct: typeof adminAccountsTable.$inferSelect) {
  return {
    id: acct.id,
    name: acct.name,
    handle: acct.handle,
    role: acct.role,
    permissions: acct.permissions,
    active: acct.active,
    mustChangePassword: acct.mustChangePassword,
  };
}

// ── Auth endpoints ─────────────────────────────────────────────────────────────

// POST /api/admin/login
router.post("/login", async (req: Request, res: Response) => {
  const { handle, password } = req.body ?? {};
  if (typeof handle !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "handle and password required" });
    return;
  }

  const normalised = handle.trim().toLowerCase().replace(/^@+/, "");

  let _step = "db-select";
  try {
    const [account] = await db
      .select()
      .from(adminAccountsTable)
      .where(eq(adminAccountsTable.handle, `@${normalised}`))
      .limit(1);

    if (!account || !account.active) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    _step = "bcrypt-compare";
    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    _step = "jwt-sign";
    const token = signToken({ sub: account.id, handle: account.handle, role: account.role });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    req.log.info({ adminAudit: { adminId: account.id, adminHandle: account.handle, adminRole: account.role, action: "login", ip: req.ip } }, "admin action");
    res.json(serializeAccount(account));
  } catch (err) {
    req.log.error({ err, _step }, "admin login error");
    const _cause = err instanceof Error && err.cause ? String((err.cause as Error).message ?? err.cause) : undefined;
    const _code = (err as NodeJS.ErrnoException).code;
    res.status(500).json({ error: "Internal server error", _step, _detail: err instanceof Error ? err.message : String(err), _cause, _code });
  }
});

// GET /api/admin/session
router.get("/session", requireAdminSession, (req: Request, res: Response) => {
  // requireAdminSession already loaded and validated the DB account
  const account = (req as any).adminAccount as typeof adminAccountsTable.$inferSelect;
  res.json(serializeAccount(account));
});

// POST /api/admin/logout
router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

// POST /api/admin/change-password
router.post("/change-password", requireAdminSession, async (req: Request, res: Response) => {
  const account = (req as any).adminAccount as typeof adminAccountsTable.$inferSelect;
  const { currentPassword, newPassword } = req.body ?? {};

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    res.status(400).json({ error: "currentPassword and newPassword required" });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }

  try {
    const valid = await bcrypt.compare(currentPassword, account.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const [updated] = await db
      .update(adminAccountsTable)
      .set({ passwordHash: newHash, mustChangePassword: false, updatedAt: new Date() })
      .where(eq(adminAccountsTable.id, account.id))
      .returning();

    res.json(serializeAccount(updated));
  } catch (err) {
    req.log.error({ err }, "change-password error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Account management (owner only) ───────────────────────────────────────────

// GET /api/admin/accounts
router.get("/accounts", requireAdminSession, requireOwner, async (req: Request, res: Response) => {
  try {
    const accounts = await db.select().from(adminAccountsTable).orderBy(adminAccountsTable.createdAt);
    res.json(accounts.map(serializeAccount));
  } catch (err) {
    req.log.error({ err }, "list accounts error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/accounts
router.post("/accounts", requireAdminSession, requireOwner, async (req: Request, res: Response) => {
  const { name, handle, role, password, permissions, active } = req.body ?? {};

  if (!name?.trim() || !handle?.trim() || !role || !password) {
    res.status(400).json({ error: "name, handle, role, and password required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const validRoles = ["owner", "support", "accountant", "moderator"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  const normHandle = handle.trim().startsWith("@") ? handle.trim() : `@${handle.trim()}`;

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const [account] = await db
      .insert(adminAccountsTable)
      .values({
        id: randomUUID(),
        name: name.trim(),
        handle: normHandle,
        role,
        passwordHash,
        permissions: Array.isArray(permissions) ? permissions : [],
        active: active !== false,
        mustChangePassword: true,
      })
      .returning();

    res.status(201).json(serializeAccount(account));
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Handle already exists" });
      return;
    }
    req.log.error({ err }, "create account error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/admin/accounts/:id
router.patch("/accounts/:id", requireAdminSession, requireOwner, async (req: Request, res: Response) => {
  const caller = (req as any).adminAccount as typeof adminAccountsTable.$inferSelect;
  const id = String(req.params.id);
  const { name, handle, role, password, permissions, active } = req.body ?? {};

  // Prevent owner from deactivating their own account
  if (id === caller.id && active === false) {
    res.status(400).json({ error: "Cannot deactivate your own account" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(adminAccountsTable)
      .where(eq(adminAccountsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    // Prevent removing owner role if they're the only active owner
    if (existing.role === "owner" && role && role !== "owner") {
      const [otherOwner] = await db
        .select()
        .from(adminAccountsTable)
        .where(and(eq(adminAccountsTable.role, "owner"), eq(adminAccountsTable.active, true), ne(adminAccountsTable.id, id)))
        .limit(1);
      if (!otherOwner) {
        res.status(400).json({ error: "Cannot demote the only active owner" });
        return;
      }
    }

    const updates: Partial<typeof adminAccountsTable.$inferInsert> = { updatedAt: new Date() };
    if (name?.trim()) updates.name = name.trim();
    if (handle?.trim()) {
      updates.handle = handle.trim().startsWith("@") ? handle.trim() : `@${handle.trim()}`;
    }
    if (role) updates.role = role;
    if (Array.isArray(permissions)) updates.permissions = permissions;
    if (typeof active === "boolean") updates.active = active;
    if (password) {
      if (password.length < 8) {
        res.status(400).json({ error: "Password must be at least 8 characters" });
        return;
      }
      updates.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      updates.mustChangePassword = true;
    }

    const [updated] = await db
      .update(adminAccountsTable)
      .set(updates)
      .where(eq(adminAccountsTable.id, id))
      .returning();

    res.json(serializeAccount(updated));
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Handle already exists" });
      return;
    }
    req.log.error({ err }, "update account error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/accounts/:id
router.delete("/accounts/:id", requireAdminSession, requireOwner, async (req: Request, res: Response) => {
  const caller = (req as any).adminAccount as typeof adminAccountsTable.$inferSelect;
  const id = String(req.params.id);

  if (id === caller.id) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(adminAccountsTable)
      .where(eq(adminAccountsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    // Protect the last active owner
    if (existing.role === "owner") {
      const [other] = await db
        .select()
        .from(adminAccountsTable)
        .where(and(eq(adminAccountsTable.role, "owner"), eq(adminAccountsTable.active, true), ne(adminAccountsTable.id, id)))
        .limit(1);
      if (!other) {
        res.status(400).json({ error: "Cannot delete the only active owner" });
        return;
      }
    }

    await db.delete(adminAccountsTable).where(eq(adminAccountsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "delete account error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
