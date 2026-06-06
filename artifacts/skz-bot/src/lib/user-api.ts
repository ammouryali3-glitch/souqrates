/**
 * Public user-facing API calls for the mini-app.
 * Distinct from admin-api.ts (which is admin-session-gated).
 * All calls use the skz_user_token JWT cookie set by /api/user/init.
 */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
}

// ── Wallet data ───────────────────────────────────────────────────────────────

export interface DepositRecord {
  id: string;
  userId: string;
  currency: "TON";
  amount: number;
  skzCredited?: number;
  status: "pending" | "confirmed";
  txHash?: string;
  at: number;
}

export interface WithdrawalRecord {
  id: string;
  userId: string;
  currency: "TON";
  amount: number;
  status: "pending" | "approved" | "rejected" | "completed";
  wallet: string;
  at: number;
}

export interface WalletData {
  tonDepositWallet: string;
  depositMemo: string;
  deposits: DepositRecord[];
  withdrawals: WithdrawalRecord[];
}

export async function fetchUserWallet(): Promise<WalletData | null> {
  try {
    const res = await apiFetch("/api/user/wallet");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── Withdraw ─────────────────────────────────────────────────────────────────

export interface WithdrawResult {
  ok: boolean;
  withdrawalId?: string;
  newSkz?: number;
  error?: string;
}

// ── Shop ──────────────────────────────────────────────────────────────────────

export interface BuyProductResult {
  ok: boolean;
  newSkz?: number;
  error?: string;
}

export async function buyShopProduct(
  productId: number,
): Promise<BuyProductResult> {
  try {
    const res = await apiFetch("/api/user/shop/buy", {
      method: "POST",
      body: JSON.stringify({ productId }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, error: json.error ?? "Purchase failed" };
    }
    return { ok: true, newSkz: json.newSkz };
  } catch {
    return { ok: false, error: "Connection error" };
  }
}

// ── Daily check-in ────────────────────────────────────────────────────────────

export interface CheckinStatus {
  checkedInToday: boolean;
  streak: number;
  nextReward: number;
}

export interface CheckinResult {
  ok: boolean;
  reward?: number;
  streak?: number;
  newSkz?: number;
  error?: string;
  alreadyCheckedIn?: boolean;
}

export async function fetchCheckinStatus(): Promise<CheckinStatus | null> {
  try {
    const res = await apiFetch("/api/user/checkin/status");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function claimCheckin(): Promise<CheckinResult> {
  try {
    const res = await apiFetch("/api/user/checkin", { method: "POST" });
    const json = await res.json();
    if (res.status === 409) return { ok: false, alreadyCheckedIn: true };
    if (!res.ok) return { ok: false, error: json.error ?? "Check-in failed" };
    return { ok: true, reward: json.reward, streak: json.streak, newSkz: json.newSkz };
  } catch {
    return { ok: false, error: "Connection error" };
  }
}

// ── Withdraw ─────────────────────────────────────────────────────────────────

export async function submitWithdrawal(
  skzAmount: number,
  destWallet: string,
  _currency?: string,
): Promise<WithdrawResult> {
  try {
    const res = await apiFetch("/api/user/withdraw", {
      method: "POST",
      body: JSON.stringify({ skzAmount, destWallet }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, error: json.error ?? "فشل طلب السحب" };
    }
    return { ok: true, withdrawalId: json.withdrawalId, newSkz: json.newSkz };
  } catch {
    return { ok: false, error: "خطأ في الاتصال" };
  }
}
