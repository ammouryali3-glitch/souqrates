/**
 * Lightweight sound-effects engine using the Web Audio API.
 *
 * All effects are synthesized at runtime (no audio asset files) so the bundle
 * stays small and effects are instant. A single shared AudioContext is created
 * lazily on first use (after a user gesture, satisfying autoplay policies).
 *
 * Mute state is persisted in localStorage and exposed via a tiny store so a
 * toggle button can subscribe to it.
 */

import { useSyncExternalStore } from "react";

const MUTE_KEY = "skz_sound_muted";

let muted = (() => {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
})();

const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

export function isMuted(): boolean { return muted; }

export function setMuted(value: boolean): void {
  muted = value;
  try { localStorage.setItem(MUTE_KEY, value ? "1" : "0"); } catch { /* ignore */ }
  emit();
}

export function toggleMuted(): void { setMuted(!muted); }

export function useMuted(): boolean {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => muted,
    () => muted,
  );
}

// ── Audio engine ────────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => { /* ignore */ });
    return ctx;
  } catch {
    return null;
  }
}

interface ToneSpec {
  freq: number;
  /** Target frequency to glide to (optional). */
  toFreq?: number;
  duration: number;
  type?: OscillatorType;
  /** Peak gain (0–1). */
  gain?: number;
  /** Delay before the tone starts, seconds. */
  delay?: number;
}

function playTones(tones: ToneSpec[]): void {
  if (muted) return;
  const audio = getCtx();
  if (!audio) return;
  const now = audio.currentTime;

  for (const tone of tones) {
    const start = now + (tone.delay ?? 0);
    const osc = audio.createOscillator();
    const gainNode = audio.createGain();
    const peak = tone.gain ?? 0.18;

    osc.type = tone.type ?? "sine";
    osc.frequency.setValueAtTime(tone.freq, start);
    if (tone.toFreq) osc.frequency.exponentialRampToValueAtTime(tone.toFreq, start + tone.duration);

    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);

    osc.connect(gainNode);
    gainNode.connect(audio.destination);
    osc.start(start);
    osc.stop(start + tone.duration + 0.02);
  }
}

// ── Public effects ──────────────────────────────────────────────────────────────

export const sfx = {
  tap(): void {
    playTones([{ freq: 420, duration: 0.06, type: "triangle", gain: 0.1 }]);
  },
  click(): void {
    playTones([{ freq: 660, duration: 0.07, type: "square", gain: 0.08 }]);
  },
  coin(): void {
    playTones([
      { freq: 880, duration: 0.08, type: "square", gain: 0.12 },
      { freq: 1320, duration: 0.12, type: "square", gain: 0.12, delay: 0.06 },
    ]);
  },
  win(): void {
    playTones([
      { freq: 523, duration: 0.14, type: "triangle", gain: 0.16 },
      { freq: 659, duration: 0.14, type: "triangle", gain: 0.16, delay: 0.12 },
      { freq: 784, duration: 0.14, type: "triangle", gain: 0.16, delay: 0.24 },
      { freq: 1046, duration: 0.3, type: "triangle", gain: 0.18, delay: 0.36 },
    ]);
  },
  lose(): void {
    playTones([
      { freq: 320, toFreq: 140, duration: 0.4, type: "sawtooth", gain: 0.14 },
    ]);
  },
  levelUp(): void {
    playTones([
      { freq: 523, duration: 0.12, type: "square", gain: 0.16 },
      { freq: 659, duration: 0.12, type: "square", gain: 0.16, delay: 0.1 },
      { freq: 784, duration: 0.12, type: "square", gain: 0.16, delay: 0.2 },
      { freq: 1046, duration: 0.18, type: "square", gain: 0.18, delay: 0.3 },
      { freq: 1318, duration: 0.36, type: "triangle", gain: 0.2, delay: 0.46 },
    ]);
  },
  error(): void {
    playTones([
      { freq: 200, duration: 0.16, type: "sawtooth", gain: 0.12 },
      { freq: 160, duration: 0.2, type: "sawtooth", gain: 0.12, delay: 0.1 },
    ]);
  },
  spin(): void {
    playTones([{ freq: 300, toFreq: 1200, duration: 0.6, type: "triangle", gain: 0.12 }]);
  },
};
