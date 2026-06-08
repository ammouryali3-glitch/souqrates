/**
 * Quests engine — rotating daily & weekly missions.
 *
 * Missions reward XP + SKZ for engagement ("play 5 games", "earn 1000 SKZ",
 * "check in"). Quest *definitions* (which missions are active, their targets and
 * rewards) live ONLY here, server-authoritative, and are exposed to the client
 * via GET /api/user/quests so the two never drift.
 *
 * Per-user progress is stored on the user JSONB under `data.quests`. Progress is
 * tracked per metric inside a period bucket (daily / weekly); a quest is complete
 * when its metric reaches the quest target. Buckets auto-reset when the period
 * rolls over (new UTC day / new ISO week).
 *
 * Progress is accrued INSIDE the same locked DB transaction that credits the
 * balance (game-result, checkin) via `bumpQuests`, so it can never diverge from
 * the financial state.
 */

export type QuestMetric = "games_played" | "skz_earned" | "checkin";
export type QuestPeriod = "daily" | "weekly";

export interface QuestDef {
  id: string;
  period: QuestPeriod;
  metric: QuestMetric;
  target: number;
  rewardXp: number;
  rewardSkz: number;
}

/**
 * Daily quest pool. A rotating window of DAILY_DISPLAY_COUNT quests is active
 * each UTC day, so missions feel fresh without bespoke per-day config.
 */
const DAILY_POOL: QuestDef[] = [
  { id: "d_play3", period: "daily", metric: "games_played", target: 3, rewardXp: 30, rewardSkz: 150 },
  { id: "d_play7", period: "daily", metric: "games_played", target: 7, rewardXp: 60, rewardSkz: 350 },
  { id: "d_earn500", period: "daily", metric: "skz_earned", target: 500, rewardXp: 40, rewardSkz: 200 },
  { id: "d_earn1500", period: "daily", metric: "skz_earned", target: 1500, rewardXp: 80, rewardSkz: 500 },
  { id: "d_checkin", period: "daily", metric: "checkin", target: 1, rewardXp: 25, rewardSkz: 100 },
  { id: "d_play5", period: "daily", metric: "games_played", target: 5, rewardXp: 45, rewardSkz: 250 },
];

const DAILY_DISPLAY_COUNT = 3;

/** Weekly quests are a fixed set that resets every ISO week. */
const WEEKLY_QUESTS: QuestDef[] = [
  { id: "w_play30", period: "weekly", metric: "games_played", target: 30, rewardXp: 250, rewardSkz: 2000 },
  { id: "w_earn10k", period: "weekly", metric: "skz_earned", target: 10000, rewardXp: 350, rewardSkz: 3000 },
  { id: "w_checkin5", period: "weekly", metric: "checkin", target: 5, rewardXp: 200, rewardSkz: 1500 },
];

// ── Period keys ──────────────────────────────────────────────────────────────

/** UTC calendar day, e.g. "2026-06-08". */
export function dailyPeriodKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** ISO week key, e.g. "2026-W24". */
export function weeklyPeriodKey(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Shift to the Thursday of the current ISO week (ISO weeks belong to the year of their Thursday).
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Whole UTC days since epoch — drives daily rotation. */
function epochDay(now: Date = new Date()): number {
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000);
}

/** The daily quests active for the given day (deterministic rotating window). */
export function activeDailyQuests(now: Date = new Date()): QuestDef[] {
  const start = ((epochDay(now) % DAILY_POOL.length) + DAILY_POOL.length) % DAILY_POOL.length;
  const out: QuestDef[] = [];
  for (let i = 0; i < DAILY_DISPLAY_COUNT; i++) {
    out.push(DAILY_POOL[(start + i) % DAILY_POOL.length]!);
  }
  return out;
}

export function activeWeeklyQuests(): QuestDef[] {
  return WEEKLY_QUESTS;
}

/** Look up a currently-active quest definition by id (daily or weekly). */
export function findActiveQuest(id: string, now: Date = new Date()): QuestDef | null {
  return (
    activeDailyQuests(now).find((q) => q.id === id) ??
    activeWeeklyQuests().find((q) => q.id === id) ??
    null
  );
}

// ── Per-user state ───────────────────────────────────────────────────────────

interface PeriodBucket {
  period: string;
  metrics: Partial<Record<QuestMetric, number>>;
  claimed: string[];
}

export interface QuestsState {
  daily: PeriodBucket;
  weekly: PeriodBucket;
}

function freshBucket(period: string): PeriodBucket {
  return { period, metrics: {}, claimed: [] };
}

function sanitizeBucket(raw: unknown, period: string): PeriodBucket {
  const r = (raw ?? {}) as Partial<PeriodBucket>;
  const metrics: Partial<Record<QuestMetric, number>> = {};
  const rawMetrics = (r.metrics ?? {}) as Record<string, unknown>;
  for (const m of ["games_played", "skz_earned", "checkin"] as QuestMetric[]) {
    const v = Number(rawMetrics[m]);
    if (Number.isFinite(v) && v > 0) metrics[m] = Math.floor(v);
  }
  const claimed = Array.isArray(r.claimed) ? r.claimed.filter((x): x is string => typeof x === "string") : [];
  return { period, metrics, claimed };
}

/**
 * Normalize stored quest state to the CURRENT periods. Buckets whose period no
 * longer matches are reset (progress + claims cleared).
 */
export function normalizeQuests(raw: unknown, now: Date = new Date()): QuestsState {
  const dKey = dailyPeriodKey(now);
  const wKey = weeklyPeriodKey(now);
  const r = (raw ?? {}) as Partial<QuestsState>;
  const daily = r.daily && r.daily.period === dKey ? sanitizeBucket(r.daily, dKey) : freshBucket(dKey);
  const weekly = r.weekly && r.weekly.period === wKey ? sanitizeBucket(r.weekly, wKey) : freshBucket(wKey);
  return { daily, weekly };
}

/**
 * Apply metric deltas to both the daily and weekly buckets, returning the new
 * quest state to persist. Call inside the balance-mutating transaction.
 */
export function bumpQuests(
  raw: unknown,
  deltas: Partial<Record<QuestMetric, number>>,
  now: Date = new Date(),
): QuestsState {
  const state = normalizeQuests(raw, now);
  for (const bucket of [state.daily, state.weekly]) {
    for (const m of Object.keys(deltas) as QuestMetric[]) {
      const delta = deltas[m] ?? 0;
      if (delta <= 0) continue;
      bucket.metrics[m] = (bucket.metrics[m] ?? 0) + Math.floor(delta);
    }
  }
  return state;
}

// ── API view ─────────────────────────────────────────────────────────────────

export interface QuestView {
  id: string;
  period: QuestPeriod;
  metric: QuestMetric;
  target: number;
  rewardXp: number;
  rewardSkz: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  claimable: boolean;
}

function viewOf(q: QuestDef, bucket: PeriodBucket): QuestView {
  const current = bucket.metrics[q.metric] ?? 0;
  const completed = current >= q.target;
  const claimed = bucket.claimed.includes(q.id);
  return {
    id: q.id,
    period: q.period,
    metric: q.metric,
    target: q.target,
    rewardXp: q.rewardXp,
    rewardSkz: q.rewardSkz,
    progress: Math.min(current, q.target),
    completed,
    claimed,
    claimable: completed && !claimed,
  };
}

/** Build the client-facing list of active quests with the user's progress. */
export function buildQuestViews(raw: unknown, now: Date = new Date()): QuestView[] {
  const state = normalizeQuests(raw, now);
  const out: QuestView[] = [];
  for (const q of activeDailyQuests(now)) out.push(viewOf(q, state.daily));
  for (const q of activeWeeklyQuests()) out.push(viewOf(q, state.weekly));
  return out;
}
