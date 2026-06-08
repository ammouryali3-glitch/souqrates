/**
 * Haptic feedback via the Telegram WebApp API.
 *
 * Falls back to the browser Vibration API when running outside Telegram so the
 * feedback still works in the web (email-login) experience where supported.
 * All calls are best-effort and never throw.
 */

interface TgHaptics {
  impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
  notificationOccurred(type: "error" | "success" | "warning"): void;
  selectionChanged(): void;
}

function tgHaptics(): TgHaptics | null {
  return (
    (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: TgHaptics } } })
      .Telegram?.WebApp?.HapticFeedback ?? null
  );
}

function vibrate(ms: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
  } catch { /* ignore */ }
}

export function hapticImpact(style: "light" | "medium" | "heavy" | "rigid" | "soft" = "light"): void {
  const h = tgHaptics();
  if (h) { try { h.impactOccurred(style); return; } catch { /* fall through */ } }
  vibrate(style === "heavy" || style === "rigid" ? 30 : style === "medium" ? 18 : 10);
}

export function hapticSuccess(): void {
  const h = tgHaptics();
  if (h) { try { h.notificationOccurred("success"); return; } catch { /* fall through */ } }
  vibrate([12, 40, 18]);
}

export function hapticError(): void {
  const h = tgHaptics();
  if (h) { try { h.notificationOccurred("error"); return; } catch { /* fall through */ } }
  vibrate([20, 50, 20]);
}

export function hapticWarning(): void {
  const h = tgHaptics();
  if (h) { try { h.notificationOccurred("warning"); return; } catch { /* fall through */ } }
  vibrate([15, 30, 15]);
}

export function hapticSelection(): void {
  const h = tgHaptics();
  if (h) { try { h.selectionChanged(); return; } catch { /* fall through */ } }
  vibrate(6);
}
