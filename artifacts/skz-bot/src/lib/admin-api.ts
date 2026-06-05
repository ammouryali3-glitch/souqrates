/**
 * API client for admin endpoints.
 * Uses the same fetch pattern as admin-auth.ts (credentials: "include").
 * All mutations are fire-and-forget unless the caller awaits them.
 *
 * Endpoint security model:
 *  - GET /api/admin/runtime-config  — public, mini-app safe (settings, game overrides, notifications)
 *  - GET /api/admin/state           — auth-required, full admin dataset (dashboard only)
 *  - All mutating endpoints         — auth-required (requireAdminSession middleware)
 */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
}

function warnOnFailure(label: string, res: Response): void {
  if (!res.ok) {
    console.warn(`[admin-api] ${label} failed — HTTP ${res.status}`);
  }
}

// ── Public runtime config (mini-app safe) ─────────────────────────────────────

export interface ApiRuntimeConfig {
  /** Allowlisted subset of admin_config: settings, game_overrides, ticket_overrides, referral_config, daily_checkin */
  config: Record<string, unknown>;
  notifications: unknown[];
}

/**
 * Fetch public runtime config for the mini-app.
 * Returns ONLY mini-app-safe fields — no PII, no sensitive admin data.
 */
export async function fetchRuntimeConfig(): Promise<ApiRuntimeConfig | null> {
  try {
    const res = await apiFetch("/api/admin/runtime-config");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── Full admin state (auth-required, dashboard only) ──────────────────────────

export interface ApiAdminState {
  config: Record<string, unknown>;
  notifications: unknown[];
  users: unknown[];
  deposits: unknown[];
  withdrawals: unknown[];
  tokenPackages: unknown[];
  inventory: unknown[];
  socialTasks: unknown[];
  promoCodes: unknown[];
  broadcasts: unknown[];
  tickets: unknown[];
  products: unknown[];
  referrers: unknown[];
}

/**
 * Fetch full admin state for the dashboard. Requires an active admin session (JWT cookie).
 * Returns null if unauthenticated (401) or the API is unavailable.
 */
export async function fetchAdminState(): Promise<ApiAdminState | null> {
  try {
    const res = await apiFetch("/api/admin/state");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── Config (settings, game_overrides, etc.) ────────────────────────────────────

export async function putAdminConfig(key: string, value: unknown): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/config/${key}`, {
      method: "PUT",
      body: JSON.stringify(value),
    });
    warnOnFailure(`putAdminConfig(${key})`, res);
  } catch (err) {
    console.warn("[admin-api] putAdminConfig network error:", err);
  }
}

// ── Notifications ──────────────────────────────────────────────────────────────

export async function apiCreateNotification(n: {
  id: string; title: string; message: string; type: string; startAt: number; endAt: number;
}): Promise<void> {
  try {
    const res = await apiFetch("/api/admin/notifications", { method: "POST", body: JSON.stringify(n) });
    warnOnFailure("apiCreateNotification", res);
  } catch (err) {
    console.warn("[admin-api] apiCreateNotification network error:", err);
  }
}

export async function apiDeleteNotification(id: string): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/notifications/${id}`, { method: "DELETE" });
    warnOnFailure("apiDeleteNotification", res);
  } catch (err) {
    console.warn("[admin-api] apiDeleteNotification network error:", err);
  }
}

// ── Platform users ─────────────────────────────────────────────────────────────

export async function apiUpsertUser(user: object): Promise<void> {
  try {
    const res = await apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify(user) });
    warnOnFailure("apiUpsertUser", res);
  } catch (err) {
    console.warn("[admin-api] apiUpsertUser network error:", err);
  }
}

export async function apiPatchUser(id: string, patch: object): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    warnOnFailure("apiPatchUser", res);
  } catch (err) {
    console.warn("[admin-api] apiPatchUser network error:", err);
  }
}

// ── Deposits ───────────────────────────────────────────────────────────────────

export async function apiUpsertDeposit(deposit: object): Promise<void> {
  try {
    const res = await apiFetch("/api/admin/deposits", { method: "POST", body: JSON.stringify(deposit) });
    warnOnFailure("apiUpsertDeposit", res);
  } catch (err) {
    console.warn("[admin-api] apiUpsertDeposit network error:", err);
  }
}

export async function apiPatchDeposit(id: string, patch: object): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/deposits/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    warnOnFailure("apiPatchDeposit", res);
  } catch (err) {
    console.warn("[admin-api] apiPatchDeposit network error:", err);
  }
}

// ── Withdrawals ────────────────────────────────────────────────────────────────

export async function apiUpsertWithdrawal(withdrawal: object): Promise<void> {
  try {
    const res = await apiFetch("/api/admin/withdrawals", { method: "POST", body: JSON.stringify(withdrawal) });
    warnOnFailure("apiUpsertWithdrawal", res);
  } catch (err) {
    console.warn("[admin-api] apiUpsertWithdrawal network error:", err);
  }
}

export async function apiPatchWithdrawal(id: string, patch: object): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/withdrawals/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    warnOnFailure("apiPatchWithdrawal", res);
  } catch (err) {
    console.warn("[admin-api] apiPatchWithdrawal network error:", err);
  }
}

// ── Token packages ─────────────────────────────────────────────────────────────

export async function apiUpsertTokenPackage(pkg: object): Promise<void> {
  try {
    const res = await apiFetch("/api/admin/token-packages", { method: "POST", body: JSON.stringify(pkg) });
    warnOnFailure("apiUpsertTokenPackage", res);
  } catch (err) {
    console.warn("[admin-api] apiUpsertTokenPackage network error:", err);
  }
}

export async function apiPatchTokenPackage(id: string, patch: object): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/token-packages/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    warnOnFailure("apiPatchTokenPackage", res);
  } catch (err) {
    console.warn("[admin-api] apiPatchTokenPackage network error:", err);
  }
}

export async function apiDeleteTokenPackage(id: string): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/token-packages/${id}`, { method: "DELETE" });
    warnOnFailure("apiDeleteTokenPackage", res);
  } catch (err) {
    console.warn("[admin-api] apiDeleteTokenPackage network error:", err);
  }
}

// ── Inventory ──────────────────────────────────────────────────────────────────

export async function apiUpsertInventory(item: object): Promise<void> {
  try {
    const res = await apiFetch("/api/admin/inventory", { method: "POST", body: JSON.stringify(item) });
    warnOnFailure("apiUpsertInventory", res);
  } catch (err) {
    console.warn("[admin-api] apiUpsertInventory network error:", err);
  }
}

export async function apiPatchInventory(id: string, patch: object): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/inventory/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    warnOnFailure("apiPatchInventory", res);
  } catch (err) {
    console.warn("[admin-api] apiPatchInventory network error:", err);
  }
}

export async function apiDeleteInventory(id: string): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/inventory/${id}`, { method: "DELETE" });
    warnOnFailure("apiDeleteInventory", res);
  } catch (err) {
    console.warn("[admin-api] apiDeleteInventory network error:", err);
  }
}

// ── Social tasks ───────────────────────────────────────────────────────────────

export async function apiUpsertSocialTask(task: object): Promise<void> {
  try {
    const res = await apiFetch("/api/admin/social-tasks", { method: "POST", body: JSON.stringify(task) });
    warnOnFailure("apiUpsertSocialTask", res);
  } catch (err) {
    console.warn("[admin-api] apiUpsertSocialTask network error:", err);
  }
}

export async function apiPatchSocialTask(id: string, patch: object): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/social-tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    warnOnFailure("apiPatchSocialTask", res);
  } catch (err) {
    console.warn("[admin-api] apiPatchSocialTask network error:", err);
  }
}

export async function apiDeleteSocialTask(id: string): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/social-tasks/${id}`, { method: "DELETE" });
    warnOnFailure("apiDeleteSocialTask", res);
  } catch (err) {
    console.warn("[admin-api] apiDeleteSocialTask network error:", err);
  }
}

// ── Promo codes ────────────────────────────────────────────────────────────────

export async function apiUpsertPromoCode(code: object): Promise<void> {
  try {
    const res = await apiFetch("/api/admin/promo-codes", { method: "POST", body: JSON.stringify(code) });
    warnOnFailure("apiUpsertPromoCode", res);
  } catch (err) {
    console.warn("[admin-api] apiUpsertPromoCode network error:", err);
  }
}

export async function apiPatchPromoCode(id: string, patch: object): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/promo-codes/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    warnOnFailure("apiPatchPromoCode", res);
  } catch (err) {
    console.warn("[admin-api] apiPatchPromoCode network error:", err);
  }
}

export async function apiDeletePromoCode(id: string): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/promo-codes/${id}`, { method: "DELETE" });
    warnOnFailure("apiDeletePromoCode", res);
  } catch (err) {
    console.warn("[admin-api] apiDeletePromoCode network error:", err);
  }
}

// ── Broadcasts ─────────────────────────────────────────────────────────────────

export async function apiUpsertBroadcast(broadcast: object): Promise<void> {
  try {
    const res = await apiFetch("/api/admin/broadcasts", { method: "POST", body: JSON.stringify(broadcast) });
    warnOnFailure("apiUpsertBroadcast", res);
  } catch (err) {
    console.warn("[admin-api] apiUpsertBroadcast network error:", err);
  }
}

export async function apiPatchBroadcast(id: string, patch: object): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/broadcasts/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    warnOnFailure("apiPatchBroadcast", res);
  } catch (err) {
    console.warn("[admin-api] apiPatchBroadcast network error:", err);
  }
}

export async function apiDeleteBroadcast(id: string): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/broadcasts/${id}`, { method: "DELETE" });
    warnOnFailure("apiDeleteBroadcast", res);
  } catch (err) {
    console.warn("[admin-api] apiDeleteBroadcast network error:", err);
  }
}

// ── Support tickets ────────────────────────────────────────────────────────────

export async function apiUpsertTicket(ticket: object): Promise<void> {
  try {
    const res = await apiFetch("/api/admin/support-tickets", { method: "POST", body: JSON.stringify(ticket) });
    warnOnFailure("apiUpsertTicket", res);
  } catch (err) {
    console.warn("[admin-api] apiUpsertTicket network error:", err);
  }
}

export async function apiPatchTicket(id: string, patch: object): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/support-tickets/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    warnOnFailure("apiPatchTicket", res);
  } catch (err) {
    console.warn("[admin-api] apiPatchTicket network error:", err);
  }
}

// ── Shop products ──────────────────────────────────────────────────────────────

export async function apiUpsertProduct(product: object): Promise<void> {
  try {
    const res = await apiFetch("/api/admin/products", { method: "POST", body: JSON.stringify(product) });
    warnOnFailure("apiUpsertProduct", res);
  } catch (err) {
    console.warn("[admin-api] apiUpsertProduct network error:", err);
  }
}

export async function apiPatchProduct(id: number, patch: object): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    warnOnFailure("apiPatchProduct", res);
  } catch (err) {
    console.warn("[admin-api] apiPatchProduct network error:", err);
  }
}

export async function apiDeleteProduct(id: number): Promise<void> {
  try {
    const res = await apiFetch(`/api/admin/products/${id}`, { method: "DELETE" });
    warnOnFailure("apiDeleteProduct", res);
  } catch (err) {
    console.warn("[admin-api] apiDeleteProduct network error:", err);
  }
}

// ── Referrers ──────────────────────────────────────────────────────────────────

export async function apiUpsertReferrer(referrer: object): Promise<void> {
  try {
    const res = await apiFetch("/api/admin/referrers", { method: "POST", body: JSON.stringify(referrer) });
    warnOnFailure("apiUpsertReferrer", res);
  } catch (err) {
    console.warn("[admin-api] apiUpsertReferrer network error:", err);
  }
}
