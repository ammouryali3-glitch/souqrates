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
  const { gameOverrides, settings } = useAdmin();
  const o = gameOverrides[gameId];

  const priceF = (o?.priceFactor ?? 1) * settings.globalPriceFactor;
  const prizeF = (o?.prizeFactor ?? 1) * settings.globalPrizeFactor;
  const targetF = (o?.targetFactor ?? 1) * settings.globalDifficulty;
  const timeF = o?.timeFactor ?? 1;
  const freePlay = settings.freePlay;

  return useMemo(() => {
    return raw.map((t) => {
      const next: TicketLike = { ...t };
      if (typeof t.price === "number") next.price = freePlay ? 0 : Math.max(0, Math.round(t.price * priceF));
      if (typeof t.prize === "number") next.prize = Math.max(0, Math.round(t.prize * prizeF));
      if (typeof t.target === "number") next.target = clampInt(t.target * targetF, 1);
      if (typeof t.time === "number") next.time = clampInt(t.time * timeF, 3);
      return next as T;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, priceF, prizeF, targetF, timeF, freePlay]);
}

/** Effective arena entry fee, prize multiplier + winner payout share, after admin overrides. */
export function useArenaEconomy(gameId: string, baseFee: number) {
  const { gameOverrides, settings } = useAdmin();
  const o = gameOverrides[gameId];
  const absolute = typeof o?.entry === "number" ? o.entry : baseFee;
  const priceF = (o?.priceFactor ?? 1) * settings.globalPriceFactor;
  const fee = settings.freePlay ? 0 : Math.max(0, Math.round(absolute * priceF));
  const prizeFactor = Math.max(0, (o?.prizeFactor ?? 1) * settings.globalPrizeFactor);
  const winnerCut = Math.min(1, Math.max(0, settings.winnerCut));
  return { fee, prizeFactor, winnerCut };
}
