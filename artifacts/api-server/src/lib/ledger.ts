/**
 * Financial ledger helper.
 *
 * Inserts one row into balance_transactions for every balance mutation so that
 * every SKZ credit/debit is permanently auditable and reconstructible.
 *
 * ALWAYS call this inside the same DB transaction that modifies the user's balance.
 * That way the ledger row and the balance update are atomic — there can never be
 * a ledger row without a matching balance change or vice-versa.
 *
 * Ledger IDs use UUIDv7 (time-ordered, globally unique, zero collision risk at
 * any realistic scale). Chronological sort order is preserved naturally.
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
  | "admin"
  | "stars_purchase"
  | "spin"
  | "lootbox";

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
 * Generates a UUIDv7 — time-ordered, globally unique.
 * First 48 bits = Unix ms timestamp → lexicographic sort = chronological sort.
 * Remaining bits = cryptographic random → zero collision risk at any scale.
 */
function uuidv7(): string {
  const bytes = randomBytes(16);
  const ms = BigInt(Date.now());
  // Embed timestamp in bytes 0-5 (48 bits)
  bytes[0] = Number((ms >> 40n) & 0xffn);
  bytes[1] = Number((ms >> 32n) & 0xffn);
  bytes[2] = Number((ms >> 24n) & 0xffn);
  bytes[3] = Number((ms >> 16n) & 0xffn);
  bytes[4] = Number((ms >> 8n) & 0xffn);
  bytes[5] = Number(ms & 0xffn);
  // Set version nibble = 7 (bits 48-51)
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  // Set variant bits = 10xx (RFC 4122)
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  // Format as UUID string
  const h = Array.from(bytes, (b) => b!.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
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
    id: uuidv7(),
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
