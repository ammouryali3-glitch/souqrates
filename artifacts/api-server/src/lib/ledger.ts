/**
 * Financial ledger helper.
 *
 * Inserts one row into balance_transactions for every balance mutation so that
 * every SKZ credit/debit is permanently auditable and reconstructible.
 *
 * ALWAYS call this inside the same DB transaction that modifies the user's balance.
 * That way the ledger row and the balance update are atomic — there can never be
 * a ledger row without a matching balance change or vice-versa.
 */
import { randomBytes } from "crypto";
import { balanceTransactionsTable } from "@workspace/db";

export type LedgerReason =
  | "game_win"
  | "game_fee"
  | "deposit"
  | "withdrawal"
  | "prize"
  | "referral"
  | "checkin"
  | "purchase"
  | "refund"
  | "bonus"
  | "starting_balance"
  | "admin";

export interface LedgerEntry {
  userId: string;
  type: "credit" | "debit";
  reason: LedgerReason;
  currency?: string;
  amount: number;          // always positive
  balanceBefore: number;
  balanceAfter: number;
  ref?: string;            // external ID (depositId, withdrawalId, gameId, …)
  meta?: Record<string, unknown>;
}

/**
 * Append one ledger row inside an existing Drizzle transaction.
 *
 * @param tx   - The active Drizzle transaction object (from db.transaction callback).
 * @param entry - The ledger entry to record.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recordLedger(tx: any, entry: LedgerEntry): Promise<void> {
  await tx.insert(balanceTransactionsTable).values({
    id: randomBytes(8).toString("hex"),
    userId: entry.userId,
    type: entry.type,
    reason: entry.reason,
    currency: entry.currency ?? "SKZ",
    amount: Math.abs(Math.floor(entry.amount)),
    balanceBefore: Math.floor(entry.balanceBefore),
    balanceAfter: Math.floor(entry.balanceAfter),
    ref: entry.ref ?? null,
    meta: entry.meta ?? null,
    createdAt: new Date(),
  });
}
