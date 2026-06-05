import { createContext, useContext } from "react";
import type { Permission } from "./admin-types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminSessionInfo {
  id: string;
  name: string;
  handle: string;
  role: "owner" | "support" | "accountant" | "moderator";
  permissions: Permission[];
  mustChangePassword?: boolean;
}

export interface AdminAccountInfo {
  id: string;
  name: string;
  handle: string;
  role: "owner" | "support" | "accountant" | "moderator";
  permissions: Permission[];
  active: boolean;
  mustChangePassword?: boolean;
}

// ── React context ─────────────────────────────────────────────────────────────

export const AdminSessionContext = createContext<AdminSessionInfo | null>(null);

export function useAdminSession(): AdminSessionInfo | null {
  return useContext(AdminSessionContext);
}

// ── Internal fetch helper ─────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function adminFetch(path: string, init?: RequestInit) {
  return fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

// ── Auth API ──────────────────────────────────────────────────────────────────

export async function fetchAdminSession(): Promise<AdminSessionInfo | null> {
  try {
    const res = await adminFetch("/api/admin/session");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function loginAdmin(
  handle: string,
  password: string
): Promise<AdminSessionInfo> {
  const res = await adminFetch("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ handle, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Login failed");
  }
  return res.json();
}

export async function logoutAdmin(): Promise<void> {
  await adminFetch("/api/admin/logout", { method: "POST" }).catch(() => {});
}

export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string
): Promise<AdminSessionInfo> {
  const res = await adminFetch("/api/admin/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Password change failed");
  }
  return res.json();
}

// ── Account management API (owner only) ───────────────────────────────────────

export async function listAdminAccounts(): Promise<AdminAccountInfo[]> {
  const res = await adminFetch("/api/admin/accounts");
  if (!res.ok) throw new Error("Failed to load admin accounts");
  return res.json();
}

export async function createAdminAccount(data: {
  name: string;
  handle: string;
  role: AdminAccountInfo["role"];
  password: string;
  permissions: Permission[];
  active: boolean;
}): Promise<AdminAccountInfo> {
  const res = await adminFetch("/api/admin/accounts", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to create account");
  }
  return res.json();
}

export async function updateAdminAccount(
  id: string,
  data: Partial<{
    name: string;
    handle: string;
    role: AdminAccountInfo["role"];
    password: string;
    permissions: Permission[];
    active: boolean;
  }>
): Promise<AdminAccountInfo> {
  const res = await adminFetch(`/api/admin/accounts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to update account");
  }
  return res.json();
}

export async function deleteAdminAccount(id: string): Promise<void> {
  const res = await adminFetch(`/api/admin/accounts/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to delete account");
  }
}

// ── Permission helpers ────────────────────────────────────────────────────────

export function hasPermission(
  session: AdminSessionInfo,
  perm: Permission
): boolean {
  if (session.role === "owner") return true;
  return session.permissions.includes(perm);
}

export function effectivePermissions(session: AdminSessionInfo): Permission[] {
  if (session.role === "owner") {
    return [
      "users", "games", "economy", "affiliate", "finance",
      "security", "gamification", "content", "system",
    ];
  }
  return session.permissions;
}
