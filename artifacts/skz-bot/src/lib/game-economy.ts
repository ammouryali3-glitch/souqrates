import { useMemo } from "react";
import { useAdmin } from "./admin-store";

/**
 * Central, admin-controlled game economy.
 *
 * Every skill game keeps its own hand-tuned ticket tiers as RAW_TICKETS and
 * passes them through `useGameTickets(gameId, RAW_TICKETS)`. Arena games pass
 * their base entry fee through `useArenaEconomy(gameId, baseFee)`. This is the
 * single place the manager's price / score-to-win / prize controls are applied,
 * so the controls are REAL (they change what the player actually pays, must
 * score, and wins) rather than cosmetic.
 */

export interface TicketLike {
  id?: string; // tier id (rookie/bronze/…) — used to match admin overrides
  price?: number; // entry cost in SKZ
  prize?: number; // payout on win
  target?: number; // score-to-win
  time?: number; // seconds allowed
}

export function clampInt(n: number, min: number): number {
  const v = Math.round(n);
  return Number.isFinite(v) ? Math.max(min, v) : min;
}

/**
 * Apply per-game + global economy factors to a list of ticket tiers.
 * Only known numeric fields are transformed; all other fields pass through.
 */
export function useGameTickets<T extends TicketLike>(gameId: string, raw: T[]): T[] {
  const { ticketOverrides, settings } = useAdmin();
  const ov = ticketOverrides[gameId];

  // Global quick levers, applied on top of each tier's (possibly overridden) value.
  const priceF = settings.globalPriceFactor;
  const prizeF = settings.globalPrizeFactor;
  const targetF = settings.globalDifficulty;
  const freePlay = settings.freePlay;

  return useMemo(() => {
    return raw.map((t) => {
      // Absolute admin override per tier replaces the game's default value.
      const po = t.id ? ov?.[t.id] : undefined;
      const basePrice = po?.price ?? t.price;
      const basePrize = po?.prize ?? t.prize;
      const baseTarget = po?.target ?? t.target;
      const baseTime = po?.time ?? t.time;

      const next: TicketLike = { ...t };
      if (typeof basePrice === "number") next.price = freePlay ? 0 : Math.max(0, Math.round(basePrice * priceF));
      if (typeof basePrize === "number") next.prize = Math.max(0, Math.round(basePrize * prizeF));
      if (typeof baseTarget === "number") next.target = clampInt(baseTarget * targetF, 1);
      if (typeof baseTime === "number") next.time = clampInt(baseTime, 3); // time edited directly per tier (no global scaling)
      return next as T;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, ov, priceF, prizeF, targetF, freePlay]);
}

/** Effective arena entry fee, prize multiplier + winner payout share, after admin overrides. */
export function useArenaEconomy(gameId: string, baseFee: number) {
  const { gameOverrides, settings } = useAdmin();
  const o = gameOverrides[gameId];
  const absolute = typeof o?.entry === "number" ? o.entry : baseFee;
  // Entry fee is edited directly in the manager; only the global lever scales it.
  const fee = settings.freePlay ? 0 : Math.max(0, Math.round(absolute * settings.globalPriceFactor));
  const prizeFactor = Math.max(0, (o?.prizeFactor ?? 1) * settings.globalPrizeFactor);
  const winnerCut = Math.min(1, Math.max(0, settings.winnerCut));
  return { fee, prizeFactor, winnerCut };
}
