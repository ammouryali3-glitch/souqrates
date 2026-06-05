/**
 * Blockchain deposit poller.
 *
 * Polls TON Center API (TON) and TronGrid API (USDT TRC20) every 60 seconds
 * for new incoming transactions to the platform deposit wallets.
 *
 * User identification: sender includes their Telegram user ID as the
 * transaction comment/memo. The server parses it, looks up the user, and
 * credits their balance.
 *
 * Env vars:
 *   TON_DEPOSIT_WALLET    — TON/USDt-on-TON deposit address (optional)
 *   TRON_DEPOSIT_WALLET   — USDT TRC20 deposit address (optional)
 *   TONCENTER_API_KEY     — TON Center API key (optional, raises rate limit)
 *
 * Admin config key "deposit_config":
 *   { skzPerUsdt: number, skzPerTon: number }
 *
 * Deposit records use the blockchain tx hash as their DB ID to prevent
 * double-crediting. If a deposit row with that ID already exists, it is
 * skipped.
 */
import { db } from "@workspace/db";
import { platformUsersTable, depositsTable, adminConfigTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60_000;

/** USDT TRC20 contract on TRON mainnet */
const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

const TON_WALLET = process.env.TON_DEPOSIT_WALLET ?? "";
const TRON_WALLET = process.env.TRON_DEPOSIT_WALLET ?? "";
const TON_API_KEY = process.env.TONCENTER_API_KEY ?? "";

/** Default exchange rates (admin config "deposit_config" can override). */
const DEFAULT_SKZ_PER_USDT = 100;
const DEFAULT_SKZ_PER_TON = 500;

// ── Rate config ───────────────────────────────────────────────────────────────

interface DepositConfig {
  skzPerUsdt: number;
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
        skzPerUsdt: typeof c.skzPerUsdt === "number" && c.skzPerUsdt > 0 ? c.skzPerUsdt : DEFAULT_SKZ_PER_USDT,
        skzPerTon: typeof c.skzPerTon === "number" && c.skzPerTon > 0 ? c.skzPerTon : DEFAULT_SKZ_PER_TON,
      };
    }
  } catch { /* use defaults */ }
  return { skzPerUsdt: DEFAULT_SKZ_PER_USDT, skzPerTon: DEFAULT_SKZ_PER_TON };
}

// ── Poller state ──────────────────────────────────────────────────────────────

interface PollerState {
  tonLastLt: string;    // TON: last processed logical time (lt), skip older TXs
  tronMinBlock: number; // TRON: minimum block timestamp (ms) to process
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
        tronMinBlock: typeof s.tronMinBlock === "number" ? s.tronMinBlock : Date.now() - 60_000,
      };
    }
  } catch { /* use defaults */ }
  return { tonLastLt: "0", tronMinBlock: Date.now() - 60_000 };
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
 * Credit a confirmed deposit to a user.
 * Returns false if the deposit was already processed (txHash exists as a deposit ID).
 */
async function creditDeposit(
  txHash: string,
  tgId: string,
  currency: "TON" | "USDT",
  rawAmount: number,  // native units: nanotons (TON) or micro-USDT (USDT TRC20)
  skzRate: number,    // SKZ per 1 currency unit
): Promise<boolean> {
  // Convert from raw units to display units.
  const amount = currency === "TON" ? rawAmount / 1e9 : rawAmount / 1e6;
  const skzCredit = Math.floor(amount * skzRate);

  if (skzCredit <= 0) return false;

  // Check if already processed
  const existing = await db.select().from(depositsTable).where(eq(depositsTable.id, txHash)).limit(1);
  if (existing.length > 0) return false;

  // Look up user
  const [userRow] = await db
    .select()
    .from(platformUsersTable)
    .where(eq(platformUsersTable.id, tgId))
    .limit(1);
  if (!userRow) {
    logger.warn({ tgId, txHash, currency }, "ton-poller: deposit memo tgId not found in DB");
    return false;
  }

  const userData = userRow.data as Record<string, unknown>;
  const userName = String(userData.name ?? "");

  // Credit SKZ and update totalDeposit atomically
  const nowMs = Date.now();
  const usdtEquivalent = currency === "USDT" ? amount : amount * (DEFAULT_SKZ_PER_TON / DEFAULT_SKZ_PER_USDT);

  await db.transaction(async (tx) => {
    // Credit SKZ balance and update totalDeposit
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
            to_jsonb(COALESCE((data #>> '{totalDeposit}')::numeric, 0) + ${usdtEquivalent}::numeric)
          ),
          '{lastSeen}',
          to_jsonb(${nowMs}::bigint)
        ),
        updated_at = NOW()
      WHERE id = ${tgId}
    `);

    // Create confirmed deposit record
    const depositData = {
      id: txHash,
      userId: tgId,
      userName,
      currency,
      amount,
      skzCredited: skzCredit,
      txHash,
      status: "confirmed",
      at: nowMs,
    };

    await tx
      .insert(depositsTable)
      .values({ id: txHash, status: "confirmed", data: depositData })
      .onConflictDoNothing();
  });

  logger.info(
    { tgId, txHash, currency, amount, skzCredit },
    "ton-poller: deposit confirmed and credited",
  );
  return true;
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

      await creditDeposit(hash, tgId, "TON", rawValue, config.skzPerTon);
    }

    return latestLt;
  } catch (err) {
    logger.warn({ err }, "ton-poller: TON poll error");
    return state.tonLastLt;
  }
}

// ── TRON USDT TRC20 poller ────────────────────────────────────────────────────

/**
 * Fetch the raw memo/data field from a TRON transaction.
 * TronGrid returns the memo as a hex-encoded UTF-8 string in
 * `raw_data.data`. Returns null if absent or the fetch fails.
 */
async function fetchTronTxMemo(txId: string): Promise<string | null> {
  try {
    const url = `https://api.trongrid.io/v1/transactions/${txId}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = await res.json() as {
      data?: Array<{ raw_data?: { data?: string } }>;
    };
    const hexData = json.data?.[0]?.raw_data?.data;
    if (!hexData) return null;
    // Hex-encoded UTF-8 memo
    return Buffer.from(hexData, "hex").toString("utf8").trim();
  } catch {
    return null;
  }
}

async function pollTron(state: PollerState): Promise<number> {
  if (!TRON_WALLET) return state.tronMinBlock;

  try {
    const params = new URLSearchParams({
      contract_address: USDT_TRC20_CONTRACT,
      limit: "50",
      order_by: "block_timestamp,desc",
      min_timestamp: String(state.tronMinBlock),
    });

    const url = `https://api.trongrid.io/v1/accounts/${TRON_WALLET}/transactions/trc20?${params}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "ton-poller: TRON API returned non-OK status");
      return state.tronMinBlock;
    }

    const json = await res.json() as { data?: Array<{
      transaction_id: string;
      block_timestamp: number;
      from: string;
      to: string;
      value: string;
      token_info: { decimals: number; symbol: string };
    }> };

    if (!Array.isArray(json.data)) return state.tronMinBlock;

    const config = await getDepositConfig();
    let maxTs = state.tronMinBlock;

    for (const tx of json.data) {
      if (tx.to.toLowerCase() !== TRON_WALLET.toLowerCase()) continue;
      if (tx.token_info.symbol !== "USDT") continue;

      if (tx.block_timestamp > maxTs) maxTs = tx.block_timestamp;
      if (tx.block_timestamp <= state.tronMinBlock) continue;

      const rawValue = parseInt(tx.value, 10);
      if (!Number.isFinite(rawValue) || rawValue <= 0) continue;

      // Fetch the full transaction to extract the memo from raw_data.data
      // (hex-encoded UTF-8 string the sender includes as a note/memo).
      const memo = await fetchTronTxMemo(tx.transaction_id);
      const tgId = parseTgIdFromComment(memo);
      if (!tgId) {
        logger.debug(
          { txId: tx.transaction_id, memo },
          "ton-poller: TRON USDT tx has no parseable tgId memo — skipping",
        );
        continue;
      }

      await creditDeposit(tx.transaction_id, tgId, "USDT", rawValue, config.skzPerUsdt);
    }

    return maxTs;
  } catch (err) {
    logger.warn({ err }, "ton-poller: TRON poll error");
    return state.tronMinBlock;
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────

let running = false;

async function runPoll(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const state = await loadPollerState();
    const [newTonLt, newTronTs] = await Promise.all([
      pollTon(state),
      pollTron(state),
    ]);

    const updatedState: PollerState = {
      tonLastLt: newTonLt,
      tronMinBlock: newTronTs,
    };
    await savePollerState(updatedState);
  } catch (err) {
    logger.error({ err }, "ton-poller: unexpected error in poll cycle");
  } finally {
    running = false;
  }
}

export function startDepositPoller(): void {
  if (!TON_WALLET && !TRON_WALLET) {
    logger.warn(
      "ton-poller: neither TON_DEPOSIT_WALLET nor TRON_DEPOSIT_WALLET is set — " +
      "deposit auto-detection is disabled. Set these env vars to enable.",
    );
    return;
  }

  logger.info(
    { tonWallet: TON_WALLET || "(not set)", tronWallet: TRON_WALLET || "(not set)" },
    "ton-poller: deposit poller starting",
  );

  // Run once immediately, then every POLL_INTERVAL_MS
  runPoll().catch(() => {});
  setInterval(() => runPoll().catch(() => {}), POLL_INTERVAL_MS);
}
