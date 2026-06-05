/**
 * CRUD routes for all admin dashboard list entities.
 * All routes require an active admin session.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  appNotificationsTable,
  platformUsersTable,
  depositsTable,
  withdrawalsTable,
  tokenPackagesTable,
  inventoryItemsTable,
  socialTasksTable,
  promoCodesTable,
  broadcastsTable,
  supportTicketsTable,
  shopProductsTable,
  referrersTable,
} from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAdminSession, requirePermission } from "./admin-auth";

const router = Router();
router.use(requireAdminSession);

// ── Notifications ─────────────────────────────────────────────────────────────

router.get("/notifications", requirePermission("content"), async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(appNotificationsTable);
    res.json(
      rows.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        startAt: n.startAt,
        endAt: n.endAt,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "list notifications error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/notifications", requirePermission("content"), async (req: Request, res: Response) => {
  const { id, title, message, type, startAt, endAt } = req.body ?? {};
  if (!id || !title || !message || !type || startAt == null || endAt == null) {
    res.status(400).json({ error: "id, title, message, type, startAt, endAt required" });
    return;
  }
  try {
    const [row] = await db
      .insert(appNotificationsTable)
      .values({ id: String(id), title: String(title), message: String(message), type, startAt: Number(startAt), endAt: Number(endAt) })
      .returning();
    res.status(201).json({ id: row.id, title: row.title, message: row.message, type: row.type, startAt: row.startAt, endAt: row.endAt });
  } catch (err) {
    req.log.error({ err }, "create notification error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/notifications/:id", requirePermission("content"), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await db.delete(appNotificationsTable).where(eq(appNotificationsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "delete notification error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Platform users ────────────────────────────────────────────────────────────

router.get("/users", requirePermission("users"), async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(platformUsersTable);
    res.json(rows.map((u) => u.data));
  } catch (err) {
    req.log.error({ err }, "list users error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users", requirePermission("users"), async (req: Request, res: Response) => {
  const { id, ...rest } = req.body ?? {};
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }
  const userId = String(id);
  const data = { id: userId, ...rest };
  try {
    await db
      .insert(platformUsersTable)
      .values({ id: userId, data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: platformUsersTable.id,
        set: { data, updatedAt: new Date() },
      });
    res.status(201).json({ id: userId });
  } catch (err) {
    req.log.error({ err }, "upsert user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/users/:id", requirePermission("users"), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const [existing] = await db.select().from(platformUsersTable).where(eq(platformUsersTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const merged = { ...(existing.data as object), ...req.body, id };
    await db
      .update(platformUsersTable)
      .set({ data: merged, updatedAt: new Date() })
      .where(eq(platformUsersTable.id, id));
    res.json(merged);
  } catch (err) {
    req.log.error({ err }, "patch user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Deposits ──────────────────────────────────────────────────────────────────

router.get("/deposits", requirePermission("finance"), async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(depositsTable).orderBy(desc(depositsTable.createdAt));
    res.json(rows.map((d) => d.data));
  } catch (err) {
    req.log.error({ err }, "list deposits error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/deposits", requirePermission("finance"), async (req: Request, res: Response) => {
  const { id, status, ...rest } = req.body ?? {};
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }
  const depId = String(id);
  const depStatus: "pending" | "confirmed" = status ?? "pending";
  const data = { id: depId, status: depStatus, ...rest };
  try {
    await db
      .insert(depositsTable)
      .values({ id: depId, status: depStatus, data })
      .onConflictDoUpdate({
        target: depositsTable.id,
        set: { status: depStatus, data },
      });
    res.status(201).json({ id: depId });
  } catch (err) {
    req.log.error({ err }, "upsert deposit error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/deposits/:id", requirePermission("finance"), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { status } = req.body ?? {};
  try {
    const [existing] = await db.select().from(depositsTable).where(eq(depositsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Deposit not found" });
      return;
    }
    const merged = { ...(existing.data as object), ...req.body, id };
    const newStatus: "pending" | "confirmed" = status ?? existing.status;
    await db
      .update(depositsTable)
      .set({ status: newStatus, data: merged })
      .where(eq(depositsTable.id, id));
    res.json(merged);
  } catch (err) {
    req.log.error({ err }, "patch deposit error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Withdrawals ───────────────────────────────────────────────────────────────

router.get("/withdrawals", requirePermission("finance"), async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(withdrawalsTable).orderBy(desc(withdrawalsTable.createdAt));
    res.json(rows.map((w) => w.data));
  } catch (err) {
    req.log.error({ err }, "list withdrawals error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/withdrawals", requirePermission("finance"), async (req: Request, res: Response) => {
  const { id, status, ...rest } = req.body ?? {};
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }
  const wdId = String(id);
  const wdStatus: "pending" | "approved" | "rejected" | "completed" = status ?? "pending";
  const data = { id: wdId, status: wdStatus, ...rest };
  try {
    await db
      .insert(withdrawalsTable)
      .values({ id: wdId, status: wdStatus, data })
      .onConflictDoUpdate({
        target: withdrawalsTable.id,
        set: { status: wdStatus, data },
      });
    res.status(201).json({ id: wdId });
  } catch (err) {
    req.log.error({ err }, "upsert withdrawal error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/withdrawals/:id", requirePermission("finance"), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { status } = req.body ?? {};
  try {
    const [existing] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Withdrawal not found" });
      return;
    }
    const merged = { ...(existing.data as object), ...req.body, id };
    const newStatus: "pending" | "approved" | "rejected" | "completed" = status ?? existing.status;
    await db
      .update(withdrawalsTable)
      .set({ status: newStatus, data: merged })
      .where(eq(withdrawalsTable.id, id));
    res.json(merged);
  } catch (err) {
    req.log.error({ err }, "patch withdrawal error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Generic JSONB entity helpers ──────────────────────────────────────────────

type JsonbTable = {
  id: { name: string };
  data: { name: string };
  updatedAt: { name: string };
};

async function upsertJsonb(
  table: any,
  id: string,
  data: object,
) {
  await db
    .insert(table)
    .values({ id, data, updatedAt: new Date() })
    .onConflictDoUpdate({ target: table.id, set: { data, updatedAt: new Date() } });
}

// ── Token packages ────────────────────────────────────────────────────────────

router.get("/token-packages", requirePermission("content"), async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(tokenPackagesTable);
    res.json(rows.map((p) => p.data));
  } catch (err) {
    req.log.error({ err }, "list token-packages error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/token-packages", requirePermission("content"), async (req: Request, res: Response) => {
  const { id, ...rest } = req.body ?? {};
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }
  const pkgId = String(id);
  const data = { id: pkgId, ...rest };
  try {
    await db
      .insert(tokenPackagesTable)
      .values({ id: pkgId, data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: tokenPackagesTable.id, set: { data, updatedAt: new Date() } });
    res.status(201).json({ id: pkgId });
  } catch (err) {
    req.log.error({ err }, "upsert token-package error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/token-packages/:id", requirePermission("content"), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const [existing] = await db.select().from(tokenPackagesTable).where(eq(tokenPackagesTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Token package not found" });
      return;
    }
    const merged = { ...(existing.data as object), ...req.body, id };
    await db.update(tokenPackagesTable).set({ data: merged, updatedAt: new Date() }).where(eq(tokenPackagesTable.id, id));
    res.json(merged);
  } catch (err) {
    req.log.error({ err }, "patch token-package error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/token-packages/:id", requirePermission("content"), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await db.delete(tokenPackagesTable).where(eq(tokenPackagesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "delete token-package error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Inventory ─────────────────────────────────────────────────────────────────

router.get("/inventory", requirePermission("content"), async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(inventoryItemsTable);
    res.json(rows.map((i) => i.data));
  } catch (err) {
    req.log.error({ err }, "list inventory error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/inventory", requirePermission("content"), async (req: Request, res: Response) => {
  const { id, ...rest } = req.body ?? {};
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }
  const invId = String(id);
  const data = { id: invId, ...rest };
  try {
    await db
      .insert(inventoryItemsTable)
      .values({ id: invId, data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: inventoryItemsTable.id, set: { data, updatedAt: new Date() } });
    res.status(201).json({ id: invId });
  } catch (err) {
    req.log.error({ err }, "upsert inventory error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/inventory/:id", requirePermission("content"), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const [existing] = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Inventory item not found" });
      return;
    }
    const merged = { ...(existing.data as object), ...req.body, id };
    await db.update(inventoryItemsTable).set({ data: merged, updatedAt: new Date() }).where(eq(inventoryItemsTable.id, id));
    res.json(merged);
  } catch (err) {
    req.log.error({ err }, "patch inventory error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/inventory/:id", requirePermission("content"), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await db.delete(inventoryItemsTable).where(eq(inventoryItemsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "delete inventory error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Social tasks ──────────────────────────────────────────────────────────────

router.get("/social-tasks", requirePermission("content"), async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(socialTasksTable);
    res.json(rows.map((t) => t.data));
  } catch (err) {
    req.log.error({ err }, "list social-tasks error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/social-tasks", requirePermission("content"), async (req: Request, res: Response) => {
  const { id, ...rest } = req.body ?? {};
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }
  const taskId = String(id);
  const data = { id: taskId, ...rest };
  try {
    await db
      .insert(socialTasksTable)
      .values({ id: taskId, data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: socialTasksTable.id, set: { data, updatedAt: new Date() } });
    res.status(201).json({ id: taskId });
  } catch (err) {
    req.log.error({ err }, "upsert social-task error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/social-tasks/:id", requirePermission("content"), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const [existing] = await db.select().from(socialTasksTable).where(eq(socialTasksTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Social task not found" });
      return;
    }
    const merged = { ...(existing.data as object), ...req.body, id };
    await db.update(socialTasksTable).set({ data: merged, updatedAt: new Date() }).where(eq(socialTasksTable.id, id));
    res.json(merged);
  } catch (err) {
    req.log.error({ err }, "patch social-task error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/social-tasks/:id", requirePermission("content"), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await db.delete(socialTasksTable).where(eq(socialTasksTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "delete social-task error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Promo codes ───────────────────────────────────────────────────────────────

router.get("/promo-codes", requirePermission("content"), async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(promoCodesTable);
    res.json(rows.map((p) => p.data));
  } catch (err) {
    req.log.error({ err }, "list promo-codes error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/promo-codes", requirePermission("content"), async (req: Request, res: Response) => {
  const { id, ...rest } = req.body ?? {};
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }
  const pcId = String(id);
  const data = { id: pcId, ...rest };
  try {
    await db
      .insert(promoCodesTable)
      .values({ id: pcId, data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: promoCodesTable.id, set: { data, updatedAt: new Date() } });
    res.status(201).json({ id: pcId });
  } catch (err) {
    req.log.error({ err }, "upsert promo-code error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/promo-codes/:id", requirePermission("content"), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const [existing] = await db.select().from(promoCodesTable).where(eq(promoCodesTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Promo code not found" });
      return;
    }
    const merged = { ...(existing.data as object), ...req.body, id };
    await db.update(promoCodesTable).set({ data: merged, updatedAt: new Date() }).where(eq(promoCodesTable.id, id));
    res.json(merged);
  } catch (err) {
    req.log.error({ err }, "patch promo-code error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/promo-codes/:id", requirePermission("content"), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await db.delete(promoCodesTable).where(eq(promoCodesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "delete promo-code error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Broadcasts ────────────────────────────────────────────────────────────────

router.get("/broadcasts", requirePermission("content"), async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(broadcastsTable).orderBy(desc(broadcastsTable.updatedAt));
    res.json(rows.map((b) => b.data));
  } catch (err) {
    req.log.error({ err }, "list broadcasts error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/broadcasts", requirePermission("content"), async (req: Request, res: Response) => {
  const { id, status, ...rest } = req.body ?? {};
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }
  const bcId = String(id);
  const bcStatus: "scheduled" | "sent" | "draft" = status ?? "draft";
  const data = { id: bcId, status: bcStatus, ...rest };
  try {
    await db
      .insert(broadcastsTable)
      .values({ id: bcId, status: bcStatus, data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: broadcastsTable.id, set: { status: bcStatus, data, updatedAt: new Date() } });
    res.status(201).json({ id: bcId });
  } catch (err) {
    req.log.error({ err }, "upsert broadcast error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/broadcasts/:id", requirePermission("content"), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { status } = req.body ?? {};
  try {
    const [existing] = await db.select().from(broadcastsTable).where(eq(broadcastsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Broadcast not found" });
      return;
    }
    const merged = { ...(existing.data as object), ...req.body, id };
    const newStatus: "scheduled" | "sent" | "draft" = status ?? existing.status;
    await db.update(broadcastsTable).set({ status: newStatus, data: merged, updatedAt: new Date() }).where(eq(broadcastsTable.id, id));
    res.json(merged);
  } catch (err) {
    req.log.error({ err }, "patch broadcast error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/broadcasts/:id", requirePermission("content"), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await db.delete(broadcastsTable).where(eq(broadcastsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "delete broadcast error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Support tickets ───────────────────────────────────────────────────────────

router.get("/support-tickets", requirePermission("users"), async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(supportTicketsTable).orderBy(desc(supportTicketsTable.updatedAt));
    res.json(rows.map((t) => t.data));
  } catch (err) {
    req.log.error({ err }, "list tickets error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/support-tickets", requirePermission("users"), async (req: Request, res: Response) => {
  const { id, status, ...rest } = req.body ?? {};
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }
  const tkId = String(id);
  const tkStatus: "open" | "answered" | "closed" = status ?? "open";
  const data = { id: tkId, status: tkStatus, ...rest };
  try {
    await db
      .insert(supportTicketsTable)
      .values({ id: tkId, status: tkStatus, data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: supportTicketsTable.id, set: { status: tkStatus, data, updatedAt: new Date() } });
    res.status(201).json({ id: tkId });
  } catch (err) {
    req.log.error({ err }, "upsert ticket error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/support-tickets/:id", requirePermission("users"), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { status } = req.body ?? {};
  try {
    const [existing] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const merged = { ...(existing.data as object), ...req.body, id };
    const newStatus: "open" | "answered" | "closed" = status ?? existing.status;
    await db.update(supportTicketsTable).set({ status: newStatus, data: merged, updatedAt: new Date() }).where(eq(supportTicketsTable.id, id));
    res.json(merged);
  } catch (err) {
    req.log.error({ err }, "patch ticket error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Shop products ─────────────────────────────────────────────────────────────

router.get("/products", requirePermission("content"), async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(shopProductsTable);
    res.json(rows.map((p) => p.data));
  } catch (err) {
    req.log.error({ err }, "list products error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/products", requirePermission("content"), async (req: Request, res: Response) => {
  const { id, ...rest } = req.body ?? {};
  if (id == null) {
    res.status(400).json({ error: "id required" });
    return;
  }
  const numId = Number(id);
  const data = { id: numId, ...rest };
  try {
    await db
      .insert(shopProductsTable)
      .values({ id: numId, data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: shopProductsTable.id, set: { data, updatedAt: new Date() } });
    res.status(201).json({ id: numId });
  } catch (err) {
    req.log.error({ err }, "upsert product error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/products/:id", requirePermission("content"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  try {
    const [existing] = await db.select().from(shopProductsTable).where(eq(shopProductsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const merged = { ...(existing.data as object), ...req.body, id };
    await db.update(shopProductsTable).set({ data: merged, updatedAt: new Date() }).where(eq(shopProductsTable.id, id));
    res.json(merged);
  } catch (err) {
    req.log.error({ err }, "patch product error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/products/:id", requirePermission("content"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  try {
    await db.delete(shopProductsTable).where(eq(shopProductsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "delete product error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Referrers ─────────────────────────────────────────────────────────────────

router.get("/referrers", requirePermission("affiliate"), async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(referrersTable);
    res.json(rows.map((r) => r.data));
  } catch (err) {
    req.log.error({ err }, "list referrers error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/referrers", requirePermission("affiliate"), async (req: Request, res: Response) => {
  const { id, ...rest } = req.body ?? {};
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }
  const refId = String(id);
  const data = { id: refId, ...rest };
  try {
    await db
      .insert(referrersTable)
      .values({ id: refId, data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: referrersTable.id, set: { data, updatedAt: new Date() } });
    res.status(201).json({ id: refId });
  } catch (err) {
    req.log.error({ err }, "upsert referrer error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
