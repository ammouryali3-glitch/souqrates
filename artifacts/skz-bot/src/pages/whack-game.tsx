import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Volume2, VolumeX, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";
import { GAME_TICKETS } from "@/lib/tickets-data";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }

type CellType = "empty" | "creature" | "bomb" | "golden" | "freeze";
interface Cell {
  type: CellType;
  t: number;       // current lifetime (counts up from 0)
  maxT: number;    // total display time before it disappears
  popping: boolean; // animating in (0→1)
  popT: number;    // 0..0.25 for pop-in animation
  hitT: number;    // > 0 means recently hit (flash animation)
  spawnDelay: number; // time until next creature spawns here
}
interface RippleParticle { x: number; y: number; r: number; life: number; max: number; color: string; }

interface GameState {
  cells: Cell[];
  freezeT: number;   // > 0 = timer frozen
  multiplier: number; multiplierT: number; // x2 multiplier from golden
  particles: RippleParticle[];
  score: number; target: number; timeLeft: number; timeMax: number;
  running: boolean; lastTime: number;
  shakeT: number; shakeMag: number; flashT: number; goodFlashT: number;
}

const BEST_KEY = "skz_whack_best";
const BALANCE_KEY = "skz_balance";
const START_BALANCE = 1000;
const TWO_PI = Math.PI * 2;
const GRID = 3;
const POP_DUR = 0.22; // seconds to fully pop in
const HIDE_DUR = 0.18; // seconds to pop out

const RAW_TICKETS: Ticket[] = GAME_TICKETS.whack;

const SPAWN_DELAYS = [0.6, 1.1, 0.85, 1.4, 0.95, 1.2, 0.7, 1.05, 0.8]; // initial delays per cell

function makeCell(spawnDelay: number): Cell {
  return { type: "empty", t: 0, maxT: 0, popping: false, popT: 0, hitT: 0, spawnDelay };
}

class AudioEngine {
  private ctx: AudioContext | null = null; private master: GainNode | null = null; muted = false;
  private ensure() {
    if (!this.ctx) { const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination); }
    if (this.ctx.state === "suspended") void this.ctx.resume(); return this.ctx;
  }
  private tone(f: number, d: number, t: OscillatorType, v: number, delay = 0, gTo?: number) {
    if (this.muted) return; const ctx = this.ensure(); if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay; const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = t; osc.frequency.setValueAtTime(f, t0); if (gTo) osc.frequency.exponentialRampToValueAtTime(gTo, t0 + d);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    osc.connect(g); g.connect(this.master); osc.start(t0); osc.stop(t0 + d + 0.02);
  }
  private noise(d: number, v: number, cf: number) {
    if (this.muted) return; const ctx = this.ensure(); if (!ctx || !this.master) return;
    const t0 = ctx.currentTime; const buf = ctx.createBuffer(1, ctx.sampleRate * d, ctx.sampleRate);
    const da = buf.getChannelData(0); for (let i = 0; i < da.length; i++) da[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / da.length, 2);
    const src = ctx.createBufferSource(); src.buffer = buf; const g = ctx.createGain(); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    const flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = cf;
    src.connect(flt); flt.connect(g); g.connect(this.master); src.start(t0);
  }
  whack() { this.tone(600, 0.08, "square", 0.5, 0, 200); this.noise(0.1, 0.35, 6000); }
  golden() { [880, 1320, 1760].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.38, i * 0.04)); }
  freeze() { [440, 554, 659].forEach((f, i) => this.tone(f, 0.3, "sine", 0.28, i * 0.06)); }
  bomb() { this.noise(0.6, 0.9, 12000); this.tone(80, 0.4, "sawtooth", 0.65); }
  appear() { this.tone(800, 0.06, "square", 0.15, 0, 1200); }
  tick(u = false) { this.tone(u ? 900 : 650, 0.07, "square", u ? 0.22 : 0.13); }
  start() { [392, 523, 659].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.32, i * 0.06)); }
  goal() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.24, "triangle", 0.38, i * 0.07)); this.tone(262, 0.5, "sine", 0.2); }
  gameOver() { [392, 311, 261, 196].forEach((f, i) => this.tone(f, 0.3, "sawtooth", 0.28, i * 0.12)); }
  dispose() { if (this.ctx) { void this.ctx.close(); this.ctx = null; this.master = null; } }
}

// Draw a cyber creature in a cell
function drawCreature(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number, type: CellType, t: number, hitT: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  const pulse = Math.sin(t * 6) * 0.04; // subtle breathing
  ctx.scale(1 + pulse, 1 + pulse);

  if (hitT > 0) { ctx.globalAlpha = Math.max(0, hitT / 0.3); ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.ellipse(0, 0, 30, 30, 0, 0, TWO_PI); ctx.fill(); ctx.globalAlpha = 1; }

  if (type === "creature") {
    // Alien body
    ctx.fillStyle = "#00ff88";
    ctx.shadowColor = "#00ff88"; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.ellipse(0, 4, 18, 20, 0, 0, TWO_PI); ctx.fill();
    // Head
    ctx.fillStyle = "#00cc66";
    ctx.beginPath(); ctx.ellipse(0, -14, 14, 14, 0, 0, TWO_PI); ctx.fill();
    // Eyes
    ctx.fillStyle = "#001a0a";
    ctx.beginPath(); ctx.ellipse(-5, -16, 4, 5, -0.2, 0, TWO_PI); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, -16, 4, 5, 0.2, 0, TWO_PI); ctx.fill();
    // Pupils glow
    ctx.shadowColor = "#ff0"; ctx.shadowBlur = 6;
    ctx.fillStyle = "#ffee00";
    ctx.beginPath(); ctx.arc(-5, -16, 2, 0, TWO_PI); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -16, 2, 0, TWO_PI); ctx.fill();
    // Antennae
    ctx.shadowBlur = 0; ctx.strokeStyle = "#00ff88"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-5, -25); ctx.lineTo(-12, -36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, -25); ctx.lineTo(12, -36); ctx.stroke();
    ctx.fillStyle = "#00ff88"; ctx.shadowColor="#00ff88"; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.arc(-12, -36, 3, 0, TWO_PI); ctx.fill();
    ctx.beginPath(); ctx.arc(12, -36, 3, 0, TWO_PI); ctx.fill();

  } else if (type === "bomb") {
    const countdown = Math.max(0, 1 - t / 2.5);
    // Red pulsing glow
    ctx.shadowColor = "#ff2222"; ctx.shadowBlur = 14 + Math.sin(t * 12) * 8;
    ctx.fillStyle = "#cc1111";
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, TWO_PI); ctx.fill();
    // Skull face
    ctx.shadowBlur = 0; ctx.fillStyle = "#ff5555";
    ctx.beginPath(); ctx.arc(0, -2, 12, 0, TWO_PI); ctx.fill();
    ctx.fillStyle = "#cc1111";
    ctx.beginPath(); ctx.rect(-14, 8, 28, 10); ctx.fill();
    // Skull eyes
    ctx.fillStyle = "#1a0000";
    ctx.beginPath(); ctx.arc(-4, -4, 3.5, 0, TWO_PI); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -4, 3.5, 0, TWO_PI); ctx.fill();
    // Fuse
    ctx.strokeStyle = "#888"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.bezierCurveTo(8, -28, 4, -34, 8, -38); ctx.stroke();
    ctx.fillStyle = `hsl(${40 + countdown * 20},90%,60%)`;
    ctx.shadowColor = "#ffaa00"; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(8, -38, 4, 0, TWO_PI); ctx.fill();
    // Warning ring
    ctx.shadowBlur = 0; ctx.strokeStyle = `rgba(255,50,50,${0.3 + Math.sin(t*15)*0.3})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 28, 0, TWO_PI); ctx.stroke();

  } else if (type === "golden") {
    // Gold sparkle creature
    const spin = t * 4;
    ctx.save(); ctx.rotate(spin * 0.2);
    ctx.shadowColor = "#FFD166"; ctx.shadowBlur = 22;
    ctx.fillStyle = "#FFD166";
    ctx.beginPath(); ctx.ellipse(0, 4, 18, 20, 0, 0, TWO_PI); ctx.fill();
    ctx.fillStyle = "#FFA500";
    ctx.beginPath(); ctx.ellipse(0, -14, 14, 14, 0, 0, TWO_PI); ctx.fill();
    ctx.restore();
    // Stars
    for (let i = 0; i < 5; i++) {
      const a = spin + i * TWO_PI / 5; const r = 26;
      ctx.fillStyle = `rgba(255,220,50,${0.6 + Math.sin(t * 8 + i) * 0.4})`;
      ctx.shadowColor = "#FFD166"; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 3, 0, TWO_PI); ctx.fill();
    }
    ctx.shadowBlur = 0;
    // x2 label
    ctx.fillStyle = "#000"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("×2", 0, -14);

  } else if (type === "freeze") {
    // Ice-blue creature
    ctx.shadowColor = "#88EEFF"; ctx.shadowBlur = 18;
    ctx.fillStyle = "#44AADD";
    ctx.beginPath(); ctx.ellipse(0, 4, 18, 20, 0, 0, TWO_PI); ctx.fill();
    ctx.fillStyle = "#66CCFF";
    ctx.beginPath(); ctx.ellipse(0, -14, 14, 14, 0, 0, TWO_PI); ctx.fill();
    // Snowflake
    ctx.shadowBlur = 0; ctx.strokeStyle = "#DDEEFF"; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.rotate(i * Math.PI / 3);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -12);
      ctx.moveTo(0, -7); ctx.lineTo(-4, -10);
      ctx.moveTo(0, -7); ctx.lineTo(4, -10); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = "#DDEEFF"; ctx.font = "bold 8px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("⏸", 0, -14);
  }

  ctx.restore();
}

// Draw hacker-style cell background
function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, type: CellType, active: boolean) {
  const r = 12;
  // Background
  ctx.fillStyle = active ? "#0a1a0f" : "#050e08";
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  // Border
  const borderColor = type === "bomb" ? "#ff3333" : type === "golden" ? "#FFD166" : type === "freeze" ? "#88EEFF" : type === "creature" ? "#00ff88" : "#0f3a1a";
  const glow = active ? 10 : 3;
  ctx.strokeStyle = borderColor; ctx.lineWidth = active ? 2 : 1;
  ctx.shadowColor = borderColor; ctx.shadowBlur = glow;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.stroke();
  ctx.shadowBlur = 0;
  // Corner markers (hacker UI aesthetic)
  const CL = 10; ctx.strokeStyle = "#00ff8844"; ctx.lineWidth = 1.5;
  // TL
  ctx.beginPath(); ctx.moveTo(x + r, y + 1); ctx.lineTo(x + r + CL, y + 1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 1, y + r); ctx.lineTo(x + 1, y + r + CL); ctx.stroke();
  // TR
  ctx.beginPath(); ctx.moveTo(x + w - r, y + 1); ctx.lineTo(x + w - r - CL, y + 1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w - 1, y + r); ctx.lineTo(x + w - 1, y + r + CL); ctx.stroke();
  // BR
  ctx.beginPath(); ctx.moveTo(x + w - r, y + h - 1); ctx.lineTo(x + w - r - CL, y + h - 1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w - 1, y + h - r); ctx.lineTo(x + w - 1, y + h - r - CL); ctx.stroke();
  // BL
  ctx.beginPath(); ctx.moveTo(x + r, y + h - 1); ctx.lineTo(x + r + CL, y + h - 1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 1, y + h - r); ctx.lineTo(x + 1, y + h - r - CL); ctx.stroke();
}

export default function WhackGame() {
  const TICKETS = useGameTickets("whack", RAW_TICKETS);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const rafRef = useRef(0);
  const audioRef = useRef(new AudioEngine());
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const lastSecRef = useRef(0);
  const timerBarRef = useRef<HTMLDivElement>(null);

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
    cells: SPAWN_DELAYS.map(d => makeCell(d)),
    freezeT: 0, multiplier: 1, multiplierT: 0,
    particles: [],
    score: 0, target: t.target, timeLeft: t.time, timeMax: t.time,
    running: true, lastTime: 0,
    shakeT: 0, shakeMag: 0, flashT: 0, goodFlashT: 0,
  }), []);

  const loop = useCallback((time: number) => {
    const g = gameRef.current; const canvas = canvasRef.current; if (!g || !canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const { w, h, dpr } = sizeRef.current;
    if (!g.lastTime) g.lastTime = time;
    const dt = Math.min((time - g.lastTime) / 1000, 0.05); g.lastTime = time;

    const CELL_W = Math.min((w - 32) / GRID, 110);
    const CELL_H = Math.min(CELL_W * 0.95, 100);
    const GAP = 10;
    const GRID_W = CELL_W * GRID + GAP * (GRID - 1);
    const GRID_H = CELL_H * GRID + GAP * (GRID - 1);
    const GRID_X = (w - GRID_W) / 2;
    const GRID_Y = (h - GRID_H) / 2 + 10;

    // Timer (respects freeze)
    if (g.running) {
      if (g.freezeT > 0) {
        g.freezeT -= dt;
      } else {
        g.timeLeft = Math.max(0, g.timeLeft - dt);
      }
      if (g.multiplierT > 0) g.multiplierT -= dt;
      if (g.multiplierT <= 0) g.multiplier = 1;
      const sec = Math.ceil(g.timeLeft);
      if (sec !== lastSecRef.current) { lastSecRef.current = sec; setTimeLeft(sec); if (sec <= 5 && sec > 0) audioRef.current.tick(sec <= 3); }
      const ratio = Math.max(0, g.timeLeft / g.timeMax);
      const bar = timerBarRef.current;
      if (bar) { bar.style.width = `${ratio * 100}%`; bar.style.backgroundImage = g.freezeT > 0 ? "linear-gradient(to right,#88EEFF,#44AADD)" : ratio <= 0.28 ? "linear-gradient(to right,rgb(239,68,68),rgb(251,146,60))" : "linear-gradient(to right,hsl(140 80% 45%),hsl(170 80% 50%))"; }
      if (g.timeLeft <= 0) endRef.current(g.score, "time");
    }

    // Update cells
    const diffFactor = Math.min(2.5, 1 + g.score * 0.12); // increases difficulty
    for (let i = 0; i < 9; i++) {
      const cell = g.cells[i];
      if (cell.hitT > 0) cell.hitT -= dt;
      if (cell.type === "empty") {
        cell.spawnDelay -= dt;
        if (cell.spawnDelay <= 0 && g.running) {
          // Spawn a new creature
          const rng = Math.random();
          let type: CellType;
          let maxT: number;
          if (rng < 0.05) { type = "golden"; maxT = 0.45 + Math.random() * 0.3; } // rare & brief
          else if (rng < 0.12) { type = "freeze"; maxT = 0.9 + Math.random() * 0.6; }
          else if (rng < 0.25) { type = "bomb"; maxT = 1.4 + Math.random() * 1.2 / diffFactor; }
          else { type = "creature"; maxT = (1.0 + Math.random() * 1.2) / diffFactor; }
          cell.type = type; cell.t = 0; cell.maxT = maxT; cell.popping = true; cell.popT = 0;
          audioRef.current.appear();
        }
      } else {
        cell.t += dt;
        if (cell.popping) {
          cell.popT += dt;
          if (cell.popT >= POP_DUR) cell.popping = false;
        }
        // Creature timed out
        if (cell.t >= cell.maxT) {
          cell.type = "empty";
          cell.spawnDelay = (0.4 + Math.random() * 0.9) / diffFactor;
          cell.t = 0; cell.maxT = 0; cell.popping = false; cell.popT = 0;
        }
      }
    }

    // Particles
    for (const p of g.particles) { p.life -= dt; p.r += 60 * dt; }
    g.particles = g.particles.filter(p => p.life > 0);
    if (g.shakeT > 0) g.shakeT -= dt;
    if (g.flashT > 0) g.flashT -= dt;
    if (g.goodFlashT > 0) g.goodFlashT -= dt;

    // ---- Render ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#020d06"; ctx.fillRect(0, 0, w, h);

    // CRT scanlines
    for (let y2 = 0; y2 < h; y2 += 3) {
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(0, y2, w, 1);
    }

    // Subtle grid overlay
    ctx.strokeStyle = "rgba(0,255,80,0.04)"; ctx.lineWidth = 1;
    for (let x2 = 0; x2 < w; x2 += 30) { ctx.beginPath(); ctx.moveTo(x2, 0); ctx.lineTo(x2, h); ctx.stroke(); }
    for (let y2 = 0; y2 < h; y2 += 30) { ctx.beginPath(); ctx.moveTo(0, y2); ctx.lineTo(w, y2); ctx.stroke(); }

    // HUD header (terminal style)
    ctx.fillStyle = "rgba(0,255,80,0.08)";
    ctx.fillRect(0, 0, w, 58);
    ctx.strokeStyle = "rgba(0,255,80,0.18)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 58); ctx.lineTo(w, 58); ctx.stroke();

    // Shake
    let shx = 0, shy = 0;
    if (g.shakeT > 0) { const m = g.shakeMag * Math.max(0, g.shakeT / 0.6); shx = (Math.random() * 2 - 1) * m; shy = (Math.random() * 2 - 1) * m; }
    ctx.save(); ctx.translate(shx, shy);

    // Draw grid
    for (let i = 0; i < 9; i++) {
      const col = i % GRID; const row = Math.floor(i / GRID);
      const cx = GRID_X + col * (CELL_W + GAP);
      const cy = GRID_Y + row * (CELL_H + GAP);
      const cell = g.cells[i];

      drawCell(ctx, cx, cy, CELL_W, CELL_H, cell.type, cell.type !== "empty");

      if (cell.type !== "empty") {
        const progress = cell.popping ? Math.min(1, cell.popT / POP_DUR) : 1;
        // Near end: pop out
        const timeRatio = cell.t / cell.maxT;
        const popOut = timeRatio > (1 - HIDE_DUR / cell.maxT) ? Math.max(0, 1 - (timeRatio - (1 - HIDE_DUR / cell.maxT)) / (HIDE_DUR / cell.maxT)) : 1;
        const scale = easeOut(Math.min(progress, popOut));
        drawCreature(ctx, cx + CELL_W / 2, cy + CELL_H * 0.62, scale, cell.type, cell.t, cell.hitT);

        // Countdown bar for creatures
        const barW = (CELL_W - 16) * Math.max(0, 1 - cell.t / cell.maxT);
        ctx.fillStyle = cell.type === "bomb" ? "#ff3333" : cell.type === "golden" ? "#FFD166" : cell.type === "freeze" ? "#88EEFF" : "#00ff88";
        ctx.beginPath(); ctx.roundRect(cx + 8, cy + CELL_H - 10, barW, 4, 2); ctx.fill();
      }
    }

    // Ripple particles
    for (const p of g.particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.save(); ctx.globalAlpha = a * 0.7;
      ctx.strokeStyle = p.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TWO_PI); ctx.stroke(); ctx.restore();
    }

    ctx.restore();

    // Flash overlays
    if (g.flashT > 0) { ctx.fillStyle = `rgba(220,20,20,${(g.flashT / 0.6) * 0.4})`; ctx.fillRect(0, 0, w, h); }
    if (g.goodFlashT > 0) { ctx.fillStyle = `rgba(0,255,120,${(g.goodFlashT / 0.3) * 0.12})`; ctx.fillRect(0, 0, w, h); }
    // Freeze overlay
    if (g.freezeT > 0) { ctx.fillStyle = `rgba(100,200,255,${Math.min(0.12, g.freezeT * 0.06)})`; ctx.fillRect(0, 0, w, h); }

    if (g.running || g.particles.length > 0) rafRef.current = requestAnimationFrame(loop);
  }, []);

  const startLoop = useCallback(() => { cancelAnimationFrame(rafRef.current); if (gameRef.current) gameRef.current.lastTime = 0; rafRef.current = requestAnimationFrame(loop); }, [loop]);
  const startingRef = useRef(false);

  const finishGame = useCallback((finalScore: number, outcome: "win" | "bomb" | "time") => {
    const g = gameRef.current; if (!g || !g.running) return; g.running = false; startingRef.current = false;
    setBest(prev => { const n = Math.max(prev, finalScore); localStorage.setItem(BEST_KEY, String(n)); return n; });
    if (outcome === "win") { audioRef.current.goal(); const t = ticketRef.current; if (t) setBalance(prev => { const n = prev + t.prize; localStorage.setItem(BALANCE_KEY, String(n)); return n; }); setPhase("won"); }
    else { audioRef.current.gameOver(); setPhase("lost"); }
  }, []);

  const ticketRef = useRef<Ticket | null>(null);
  useEffect(() => { ticketRef.current = ticket; }, [ticket]);
  const endRef = useRef(finishGame);
  useEffect(() => { endRef.current = finishGame; }, [finishGame]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (phase !== "playing") return;
    const g = gameRef.current; if (!g || !g.running) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const tapX = e.clientX - rect.left;
    const tapY = e.clientY - rect.top;

    const { w, h } = sizeRef.current;
    const CELL_W = Math.min((w - 32) / GRID, 110);
    const CELL_H = Math.min(CELL_W * 0.95, 100);
    const GAP = 10;
    const GRID_W = CELL_W * GRID + GAP * (GRID - 1);
    const GRID_H = CELL_H * GRID + GAP * (GRID - 1);
    const GRID_X = (w - GRID_W) / 2;
    const GRID_Y = (h - GRID_H) / 2 + 10;

    for (let i = 0; i < 9; i++) {
      const col = i % GRID; const row = Math.floor(i / GRID);
      const cx = GRID_X + col * (CELL_W + GAP);
      const cy = GRID_Y + row * (CELL_H + GAP);
      if (tapX >= cx && tapX <= cx + CELL_W && tapY >= cy && tapY <= cy + CELL_H) {
        const cell = g.cells[i];
        // Ripple at cell center
        const px = cx + CELL_W / 2; const py = cy + CELL_H / 2;
        g.particles.push({ x: px, y: py, r: 10, life: 0.4, max: 0.4, color: cell.type === "bomb" ? "#ff3333" : cell.type === "golden" ? "#FFD166" : cell.type === "freeze" ? "#88EEFF" : "#00ff88" });

        if (cell.type === "creature") {
          cell.hitT = 0.3; cell.type = "empty"; cell.spawnDelay = 0.3 + Math.random() * 0.6;
          const pts = g.multiplier;
          g.score += pts; setScore(g.score);
          audioRef.current.whack(); g.goodFlashT = 0.2;
          if (g.score >= g.target) endRef.current(g.score, "win");
        } else if (cell.type === "golden") {
          cell.hitT = 0.3; cell.type = "empty"; cell.spawnDelay = 0.2 + Math.random() * 0.5;
          g.score += 3; setScore(g.score);
          g.multiplier = 2; g.multiplierT = 10;
          audioRef.current.golden(); g.goodFlashT = 0.35;
          if (g.score >= g.target) endRef.current(g.score, "win");
        } else if (cell.type === "freeze") {
          cell.hitT = 0.3; cell.type = "empty"; cell.spawnDelay = 0.3 + Math.random() * 0.5;
          g.score += 1; setScore(g.score);
          g.freezeT = 2;
          audioRef.current.freeze(); g.goodFlashT = 0.3;
          if (g.score >= g.target) endRef.current(g.score, "win");
        } else if (cell.type === "bomb") {
          audioRef.current.bomb();
          g.shakeT = 0.7; g.shakeMag = 30; g.flashT = 0.7;
          endRef.current(g.score, "bomb");
        }
        break;
      }
    }
  }, [phase]);

  const playTicket = useCallback((t: Ticket) => {
    if (startingRef.current || t.price > balance) return; startingRef.current = true;
    setBalance(prev => { const n = prev - t.price; localStorage.setItem(BALANCE_KEY, String(n)); return n; });
    audioRef.current.start(); setTicket(t); gameRef.current = newGameState(t);
    lastSecRef.current = t.time; setScore(0); setTimeLeft(t.time);
    if (timerBarRef.current) timerBarRef.current.style.width = "100%";
    setPhase("playing"); startLoop();
  }, [balance, newGameState, startLoop]);

  useEffect(() => { const audio = audioRef.current; return () => { cancelAnimationFrame(rafRef.current); audio.dispose(); }; }, []);
  const toggleMute = () => { audioRef.current.muted = !muted; setMuted(!muted); };

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden bg-[#020d06] select-none">
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3">
        <Link href="/games"><button data-testid="button-back-arena" className="w-10 h-10 rounded-full bg-[#0a1a0f] backdrop-blur border border-[#00ff8840] flex items-center justify-center text-[#00ff88] hover:text-white transition-colors"><ArrowLeft size={18} /></button></Link>
        <div className="flex flex-col items-center -mt-1">
          <span className="text-[10px] tracking-[0.3em] text-[#00ff88]/70 font-display uppercase font-mono">{phase === "playing" ? "// SCORE" : "WHACK_A_CYBER"}</span>
          <span data-testid="text-score" className="font-display font-black text-4xl text-[#00ff88] leading-none drop-shadow-[0_0_18px_rgba(0,255,136,0.55)]">{score}</span>
          {phase === "playing" && <span className="text-[9px] tracking-[0.25em] text-[#00ff88]/60 font-display font-mono uppercase mt-0.5">TARGET {target}</span>}
        </div>
        <button data-testid="button-toggle-mute" onClick={toggleMute} className="w-10 h-10 rounded-full bg-[#0a1a0f] backdrop-blur border border-[#00ff8840] flex items-center justify-center text-[#00ff88] transition-colors">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
      </div>

      {phase === "playing" && (
        <div className="absolute top-[84px] left-1/2 -translate-x-1/2 z-30 w-[72%] flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-[0.25em] text-[#00ff88]/70 font-mono uppercase">Eliminated</span><span data-testid="text-progress" className="text-[11px] font-mono font-bold tracking-wider tabular-nums text-white/90">{score} / {target}</span></div>
            <div className="relative w-full h-2.5 rounded-full bg-white/5 overflow-hidden border border-[#00ff8825]"><div data-testid="bar-progress" className="h-full rounded-full bg-gradient-to-r from-[#00ff88] to-[#00cc66] shadow-[0_0_12px_rgba(0,255,136,0.55)] transition-[width] duration-300 ease-out" style={{ width: `${target > 0 ? Math.min(100, (score / target) * 100) : 0}%` }} /></div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-[0.25em] text-white/40 font-mono uppercase">Time</span><span data-testid="text-timer" className={`text-[11px] font-mono font-bold tracking-wider tabular-nums ${timeLeft <= 5 ? "text-red-400" : "text-white/70"}`}>{timeLeft}s</span></div>
            <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} data-testid="bar-timer" className="h-full rounded-full" style={{ width: "100%" }} /></div>
          </div>
        </div>
      )}

      <div ref={wrapRef} className="flex-1 relative" onPointerDown={onPointerDown}>
        <canvas ref={canvasRef} data-testid="canvas-whack" className="absolute inset-0 touch-none" />
      </div>

      <AnimatePresence>{phase === "select" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col bg-[#020d06]/92 backdrop-blur-md px-6 pt-16 pb-6 overflow-y-auto">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-[#00ff88]" /><span className="text-[11px] tracking-[0.4em] text-[#00ff88]/50 font-mono uppercase">Whack_A_Cyber</span></div>
            <h1 className="font-display font-black text-2xl leading-tight text-[#00ff88] mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/40 mb-4 max-w-[260px]">Tap cyber creatures to score. Avoid bombs! Golden ones give ×2 score, freeze ones pause the timer.</p>
            <div className="flex items-center gap-2 mb-5 px-4 py-2 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/30"><Coins size={14} className="text-[#00ff88]" /><span data-testid="text-balance" className="text-sm font-mono font-bold text-[#00ff88] tracking-wide">{balance.toLocaleString()} SKZ</span></div>
            <div className="w-full flex flex-col gap-2.5">
              {TICKETS.map(t => { const ok = t.price <= balance; return (
                <button key={t.id} disabled={!ok} onClick={() => ok && playTicket(t)} data-testid={`button-ticket-${t.id}`}
                  className={`w-full flex items-center justify-between rounded-2xl border p-3.5 transition-all ${ok ? "bg-[#0a1a0f] border-[#00ff8840] hover:border-[#00ff88] active:scale-[0.98]" : "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed"}`}>
                  <div className="flex flex-col items-start"><span className="font-mono font-bold text-base text-[#00ff88] tracking-wide">{t.name}</span><span className="text-[10px] text-white/40 font-mono uppercase tracking-wider mt-0.5">Target {t.target} · {t.time}s</span></div>
                  <div className="flex flex-col items-end"><span className="flex items-center gap-1 text-[#00ff88] font-mono font-bold text-sm"><Coins size={12} />{t.prize.toLocaleString()}</span><span className="text-[10px] text-white/40 font-mono uppercase tracking-wider mt-0.5">Entry {t.price}</span></div>
                </button>
              ); })}
            </div>
            <div className="flex items-center gap-1.5 mt-5 text-[11px] text-white/40"><Trophy size={11} className="text-[#00ff88]" /><span data-testid="text-best" className="font-mono">Best {best}</span></div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      <AnimatePresence>{phase === "won" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#020d06]/90 backdrop-blur-md px-8">
          <motion.div initial={{ scale: 0.85, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: "spring", bounce: 0.4 }} className="w-full max-w-[300px] flex flex-col items-center text-center">
            <span className="font-mono text-[9px] tracking-widest text-[#00ff88]/50 mb-1">// MISSION_COMPLETE</span>
            <span data-testid="text-result" className="text-xs tracking-[0.4em] font-mono uppercase mb-2 text-[#00ff88]">Exterminator</span>
            <div className="font-display font-black text-5xl text-[#00ff88] mb-1">+{ticket?.prize.toLocaleString() ?? 0}</div>
            <span className="text-sm text-white/50 mb-6 font-mono">SKZ prize claimed</span>
            <div className="w-full grid grid-cols-2 gap-3 mb-7">
              <div className="bg-[#0a1a0f] border border-[#00ff8840] rounded-2xl p-3 flex flex-col items-center"><div className="text-white/40 text-[10px] font-mono uppercase tracking-wider mb-1">Kills</div><span data-testid="text-final-score" className="font-mono font-bold text-xl text-[#00ff88]">{score}</span></div>
              <div className="bg-[#0a1a0f] border border-[#00ff8840] rounded-2xl p-3 flex flex-col items-center"><div className="text-white/40 text-[10px] font-mono uppercase tracking-wider mb-1">Balance</div><span data-testid="text-balance-final" className="font-mono font-bold text-xl text-[#00ff88]">{balance.toLocaleString()}</span></div>
            </div>
            <button onClick={() => setPhase("select")} data-testid="button-replay" className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#00ff88] to-[#00cc66] text-black font-mono font-bold tracking-widest flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform"><RotateCcw size={18} />PLAY AGAIN</button>
            <Link href="/games"><button data-testid="button-exit" className="text-sm text-[#00ff88]/40 hover:text-[#00ff88] transition-colors font-mono">back_to_arena()</button></Link>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      <AnimatePresence>{phase === "lost" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#020d06]/90 backdrop-blur-md px-8">
          <motion.div initial={{ scale: 0.85, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: "spring", bounce: 0.35 }} className="w-full max-w-[300px] flex flex-col items-center text-center">
            <span className="font-mono text-[9px] tracking-widest text-red-400/50 mb-1">// SYSTEM_FAILURE</span>
            <span data-testid="text-result" className="text-xs tracking-[0.4em] font-mono uppercase mb-2 text-red-400">Bomb Hit!</span>
            <div data-testid="text-loss-amount" className="font-display font-black text-5xl text-red-400 mb-1">-{ticket?.price ?? 0}</div>
            <span className="text-sm text-white/50 mb-6 font-mono">SKZ entry lost</span>
            <div className="w-full grid grid-cols-2 gap-3 mb-7">
              <div className="bg-[#0a1a0f] border border-[#00ff8840] rounded-2xl p-3 flex flex-col items-center"><div className="text-white/40 text-[10px] font-mono uppercase tracking-wider mb-1">Kills</div><span data-testid="text-final-score" className="font-mono font-bold text-xl text-white">{score}/{target}</span></div>
              <div className="bg-[#0a1a0f] border border-[#00ff8840] rounded-2xl p-3 flex flex-col items-center"><div className="text-white/40 text-[10px] font-mono uppercase tracking-wider mb-1">Balance</div><span data-testid="text-balance-final" className="font-mono font-bold text-xl text-white">{balance.toLocaleString()}</span></div>
            </div>
            <button onClick={() => setPhase("select")} data-testid="button-replay" className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#00ff88] to-[#00cc66] text-black font-mono font-bold tracking-widest flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform"><RotateCcw size={18} />TRY AGAIN</button>
            <Link href="/games"><button data-testid="button-exit" className="text-sm text-[#00ff88]/40 hover:text-[#00ff88] transition-colors font-mono">back_to_arena()</button></Link>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}

function easeOut(t: number): number { return 1 - Math.pow(1 - t, 3); }
