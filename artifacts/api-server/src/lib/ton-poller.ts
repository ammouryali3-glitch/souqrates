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

const POLL_INTERVAL_MS = 60_000;       // base interval
const MAX_POLL_INTERVAL_MS = 5 * 60_000; // back-off ceiling

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
    // Prefer finance.depositSkzPerTon (set by admin panel), fall back to deposit_config.skzPerTon
    const [financeRow, depositRow] = await Promise.all([
      db.select().from(adminConfigTable).where(eq(adminConfigTable.key, "finance")).limit(1).then((r) => r[0]),
      db.select().from(adminConfigTable).where(eq(adminConfigTable.key, "deposit_config")).limit(1).then((r) => r[0]),
    ]);
    const fin = (financeRow?.value ?? {}) as { depositSkzPerTon?: number };
    const dep = (depositRow?.value ?? {}) as { skzPerTon?: number };
    const rate = typeof fin.depositSkzPerTon === "number" && fin.depositSkzPerTon > 0
      ? fin.depositSkzPerTon
      : typeof dep.skzPerTon === "number" && dep.skzPerTon > 0
        ? dep.skzPerTon
        : DEFAULT_SKZ_PER_TON;
    return { skzPerTon: rate };
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

// ── TON Center v3 response types ──────────────────────────────────────────────

interface TonV3Tx {
  hash: string;   // base64
  lt: string;
  in_msg?: {
    source?: string;
    value?: string; // nanotons as string
    message_content?: {
      decoded?: {
        "@type"?: string;
        text?: string;
      } | null;
    } | null;
  } | null;
}

interface TonV3Response {
  transactions?: TonV3Tx[];
}

// ── TON poller (TON Center v3 API) ────────────────────────────────────────────

/**
 * Returns { lt: latestLt, apiOk } so the caller can apply backoff on failure.
 * Uses TON Center v3 (`/api/v3/transactions`) which is stable and avoids the
 * "lt not in db" 500 errors that v2 (`/api/v2/getTransactions`) produces.
 */
async function pollTon(state: PollerState): Promise<{ lt: string; apiOk: boolean }> {
  if (!TON_WALLET) return { lt: state.tonLastLt, apiOk: true };

  try {
    const params = new URLSearchParams({
      account: TON_WALLET,
      limit: "50",
      sort: "desc",
    });
    const headers: Record<string, string> = { Accept: "application/json" };
    if (TON_API_KEY) headers["X-API-Key"] = TON_API_KEY;

    const url = `https://toncenter.com/api/v3/transactions?${params}`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });

    if (!res.ok) {
      logger.warn({ status: res.status }, "ton-poller: TON API returned non-OK status");
      return { lt: state.tonLastLt, apiOk: false };
    }

    const json = await res.json() as TonV3Response;
    if (!Array.isArray(json.transactions)) return { lt: state.tonLastLt, apiOk: true };

    const config = await getDepositConfig();
    let latestLt = state.tonLastLt;

    for (const tx of json.transactions) {
      const lt = tx.lt;
      const hash = tx.hash;

      if (BigInt(lt) <= BigInt(state.tonLastLt || "0")) continue;
      if (BigInt(lt) > BigInt(latestLt || "0")) latestLt = lt;

      const inMsg = tx.in_msg;
      if (!inMsg?.source || !inMsg.value) continue;

      const rawValue = parseInt(inMsg.value, 10);
      if (!Number.isFinite(rawValue) || rawValue <= 0) continue;

      // v3: comment is in in_msg.message_content.decoded.text (type = "text_comment")
      const decoded = inMsg.message_content?.decoded;
      const comment = decoded?.["@type"] === "text_comment" ? (decoded.text ?? null) : null;
      const tgId = parseTgIdFromComment(comment);
      if (!tgId) continue;

      await creditDeposit(hash, tgId, rawValue, config.skzPerTon);
    }

    return { lt: latestLt, apiOk: true };
  } catch (err) {
    logger.warn({ err }, "ton-poller: TON poll error");
    return { lt: state.tonLastLt, apiOk: false };
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────

let running = false;

/**
 * Runs one poll cycle. Returns true on API success, false on API failure.
 * Distinguishing success lets the scheduler apply exponential back-off only
 * when the remote API is actually unavailable.
 */
async function runPoll(): Promise<boolean> {
  if (running) return true; // skip if previous cycle hasn't finished
  running = true;

  let apiOk = true;
  try {
    const state = await loadPollerState();
    const result = await pollTon(state);
    apiOk = result.apiOk;
    await savePollerState({ tonLastLt: result.lt });
  } catch (err) {
    logger.error({ err }, "ton-poller: unexpected error in poll cycle");
    apiOk = false;
  } finally {
    running = false;
  }
  return apiOk;
}

export function startDepositPoller(): void {
  if (!TON_WALLET) {
    logger.warn(
      "ton-poller: TON_DEPOSIT_WALLET is not set — deposit auto-detection is disabled.",
    );
    return;
  }

  logger.info({ tonWallet: TON_WALLET }, "ton-poller: deposit poller starting");

  // Exponential back-off: 60s base, doubles on each consecutive API failure,
  // caps at MAX_POLL_INTERVAL_MS (5 min) so logs don't flood on sustained outages.
  let failStreak = 0;

  function scheduleNext(): void {
    const delay = Math.min(
      POLL_INTERVAL_MS * Math.pow(2, failStreak),
      MAX_POLL_INTERVAL_MS,
    );
    setTimeout(async () => {
      const ok = await runPoll();
      failStreak = ok ? 0 : Math.min(failStreak + 1, 5);
      scheduleNext();
    }, delay);
  }

  // First run immediately, then enter the back-off loop
  runPoll().then((ok) => {
    failStreak = ok ? 0 : 1;
    scheduleNext();
  }).catch(() => {
    failStreak = 1;
    scheduleNext();
  });
}
