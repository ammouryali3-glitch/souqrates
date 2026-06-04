import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Volume2, VolumeX, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }

type TileType = "single" | "long";
interface PianoTile {
  id: number; lane: number; y: number; height: number; type: TileType;
  hit: boolean; hitT: number; missed: boolean;
  holdStarted: boolean;
}
interface FlashParticle { x: number; y: number; r: number; color: string; life: number; max: number; alpha: number; }
interface GameState {
  tiles: PianoTile[];
  nextId: number; spawnTimer: number; scrollSpeed: number;
  laneHeld: [boolean, boolean, boolean, boolean];
  flashTimers: [number, number, number, number];
  missFlash: number;
  particles: FlashParticle[];
  score: number; target: number; timeLeft: number; timeMax: number;
  running: boolean; lastTime: number;
  shakeT: number; flashT: number;
}

const BEST_KEY = "skz_piano_best";
const BALANCE_KEY = "skz_balance";
const START_BALANCE = 1000;
const TWO_PI = Math.PI * 2;
const LANE_COLORS = ["#FF6B6B", "#4ECDC4", "#FFD93D", "#C77DFF"] as const;
const LANE_DARK = ["#551010", "#0f3535", "#554800", "#2a0055"] as const;
const BASE_SPEED = 230;
const MAX_SPEED = 580;
const HIT_ZONE_H = 72;

const TICKETS: Ticket[] = [
  { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 8,  time: 35 },
  { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 12, time: 33 },
  { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 16, time: 31 },
  { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 20, time: 30 },
  { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 25, time: 28 },
];

class AudioEngine {
  private ctx: AudioContext | null = null; private master: GainNode | null = null; muted = false;
  private ensure() {
    if (!this.ctx) { const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(this.ctx.destination); }
    if (this.ctx.state === "suspended") void this.ctx.resume(); return this.ctx;
  }
  private tone(f: number, d: number, t: OscillatorType, v: number, delay = 0) {
    if (this.muted) return; const ctx = this.ensure(); if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay; const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = t; osc.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    osc.connect(g); g.connect(this.master); osc.start(t0); osc.stop(t0 + d + 0.01);
  }
  private noise(d: number, v: number) {
    if (this.muted) return; const ctx = this.ensure(); if (!ctx || !this.master) return;
    const t0 = ctx.currentTime; const buf = ctx.createBuffer(1, ctx.sampleRate * d, ctx.sampleRate);
    const da = buf.getChannelData(0); for (let i = 0; i < da.length; i++) da[i] = (Math.random() * 2 - 1) * (1 - i / da.length);
    const src = ctx.createBufferSource(); src.buffer = buf; const g = ctx.createGain(); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    src.connect(g); g.connect(this.master!); src.start(t0);
  }
  // 4 distinct notes per lane (pentatonic scale)
  tapLane(lane: number, isLong = false) {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const f = notes[lane]; const v = isLong ? 0.55 : 0.45;
    this.tone(f, 0.18, "triangle", v); this.tone(f * 2, 0.1, "sine", 0.18, 0.02);
  }
  miss() { this.noise(0.25, 0.5); this.tone(150, 0.2, "sawtooth", 0.4); }
  tick(u = false) { this.tone(u ? 900 : 650, 0.07, "square", u ? 0.22 : 0.13); }
  start() { [392, 523, 659].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.32, i * 0.06)); }
  goal() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.24, "triangle", 0.38, i * 0.07)); this.tone(262, 0.5, "sine", 0.2); }
  gameOver() { [392, 311, 261, 196].forEach((f, i) => this.tone(f, 0.3, "sawtooth", 0.28, i * 0.12)); }
  dispose() { if (this.ctx) { void this.ctx.close(); this.ctx = null; this.master = null; } }
}

function spawnTile(g: GameState, laneW: number, score: number): void {
  // Decide type: long tiles become more common at higher scores
  const longChance = Math.min(0.38, 0.08 + score * 0.022);
  const type: TileType = Math.random() < longChance ? "long" : "single";
  const height = type === "long" ? 160 + Math.floor(Math.random() * 100) : 80;

  // Pick lane (avoid same lane twice in a row)
  const lastLane = g.tiles.length > 0 ? g.tiles[g.tiles.length - 1].lane : -1;
  let lane = Math.floor(Math.random() * 4);
  if (lane === lastLane && Math.random() < 0.7) lane = (lane + 1 + Math.floor(Math.random() * 3)) % 4;

  // Occasionally spawn a "double" (two tiles, same time, different lanes)
  const doubleTile = score >= 5 && Math.random() < 0.18;

  g.tiles.push({ id: g.nextId++, lane, y: -height, height, type, hit: false, hitT: 0, missed: false, holdStarted: false });

  if (doubleTile) {
    const lane2 = (lane + 1 + Math.floor(Math.random() * 3)) % 4;
    g.tiles.push({ id: g.nextId++, lane: lane2, y: -height, height: 80, type: "single", hit: false, hitT: 0, missed: false, holdStarted: false });
  }
  _ = laneW;
}
let _ = 0;

export default function PianoGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const rafRef = useRef(0);
  const audioRef = useRef(new AudioEngine());
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const lastSecRef = useRef(0);
  const timerBarRef = useRef<HTMLDivElement>(null);
  const pointerLanesRef = useRef(new Map<number, number>()); // pointerId → lane

  const [phase, setPhase] = useState<Phase>("select");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [muted, setMuted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [balance, setBalance] = useState(START_BALANCE);
  const target = ticket?.target ?? 0;

  useEffect(() => {
    setBest(Number(localStorage.getItem(BEST_KEY) || "0"));
    const b = localStorage.getItem(BALANCE_KEY); setBalance(b === null ? START_BALANCE : Number(b));
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current; const wrap = wrapRef.current; if (!canvas || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = wrap.clientWidth * dpr; canvas.height = wrap.clientHeight * dpr;
    canvas.style.width = `${wrap.clientWidth}px`; canvas.style.height = `${wrap.clientHeight}px`;
    sizeRef.current = { w: wrap.clientWidth, h: wrap.clientHeight, dpr };
  }, []);

  useEffect(() => { resize(); const ro = new ResizeObserver(resize); if (wrapRef.current) ro.observe(wrapRef.current); return () => ro.disconnect(); }, [resize]);

  const newGameState = useCallback((t: Ticket): GameState => ({
    tiles: [], nextId: 0, spawnTimer: 0,
    scrollSpeed: BASE_SPEED,
    laneHeld: [false, false, false, false],
    flashTimers: [0, 0, 0, 0],
    missFlash: 0,
    particles: [],
    score: 0, target: t.target, timeLeft: t.time, timeMax: t.time,
    running: true, lastTime: 0,
    shakeT: 0, flashT: 0,
  }), []);

  const loop = useCallback((time: number) => {
    const g = gameRef.current; const canvas = canvasRef.current; if (!g || !canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const { w, h, dpr } = sizeRef.current;
    if (!g.lastTime) g.lastTime = time;
    const dt = Math.min((time - g.lastTime) / 1000, 0.05); g.lastTime = time;

    const LANE_W = w / 4;
    const HIT_Y = h * 0.80;

    // Timer
    if (g.running) {
      g.timeLeft = Math.max(0, g.timeLeft - dt);
      const sec = Math.ceil(g.timeLeft);
      if (sec !== lastSecRef.current) { lastSecRef.current = sec; setTimeLeft(sec); if (sec <= 5 && sec > 0) audioRef.current.tick(sec <= 3); }
      const ratio = Math.max(0, g.timeLeft / g.timeMax);
      const bar = timerBarRef.current;
      if (bar) { bar.style.width = `${ratio * 100}%`; bar.style.backgroundImage = ratio <= 0.28 ? "linear-gradient(to right,rgb(239,68,68),rgb(251,146,60))" : "linear-gradient(to right,#ffffff,#cccccc)"; }
      if (g.timeLeft <= 0) endRef.current(g.score, "time");
    }

    // Speed escalation
    g.scrollSpeed = Math.min(MAX_SPEED, BASE_SPEED + g.score * 22);

    // Spawn tiles
    g.spawnTimer -= dt;
    if (g.spawnTimer <= 0) {
      spawnTile(g, LANE_W, g.score);
      const interval = Math.max(0.3, 1.05 - g.score * 0.04);
      g.spawnTimer = interval;
    }

    // Move tiles
    for (const tile of g.tiles) {
      if (!tile.hit) tile.y += g.scrollSpeed * dt;
      else { tile.y += g.scrollSpeed * dt * 0.5; tile.hitT -= dt; } // hit tiles continue but fade
    }

    // Miss detection: tile exits hit zone without being hit
    if (g.running) {
      for (const tile of g.tiles) {
        if (!tile.hit && !tile.missed) {
          const tileBottom = tile.y + tile.height;
          // Long tile: missed if it exits without being held
          if (tile.type === "long" && tile.holdStarted && !g.laneHeld[tile.lane]) {
            // Released early — but we'll be lenient, just mark as hit
            tile.hit = true; tile.hitT = 0.4;
          }
          // Missed: top of tile passes hit zone bottom
          if (tile.y > HIT_Y + HIT_ZONE_H + 10) {
            tile.missed = true;
            audioRef.current.miss();
            g.missFlash = 0.45;
            g.shakeT = 0.4;
            endRef.current(g.score, "miss");
          }
          _ = tileBottom;
        }
      }
    }

    // Flash timers
    for (let i = 0; i < 4; i++) { if (g.flashTimers[i] > 0) g.flashTimers[i] -= dt; }
    if (g.missFlash > 0) g.missFlash -= dt;
    if (g.shakeT > 0) g.shakeT -= dt;
    if (g.flashT > 0) g.flashT -= dt;

    // Remove off-screen tiles
    g.tiles = g.tiles.filter(t => t.y < h + 200);

    // Particles
    for (const p of g.particles) { p.life -= dt; p.r += 40 * dt; p.alpha = Math.max(0, p.life / p.max); }
    g.particles = g.particles.filter(p => p.life > 0);

    // Long hold checks
    if (g.running) {
      for (const tile of g.tiles) {
        if (tile.type === "long" && tile.holdStarted && !tile.hit) {
          const inZone = tile.y + tile.height >= HIT_Y && tile.y <= HIT_Y + HIT_ZONE_H;
          if (!inZone) { tile.hit = true; tile.hitT = 0.35; }
        }
      }
    }

    // ---- Render ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);

    // Shake
    let sx = 0, sy = 0;
    if (g.shakeT > 0) { const m = 20 * Math.max(0, g.shakeT / 0.4); sx = (Math.random() * 2 - 1) * m; sy = (Math.random() * 2 - 1) * m; }
    ctx.save(); ctx.translate(sx, sy);

    // Lane separators
    for (let i = 1; i < 4; i++) {
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(i * LANE_W - 0.75, 0, 1.5, h);
    }

    // Hit zone bar
    for (let i = 0; i < 4; i++) {
      const lx = i * LANE_W;
      const flashAmt = Math.max(0, g.flashTimers[i]);
      // Base bar
      ctx.fillStyle = `rgba(40,40,40,0.8)`;
      ctx.fillRect(lx + 3, HIT_Y, LANE_W - 6, HIT_ZONE_H);
      // Color flash
      if (flashAmt > 0) {
        ctx.save(); ctx.globalAlpha = flashAmt * 0.85;
        ctx.fillStyle = LANE_COLORS[i];
        ctx.shadowColor = LANE_COLORS[i]; ctx.shadowBlur = 28;
        ctx.fillRect(lx + 3, HIT_Y, LANE_W - 6, HIT_ZONE_H);
        ctx.restore();
      }
      // Top border of hit zone
      ctx.fillStyle = `rgba(${parseInt(LANE_COLORS[i].slice(1,3),16)},${parseInt(LANE_COLORS[i].slice(3,5),16)},${parseInt(LANE_COLORS[i].slice(5,7),16)},0.6)`;
      ctx.fillRect(lx + 2, HIT_Y, LANE_W - 4, 2.5);
      // Lane color dot
      ctx.fillStyle = LANE_COLORS[i];
      ctx.beginPath(); ctx.arc(lx + LANE_W / 2, HIT_Y + HIT_ZONE_H / 2, 8, 0, TWO_PI); ctx.fill();
    }

    // Tiles
    for (const tile of g.tiles) {
      const lx = tile.lane * LANE_W;
      const MARGIN = 5;
      const tx = lx + MARGIN; const tw = LANE_W - MARGIN * 2;
      const ty = tile.y; const th = tile.height;

      if (tile.hit) {
        const a = Math.max(0, tile.hitT / 0.4);
        ctx.save(); ctx.globalAlpha = a * 0.4;
        ctx.fillStyle = LANE_COLORS[tile.lane];
        ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 8); ctx.fill();
        ctx.restore(); continue;
      }
      if (tile.missed) continue;

      const inZone = ty + th >= HIT_Y && ty <= HIT_Y + HIT_ZONE_H;
      const isHeld = tile.type === "long" && tile.holdStarted;

      // Shadow
      ctx.save(); ctx.globalAlpha = 0.3; ctx.shadowColor = inZone ? LANE_COLORS[tile.lane] : "#333"; ctx.shadowBlur = inZone ? 18 : 6;
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.roundRect(tx + 4, ty + 6, tw, th, 8); ctx.fill(); ctx.restore();

      // Body
      if (isHeld) {
        // Glowing held tile
        ctx.save(); ctx.shadowColor = LANE_COLORS[tile.lane]; ctx.shadowBlur = 24;
        const gr = ctx.createLinearGradient(tx, ty, tx, ty + th);
        gr.addColorStop(0, LANE_COLORS[tile.lane]); gr.addColorStop(0.5, "#fff"); gr.addColorStop(1, LANE_COLORS[tile.lane]);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 8); ctx.fill(); ctx.restore();
      } else {
        // Normal black tile
        ctx.fillStyle = inZone ? "#2a2a2a" : "#111111";
        ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 8); ctx.fill();
        // Accent stripe at top of tile
        const gr2 = ctx.createLinearGradient(tx, ty, tx + tw, ty);
        gr2.addColorStop(0, "transparent"); gr2.addColorStop(0.3, LANE_COLORS[tile.lane]); gr2.addColorStop(0.7, LANE_COLORS[tile.lane]); gr2.addColorStop(1, "transparent");
        ctx.fillStyle = gr2; ctx.fillRect(tx, ty, tw, 3);

        if (tile.type === "long") {
          // Hold icon in center
          ctx.fillStyle = `rgba(${parseInt(LANE_COLORS[tile.lane].slice(1, 3), 16)},${parseInt(LANE_COLORS[tile.lane].slice(3, 5), 16)},${parseInt(LANE_COLORS[tile.lane].slice(5, 7), 16)},0.4)`;
          const cy2 = ty + th / 2; const cx2 = tx + tw / 2;
          ctx.beginPath(); ctx.roundRect(cx2 - 16, cy2 - 5, 32, 10, 5); ctx.fill();
          // Bottom accent
          const gr3 = ctx.createLinearGradient(tx, ty + th - 3, tx + tw, ty + th - 3);
          gr3.addColorStop(0, "transparent"); gr3.addColorStop(0.3, LANE_COLORS[tile.lane]); gr3.addColorStop(0.7, LANE_COLORS[tile.lane]); gr3.addColorStop(1, "transparent");
          ctx.fillStyle = gr3; ctx.fillRect(tx, ty + th - 3, tw, 3);
        }
      }

      // Glow on in-zone tiles
      if (inZone && !isHeld) {
        ctx.save(); ctx.globalAlpha = 0.22; ctx.shadowColor = LANE_COLORS[tile.lane]; ctx.shadowBlur = 20;
        ctx.strokeStyle = LANE_COLORS[tile.lane]; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 8); ctx.stroke(); ctx.restore();
      }
    }

    // Particles (flash circles)
    for (const p of g.particles) {
      ctx.save(); ctx.globalAlpha = p.alpha * 0.7;
      ctx.strokeStyle = p.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TWO_PI); ctx.stroke(); ctx.restore();
    }

    ctx.restore(); // end shake

    // Miss flash overlay
    if (g.missFlash > 0) { ctx.fillStyle = `rgba(220,20,20,${(g.missFlash / 0.45) * 0.45})`; ctx.fillRect(0, 0, w, h); }

    if (g.running || g.particles.length > 0) rafRef.current = requestAnimationFrame(loop);
  }, []);

  const startLoop = useCallback(() => { cancelAnimationFrame(rafRef.current); if (gameRef.current) gameRef.current.lastTime = 0; rafRef.current = requestAnimationFrame(loop); }, [loop]);
  const startingRef = useRef(false);

  const finishGame = useCallback((finalScore: number, outcome: "win" | "miss" | "time") => {
    const g = gameRef.current; if (!g || !g.running) return; g.running = false; startingRef.current = false;
    setBest(prev => { const n = Math.max(prev, finalScore); localStorage.setItem(BEST_KEY, String(n)); return n; });
    if (outcome === "win") { audioRef.current.goal(); const t = ticketRef.current; if (t) setBalance(prev => { const n = prev + t.prize; localStorage.setItem(BALANCE_KEY, String(n)); return n; }); setPhase("won"); }
    else { audioRef.current.gameOver(); setPhase("lost"); }
  }, []);

  const ticketRef = useRef<Ticket | null>(null);
  useEffect(() => { ticketRef.current = ticket; }, [ticket]);
  const endRef = useRef(finishGame);
  useEffect(() => { endRef.current = finishGame; }, [finishGame]);

  const hitLane = useCallback((lane: number) => {
    const g = gameRef.current; if (!g || !g.running) return;
    const { w, h } = sizeRef.current;
    const LANE_W = w / 4;
    const HIT_Y = h * 0.80;
    const LANE_X = lane * LANE_W + LANE_W / 2;

    // Find a tile in the hit zone for this lane
    const tile = g.tiles.find(t => !t.hit && !t.missed && t.lane === lane && t.y + t.height >= HIT_Y && t.y <= HIT_Y + HIT_ZONE_H);
    if (tile) {
      if (tile.type === "single") {
        tile.hit = true; tile.hitT = 0.4;
        g.flashTimers[lane] = 0.35;
        audioRef.current.tapLane(lane, false);
        // Spawn flash particle
        g.particles.push({ x: LANE_X, y: HIT_Y + HIT_ZONE_H / 2, r: 10, color: LANE_COLORS[lane], life: 0.45, max: 0.45, alpha: 1 });
        g.score += 1; setScore(g.score);
        if (g.score >= g.target) endRef.current(g.score, "win");
      } else if (tile.type === "long" && !tile.holdStarted) {
        tile.holdStarted = true;
        g.flashTimers[lane] = 0.2;
        audioRef.current.tapLane(lane, true);
      }
    }
  }, []);

  const releaseLane = useCallback((lane: number) => {
    const g = gameRef.current; if (!g) return;
    g.laneHeld[lane] = false;
    // Score the long tile on release
    const { w, h } = sizeRef.current;
    const LANE_W = w / 4;
    const HIT_Y = h * 0.80;
    const tile = g.tiles.find(t => t.type === "long" && t.holdStarted && !t.hit && t.lane === lane);
    if (tile) {
      const inZone = tile.y + tile.height >= HIT_Y && tile.y <= HIT_Y + HIT_ZONE_H;
      if (inZone) {
        tile.hit = true; tile.hitT = 0.35;
        g.score += 1; setScore(g.score);
        if (g.score >= g.target) endRef.current(g.score, "win");
      }
    }
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (phase !== "playing") return;
    const g = gameRef.current; if (!g || !g.running) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { w } = sizeRef.current;
    const lx = e.clientX - rect.left;
    const lane = Math.max(0, Math.min(3, Math.floor(lx / (w / 4))));
    pointerLanesRef.current.set(e.pointerId, lane);
    g.laneHeld[lane] = true;
    hitLane(lane);
  }, [phase, hitLane]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const lane = pointerLanesRef.current.get(e.pointerId);
    if (lane !== undefined) { pointerLanesRef.current.delete(e.pointerId); releaseLane(lane); }
    const g = gameRef.current; if (g) { const { w } = sizeRef.current; const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); const lx = e.clientX - rect.left; const l = Math.max(0, Math.min(3, Math.floor(lx / (w / 4)))); g.laneHeld[l] = false; }
  }, [releaseLane]);

  const playTicket = useCallback((t: Ticket) => {
    if (startingRef.current || t.price > balance) return; startingRef.current = true;
    setBalance(prev => { const n = prev - t.price; localStorage.setItem(BALANCE_KEY, String(n)); return n; });
    audioRef.current.start(); setTicket(t); gameRef.current = newGameState(t);
    lastSecRef.current = t.time; setScore(0); setTimeLeft(t.time);
    if (timerBarRef.current) timerBarRef.current.style.width = "100%";
    pointerLanesRef.current.clear();
    setPhase("playing"); startLoop();
  }, [balance, newGameState, startLoop]);

  useEffect(() => { const audio = audioRef.current; return () => { cancelAnimationFrame(rafRef.current); audio.dispose(); }; }, []);
  const refillBalance = useCallback(() => { setBalance(START_BALANCE); localStorage.setItem(BALANCE_KEY, String(START_BALANCE)); }, []);
  const toggleMute = () => { audioRef.current.muted = !muted; setMuted(!muted); };

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden bg-black select-none">
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3">
        <Link href="/games"><button data-testid="button-back-arena" className="w-10 h-10 rounded-full bg-white/5 backdrop-blur border border-white/10 flex items-center justify-center text-white/80 transition-colors"><ArrowLeft size={18} /></button></Link>
        <div className="flex flex-col items-center -mt-1">
          <span className="text-[10px] tracking-[0.3em] text-white/50 font-display uppercase">{phase === "playing" ? "Tiles Hit" : "Piano Tiles"}</span>
          <span data-testid="text-score" className="font-display font-black text-4xl text-white leading-none">{score}</span>
          {phase === "playing" && <span className="text-[9px] tracking-[0.25em] text-white/50 font-display uppercase mt-0.5">GOAL {target}</span>}
        </div>
        <button data-testid="button-toggle-mute" onClick={toggleMute} className="w-10 h-10 rounded-full bg-white/5 backdrop-blur border border-white/10 flex items-center justify-center text-white/80 transition-colors">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
      </div>

      {phase === "playing" && (
        <div className="absolute top-[84px] left-1/2 -translate-x-1/2 z-30 w-[68%] flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-[0.25em] text-white/40 font-display uppercase">Progress</span><span data-testid="text-progress" className="text-[11px] font-display font-bold tracking-wider tabular-nums text-white/90">{score} / {target}</span></div>
            <div className="relative w-full h-2.5 rounded-full bg-white/10 overflow-hidden"><div data-testid="bar-progress" className="h-full rounded-full bg-gradient-to-r from-white to-white/80 transition-[width] duration-300 ease-out" style={{ width: `${target > 0 ? Math.min(100, (score / target) * 100) : 0}%` }} /></div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-[0.25em] text-white/40 font-display uppercase">Time</span><span data-testid="text-timer" className={`text-[11px] font-display font-bold tracking-wider tabular-nums ${timeLeft <= 5 ? "text-red-400" : "text-white/60"}`}>{timeLeft}s</span></div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden"><div ref={timerBarRef} data-testid="bar-timer" className="h-full rounded-full" style={{ width: "100%" }} /></div>
          </div>
        </div>
      )}

      <div ref={wrapRef} className="flex-1 relative"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}>
        <canvas ref={canvasRef} data-testid="canvas-piano" className="absolute inset-0 touch-none" />
      </div>

      <AnimatePresence>{phase === "select" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col bg-black/85 backdrop-blur-md px-6 pt-16 pb-6 overflow-y-auto">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-white/60" /><span className="text-[11px] tracking-[0.4em] text-white/40 font-display uppercase">Piano Tiles Rush</span></div>
            <h1 className="font-display font-black text-2xl leading-tight text-white mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/40 mb-4 max-w-[260px]">Tap the black tiles as they fall. Hold for long tiles. Miss one and it's over!</p>
            <div className="flex gap-1.5 mb-4">
              {LANE_COLORS.map((c, i) => <div key={i} className="w-6 h-6 rounded-full shadow-lg" style={{ backgroundColor: c, boxShadow: `0 0 12px ${c}` }} />)}
            </div>
            <div className="flex items-center gap-2 mb-5 px-4 py-2 rounded-xl bg-white/8 border border-white/15"><Coins size={14} className="text-white/70" /><span data-testid="text-balance" className="text-sm font-display font-bold text-white tracking-wide">{balance.toLocaleString()} SKZ</span></div>
            <div className="w-full flex flex-col gap-2.5">
              {TICKETS.map(t => { const ok = t.price <= balance; return (
                <button key={t.id} disabled={!ok} onClick={() => ok && playTicket(t)} data-testid={`button-ticket-${t.id}`}
                  className={`w-full flex items-center justify-between rounded-2xl border p-3.5 transition-all ${ok ? "bg-white/5 border-white/10 hover:border-white/30 active:scale-[0.98]" : "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed"}`}>
                  <div className="flex flex-col items-start"><span className="font-display font-bold text-base text-white tracking-wide">{t.name}</span><span className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Goal {t.target} tiles · {t.time}s</span></div>
                  <div className="flex flex-col items-end"><span className="flex items-center gap-1 text-white font-display font-bold text-sm"><Coins size={12} />{t.prize.toLocaleString()}</span><span className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Entry {t.price}</span></div>
                </button>
              ); })}
            </div>
            <div className="flex items-center gap-1.5 mt-5 text-[11px] text-white/40"><Trophy size={11} className="text-white/50" /><span data-testid="text-best">Best {best}</span></div>
            {balance < 30 ? (<button onClick={refillBalance} data-testid="button-refill" className="mt-5 w-full py-3 rounded-2xl bg-white text-black font-display font-bold text-sm tracking-widest active:scale-95 transition-transform">🎁 GET 1,000 FREE CHIPS</button>) : (<button onClick={refillBalance} data-testid="button-refill" className="mt-3 text-[10px] text-white/25 hover:text-white/50 transition-colors underline underline-offset-2">Low on chips? Get 1,000 free</button>)}
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      <AnimatePresence>{phase === "won" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md px-8">
          <motion.div initial={{ scale: 0.85, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: "spring", bounce: 0.4 }} className="w-full max-w-[300px] flex flex-col items-center text-center">
            <div className="flex gap-1 mb-3">{LANE_COLORS.map((c, i) => <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />)}</div>
            <span data-testid="text-result" className="text-xs tracking-[0.4em] font-display uppercase mb-2 text-white/60">Perfect Rhythm</span>
            <div className="font-display font-black text-5xl text-white mb-1">+{ticket?.prize.toLocaleString() ?? 0}</div>
            <span className="text-sm text-white/50 mb-6">SKZ prize claimed</span>
            <div className="w-full grid grid-cols-2 gap-3 mb-7">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center"><div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Tiles Hit</div><span data-testid="text-final-score" className="font-display font-bold text-xl text-white">{score}</span></div>
              <div className="bg-white/8 border border-white/15 rounded-2xl p-3 flex flex-col items-center"><div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Balance</div><span data-testid="text-balance-final" className="font-display font-bold text-xl text-white">{balance.toLocaleString()}</span></div>
            </div>
            <button onClick={() => setPhase("select")} data-testid="button-replay" className="w-full py-3.5 rounded-2xl bg-white text-black font-display font-bold tracking-widest flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform"><RotateCcw size={18} />PLAY AGAIN</button>
            <Link href="/games"><button data-testid="button-exit" className="text-sm text-white/50 hover:text-white transition-colors">Back to Arena</button></Link>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      <AnimatePresence>{phase === "lost" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md px-8">
          <motion.div initial={{ scale: 0.85, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: "spring", bounce: 0.35 }} className="w-full max-w-[300px] flex flex-col items-center text-center">
            <span data-testid="text-result" className="text-xs tracking-[0.4em] font-display uppercase mb-2 text-red-400">Missed!</span>
            <div data-testid="text-loss-amount" className="font-display font-black text-5xl text-white mb-1">-{ticket?.price ?? 0}</div>
            <span className="text-sm text-white/50 mb-6">SKZ entry lost</span>
            <div className="w-full grid grid-cols-2 gap-3 mb-7">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center"><div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Reached</div><span data-testid="text-final-score" className="font-display font-bold text-xl text-white">{score}/{target}</span></div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center"><div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Balance</div><span data-testid="text-balance-final" className="font-display font-bold text-xl text-white">{balance.toLocaleString()}</span></div>
            </div>
            <button onClick={() => setPhase("select")} data-testid="button-replay" className="w-full py-3.5 rounded-2xl bg-white text-black font-display font-bold tracking-widest flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform"><RotateCcw size={18} />TRY AGAIN</button>
            <Link href="/games"><button data-testid="button-exit" className="text-sm text-white/50 hover:text-white transition-colors">Back to Arena</button></Link>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}
