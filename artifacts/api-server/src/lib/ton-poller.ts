/**
 * Blockchain deposit poller.
 *
 * Polls TON Center API every 60 seconds for new incoming TON transactions
 * to the platform deposit wallet.
 *
 * User identification: sender includes their Telegram user ID as the
 * transaction comment/memo. The server parses it, looks up the user, and
 * credits their balance.
 *
 * Env vars:
 *   TON_DEPOSIT_WALLET    — TON deposit address (required to enable polling)
 *   TONCENTER_API_KEY     — TON Center API key (optional, raises rate limit)
 *
 * Admin config key "deposit_config":
 *   { skzPerTon: number }
 *
 * Deposit records use the blockchain tx hash as their DB ID to prevent
 * double-crediting. If a deposit row with that ID already exists, it is
 * skipped.
 */
import { db } from "@workspace/db";
import { platformUsersTable, depositsTable, adminConfigTable } from "@workspace/db";
import { eq, sql } from "@workspace/db";
import { logger } from "./logger";
import { recordLedger } from "./ledger";

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60_000;

const TON_WALLET = process.env.TON_DEPOSIT_WALLET ?? "";
const TON_API_KEY = process.env.TONCENTER_API_KEY ?? "";

/** Default exchange rate (admin config "deposit_config" can override). */
const DEFAULT_SKZ_PER_TON = 500;

// ── Rate config ───────────────────────────────────────────────────────────────

interface DepositConfig {
  skzPerTon: number;
}

async function getDepositConfig(): Promise<DepositConfig> {
  try {
    const [row] = await db
      .select()
      .from(adminConfigTable)
      .where(eq(adminConfigTable.key, "deposit_config"))
      .limit(1);
    if (row?.value) {
      const c = row.value as Partial<DepositConfig>;
      return {
        skzPerTon: typeof c.skzPerTon === "number" && c.skzPerTon > 0 ? c.skzPerTon : DEFAULT_SKZ_PER_TON,
      };
    }
  } catch { /* use defaults */ }
  return { skzPerTon: DEFAULT_SKZ_PER_TON };
}

// ── Poller state ──────────────────────────────────────────────────────────────

interface PollerState {
  tonLastLt: string;    // TON: last processed logical time (lt), skip older TXs
}

async function loadPollerState(): Promise<PollerState> {
  try {
    const [row] = await db
      .select()
      .from(adminConfigTable)
      .where(eq(adminConfigTable.key, "poller_state"))
      .limit(1);
    if (row?.value) {
      const s = row.value as Partial<PollerState>;
      return {
        tonLastLt: typeof s.tonLastLt === "string" ? s.tonLastLt : "0",
      };
    }
  } catch { /* use defaults */ }
  return { tonLastLt: "0" };
}

async function savePollerState(state: PollerState): Promise<void> {
  try {
    await db
      .insert(adminConfigTable)
      .values({ key: "poller_state", value: state as object, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: adminConfigTable.key,
        set: { value: state as object, updatedAt: new Date() },
      });
  } catch (err) {
    logger.warn({ err }, "ton-poller: failed to save poller state");
  }
}

// ── Credit helper ─────────────────────────────────────────────────────────────

/**
 * Credit a confirmed TON deposit to a user — exactly once.
 *
 * Idempotency guarantee: the deposit row (keyed by txHash) is inserted FIRST
 * inside the transaction. If the INSERT is skipped by the unique-conflict guard
 * (meaning another concurrent process already claimed this txHash), the balance
 * credit and ledger entry are never written. This prevents double-crediting even
 * under concurrent poller instances.
 *
 * Returns true if the deposit was newly credited, false if already processed or
 * the user was not found.
 */
async function creditDeposit(
  txHash: string,
  tgId: string,
  rawAmount: number,  // native units: nanotons
  skzRate: number,    // SKZ per 1 TON
): Promise<boolean> {
  const amount = rawAmount / 1e9;
  const skzCredit = Math.floor(amount * skzRate);

  if (skzCredit <= 0) return false;

  const nowMs = Date.now();
  let credited = false;

  try {
    await db.transaction(async (tx) => {
      // 1. Lock the user row so we read an accurate balance for the ledger.
      const [userRow] = await tx
        .select()
        .from(platformUsersTable)
        .where(eq(platformUsersTable.id, tgId))
        .for("update")
        .limit(1);

      if (!userRow) {
        logger.warn({ tgId, txHash }, "ton-poller: deposit memo tgId not found in DB");
        return;
      }

      const userData = userRow.data as Record<string, unknown>;
      const userName = String(userData.name ?? "");
      const skzBefore = Math.floor(Number(
        (userData.balances as Record<string, unknown> | undefined)?.SKZ ?? 0,
      ));
      const skzAfter = skzBefore + skzCredit;

      const depositData = {
        id: txHash,
        userId: tgId,
        userName,
        currency: "TON",
        amount,
        skzCredited: skzCredit,
        txHash,
        status: "confirmed",
        at: nowMs,
      };

      // 2. Try to claim this txHash. ON CONFLICT DO NOTHING means a second concurrent
      //    call for the same hash inserts nothing and returns an empty array → bail out.
      const inserted = await tx
        .insert(depositsTable)
        .values({ id: txHash, status: "confirmed", data: depositData })
        .onConflictDoNothing()
        .returning({ id: depositsTable.id });

      if (inserted.length === 0) return; // already processed by another call

      // 3. Credit SKZ balance atomically.
      await tx.execute(sql`
        UPDATE platform_users
        SET
          data = jsonb_set(
            jsonb_set(
              jsonb_set(data,
                '{balances,SKZ}',
                to_jsonb(COALESCE((data #>> '{balances,SKZ}')::numeric, 0) + ${skzCredit}::numeric)
              ),
              '{totalDeposit}',
              to_jsonb(COALESCE((data #>> '{totalDeposit}')::numeric, 0) + ${amount}::numeric)
            ),
            '{lastSeen}',
            to_jsonb(${nowMs}::bigint)
          ),
          updated_at = NOW()
        WHERE id = ${tgId}
      `);

      // 4. Record in ledger.
      await recordLedger(tx, {
        userId: tgId,
        type: "credit",
        reason: "deposit",
        amount: skzCredit,
        balanceBefore: skzBefore,
        balanceAfter: skzAfter,
        ref: txHash,
        meta: { tonAmount: amount, txHash },
      });

      credited = true;
    });
  } catch (err) {
    logger.error({ tgId, txHash, err }, "ton-poller: creditDeposit transaction failed");
    return false;
  }

  if (credited) {
    logger.info({ tgId, txHash, amount, skzCredit }, "ton-poller: TON deposit confirmed and credited");
  }
  return credited;
}

// ── Parse tgId from TON comment ──────────────────────────────────────────────

function parseTgIdFromComment(comment: string | null | undefined): string | null {
  if (!comment) return null;
  const trimmed = comment.trim();
  // Accept "123456789" or "tgid:123456789" or "id:123456789"
  const match = trimmed.match(/^(?:tgid:|id:)?(\d{5,12})$/i);
  return match ? match[1] : null;
}

// ── TON poller ────────────────────────────────────────────────────────────────

async function pollTon(state: PollerState): Promise<string> {
  if (!TON_WALLET) return state.tonLastLt;

  try {
    const params = new URLSearchParams({
      address: TON_WALLET,
      limit: "50",
      archival: "false",
    });
    const headers: Record<string, string> = { Accept: "application/json" };
    if (TON_API_KEY) headers["X-API-Key"] = TON_API_KEY;

    const url = `https://toncenter.com/api/v2/getTransactions?${params}`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      logger.warn({ status: res.status }, "ton-poller: TON API returned non-OK status");
      return state.tonLastLt;
    }

    const json = await res.json() as { ok: boolean; result: Array<{
      transaction_id: { lt: string; hash: string };
      in_msg?: {
        source?: string;
        value?: string;
        message?: string;
        comment?: string;
      };
    }> };

    if (!json.ok || !Array.isArray(json.result)) return state.tonLastLt;

    const config = await getDepositConfig();
    let latestLt = state.tonLastLt;

    for (const tx of json.result) {
      const lt = tx.transaction_id.lt;
      const hash = tx.transaction_id.hash;

      // Skip already-processed transactions
      if (BigInt(lt) <= BigInt(state.tonLastLt || "0")) continue;

      if (BigInt(lt) > BigInt(latestLt || "0")) latestLt = lt;

      const inMsg = tx.in_msg;
      if (!inMsg?.source || !inMsg.value) continue;

      const rawValue = parseInt(inMsg.value, 10);
      if (!Number.isFinite(rawValue) || rawValue <= 0) continue;

      const comment = inMsg.comment ?? inMsg.message ?? null;
      const tgId = parseTgIdFromComment(comment);
      if (!tgId) continue;

      await creditDeposit(hash, tgId, rawValue, config.skzPerTon);
    }

    return latestLt;
  } catch (err) {
    logger.warn({ err }, "ton-poller: TON poll error");
    return state.tonLastLt;
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────

let running = false;

async function runPoll(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const state = await loadPollerState();
    const newTonLt = await pollTon(state);
    await savePollerState({ tonLastLt: newTonLt });
  } catch (err) {
    logger.error({ err }, "ton-poller: unexpected error in poll cycle");
  } finally {
    running = false;
  }
}

export function startDepositPoller(): void {
  if (!TON_WALLET) {
    logger.warn(
      "ton-poller: TON_DEPOSIT_WALLET is not set — deposit auto-detection is disabled.",
    );
    return;
  }

  logger.info({ tonWallet: TON_WALLET }, "ton-poller: deposit poller starting");

  // Run once immediately, then every POLL_INTERVAL_MS
  runPoll().catch(() => {});
  setInterval(() => runPoll().catch(() => {}), POLL_INTERVAL_MS);
}
