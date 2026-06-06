import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Volume2, VolumeX, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";
import { GAME_TICKETS } from "@/lib/tickets-data";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }

const BEST_KEY = "skz_bubble_best";
const BALANCE_KEY = "skz_balance";
const START_BALANCE = 1000;

const RAW_TICKETS: Ticket[] = GAME_TICKETS.bubble;

const COLORS = ["#e74c3c","#3498db","#2ecc71","#f39c12","#9b59b6","#1abc9c"];
const COLOR_GLOW = ["rgba(231,76,60,0.7)","rgba(52,152,219,0.7)","rgba(46,204,113,0.7)","rgba(243,156,18,0.7)","rgba(155,89,182,0.7)","rgba(26,188,156,0.7)"];
const COLOR_DARK = ["#c0392b","#2980b9","#27ae60","#e67e22","#8e44ad","#16a085"];

const COLS = 9;
const BUBBLE_SPEED = 650;

function rowCount(score: number) { return Math.max(4, 8 - Math.floor(score / 30)); }

interface Bubble { col: number; row: number; color: number; falling?: boolean; vy?: number; x?: number; y?: number; alpha?: number; popping?: boolean; popT?: number; }
interface Projectile { x: number; y: number; vx: number; vy: number; color: number; }
interface PopParticle { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number; color: string; }
interface FloatBubble { x: number; y: number; vx: number; vy: number; r: number; color: number; alpha: number; }

interface GameState {
  grid: (number | null)[][]; // [row][col] = color index or null
  rows: number;
  projectile: Projectile | null;
  nextColor: number;
  cannonAngle: number; // radians from straight up (0 = up)
  particles: PopParticle[];
  floaters: FloatBubble[];
  score: number; target: number; timeLeft: number; timeMax: number;
  running: boolean; lastTime: number;
  missedShots: number; popTotal: number;
  comboT: number; combo: number;
  aiming: boolean; aimX: number; aimY: number;
  dropRowT: number;
}

function getBubbleXY(col: number, row: number, br: number, canvasW: number): [number, number] {
  const gridW = COLS * br * 2;
  const startX = (canvasW - gridW) / 2 + br;
  const x = startX + col * br * 2 + (row % 2 === 0 ? 0 : br);
  const y = 55 + row * br * 1.72;
  return [x, y];
}

function computeBubbleRadius(canvasW: number): number {
  return Math.max(16, Math.min(26, (canvasW - 20) / (COLS * 2 + 1)));
}

function bfsCluster(grid: (number | null)[][], startRow: number, startCol: number, color: number): [number, number][] {
  const visited = new Set<string>();
  const cluster: [number, number][] = [];
  const queue: [number, number][] = [[startRow, startCol]];
  while (queue.length) {
    const [r, c] = queue.shift()!;
    const key = `${r},${c}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (r < 0 || r >= grid.length || c < 0 || c >= COLS) continue;
    if (grid[r]?.[c] !== color) continue;
    cluster.push([r, c]);
    // Hex neighbors
    const neighbors = getNeighbors(r, c);
    for (const [nr, nc] of neighbors) queue.push([nr, nc]);
  }
  return cluster;
}

function getNeighbors(row: number, col: number): [number, number][] {
  const even = row % 2 === 0;
  return [
    [row - 1, even ? col - 1 : col],
    [row - 1, even ? col : col + 1],
    [row, col - 1],
    [row, col + 1],
    [row + 1, even ? col - 1 : col],
    [row + 1, even ? col : col + 1],
  ];
}

function findFloatingBubbles(grid: (number | null)[][]): [number, number][] {
  const visited = new Set<string>();
  const connected = new Set<string>();
  const queue: [number, number][] = [];
  // Start from top row - all connected to ceiling
  for (let c = 0; c < COLS; c++) {
    if (grid[0]?.[c] !== null && grid[0]?.[c] !== undefined) {
      const key = `0,${c}`;
      if (!visited.has(key)) { visited.add(key); connected.add(key); queue.push([0, c]); }
    }
  }
  while (queue.length) {
    const [r, c] = queue.shift()!;
    for (const [nr, nc] of getNeighbors(r, c)) {
      const key = `${nr},${nc}`;
      if (!visited.has(key) && nr >= 0 && nr < grid.length && nc >= 0 && nc < COLS && grid[nr]?.[nc] !== null && grid[nr]?.[nc] !== undefined) {
        visited.add(key); connected.add(key); queue.push([nr, nc]);
      }
    }
  }
  const floating: [number, number][] = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r]?.[c] !== null && grid[r]?.[c] !== undefined && !connected.has(`${r},${c}`)) floating.push([r, c]);
    }
  }
  return floating;
}

function countBubbles(grid: (number | null)[][]): number {
  let n = 0;
  for (const row of grid) for (const v of row) if (v !== null && v !== undefined) n++;
  return n;
}

class AudioEngine {
  private ctx: AudioContext | null = null; private master: GainNode | null = null; muted = false;
  private ensure() {
    if (!this.ctx) { const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.4; this.master.connect(this.ctx.destination); }
    if (this.ctx.state === "suspended") void this.ctx.resume(); return this.ctx;
  }
  private tone(f: number, d: number, t: OscillatorType, v: number, delay = 0, fEnd?: number) {
    if (this.muted) return; const ctx = this.ensure(); if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay; const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = t; osc.frequency.setValueAtTime(f, t0); if (fEnd) osc.frequency.exponentialRampToValueAtTime(fEnd, t0 + d);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    osc.connect(g); g.connect(this.master); osc.start(t0); osc.stop(t0 + d + 0.02);
  }
  private noise(d: number, v: number, cf = 3000) {
    if (this.muted) return; const ctx = this.ensure(); if (!ctx || !this.master) return;
    const t0 = ctx.currentTime; const buf = ctx.createBuffer(1, ctx.sampleRate * d, ctx.sampleRate);
    const da = buf.getChannelData(0); for (let i = 0; i < da.length; i++) da[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; const g2 = ctx.createGain(); g2.gain.setValueAtTime(v, t0); g2.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    const flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = cf;
    src.connect(flt); flt.connect(g2); g2.connect(this.master); src.start(t0);
  }
  shoot() { this.tone(480, 0.08, "triangle", 0.3, 0, 380); }
  pop(size: number) { const f = 660 + Math.min(size, 12) * 30; [f, f * 1.25].forEach((fr, i) => this.tone(fr, 0.18, "triangle", 0.28, i * 0.03)); this.noise(0.15, 0.2, 4000); }
  drop() { this.tone(220, 0.35, "sine", 0.3, 0, 110); this.noise(0.2, 0.25, 2000); }
  bounce() { this.tone(340, 0.05, "triangle", 0.2, 0, 480); }
  start() { [330, 440, 554, 659].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.3, i * 0.06)); }
  goal() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.24, "triangle", 0.38, i * 0.07)); }
  gameOver() { [261, 220, 196, 165].forEach((f, i) => this.tone(f, 0.28, "sawtooth", 0.28, i * 0.11)); }
  tick(u = false) { this.tone(u ? 900 : 650, 0.07, "square", u ? 0.22 : 0.13); }
  combo(n: number) { const f = 440 + n * 80; this.tone(f, 0.2, "triangle", 0.35, 0, f * 1.4); }
  dispose() { if (this.ctx) { void this.ctx.close(); this.ctx = null; this.master = null; } }
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colorIdx: number, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  // Outer glow
  ctx.shadowColor = COLOR_GLOW[colorIdx]; ctx.shadowBlur = r * 0.8;
  // Main circle
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.05, x, y, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.25, COLORS[colorIdx]);
  g.addColorStop(0.7, COLOR_DARK[colorIdx]);
  g.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 0.92, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  // Rim
  ctx.strokeStyle = `rgba(255,255,255,0.35)`; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(x, y, r * 0.92, 0, Math.PI * 2); ctx.stroke();
  // Shine spots
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath(); ctx.ellipse(x - r * 0.28, y - r * 0.3, r * 0.22, r * 0.14, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath(); ctx.arc(x + r * 0.32, y + r * 0.28, r * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function buildGrid(targetPop: number): (number | null)[][] {
  // How many bubbles: roughly (targetPop * 1.4) bubbles in grid
  const numRows = 7;
  const grid: (number | null)[][] = [];
  for (let r = 0; r < numRows + 4; r++) {
    const row: (number | null)[] = [];
    for (let c = 0; c < COLS; c++) {
      if (r < numRows) row.push(Math.floor(Math.random() * COLORS.length));
      else row.push(null);
    }
    grid.push(row);
  }
  return grid;
}

export default function BubbleGame() {
  const TICKETS = useGameTickets("bubble", RAW_TICKETS);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const rafRef = useRef(0);
  const audioRef = useRef(new AudioEngine());
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const lastSecRef = useRef(0);
  const timerBarRef = useRef<HTMLDivElement>(null);
  const startingRef = useRef(false);
  const brRef = useRef(22);

  const [phase, setPhase] = useState<Phase>("select");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [muted, setMuted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [balance, setBalance] = useState(START_BALANCE);
  const [comboDisplay, setComboDisplay] = useState(0);
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
    brRef.current = computeBubbleRadius(wrap.clientWidth);
  }, []);

  useEffect(() => { resize(); const ro = new ResizeObserver(resize); if (wrapRef.current) ro.observe(wrapRef.current); return () => ro.disconnect(); }, [resize]);

  const ticketRef = useRef<Ticket | null>(null);
  useEffect(() => { ticketRef.current = ticket; }, [ticket]);

  const finishGame = useCallback((finalScore: number, outcome: "win" | "time") => {
    const g = gameRef.current; if (!g || !g.running) return; g.running = false; startingRef.current = false;
    setBest(prev => { const n = Math.max(prev, finalScore); localStorage.setItem(BEST_KEY, String(n)); return n; });
    if (outcome === "win") { audioRef.current.goal(); const t = ticketRef.current; if (t) setBalance(prev => { const n = prev + t.prize; localStorage.setItem(BALANCE_KEY, String(n)); return n; }); setPhase("won"); }
    else { audioRef.current.gameOver(); setPhase("lost"); }
  }, []);

  const endRef = useRef(finishGame);
  useEffect(() => { endRef.current = finishGame; }, [finishGame]);

  const shootBubble = useCallback(() => {
    const g = gameRef.current; if (!g || g.projectile || !g.running) return;
    const { w, h } = sizeRef.current; const br = brRef.current;
    const cannonX = w / 2; const cannonY = h - 70;
    const angle = g.cannonAngle;
    const speed = BUBBLE_SPEED;
    const color = g.nextColor;
    g.nextColor = Math.floor(Math.random() * COLORS.length);
    g.projectile = { x: cannonX, y: cannonY, vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed, color };
    audioRef.current.shoot();
    void br;
  }, []);

  const processCollision = useCallback((g: GameState, projX: number, projY: number) => {
    const br = brRef.current; const { w } = sizeRef.current;
    // Find nearest grid cell
    let bestDist = Infinity; let bestR = 0; let bestC = 0;
    // Check in range of rows
    for (let r = 0; r < g.grid.length; r++) {
      for (let c = 0; c < COLS; c++) {
        if (g.grid[r][c] !== null) continue;
        const [bx, by] = getBubbleXY(c, r, br, w);
        const d = Math.hypot(projX - bx, projY - by);
        if (d < bestDist) { bestDist = d; bestR = r; bestC = c; }
      }
    }
    // Also check empty adjacents to existing bubbles
    for (let r = 0; r < g.grid.length; r++) {
      for (let c = 0; c < COLS; c++) {
        if (g.grid[r][c] === null) continue;
        for (const [nr, nc] of getNeighbors(r, c)) {
          if (nr < 0 || nr >= g.grid.length || nc < 0 || nc >= COLS) continue;
          if (g.grid[nr]?.[nc] !== null) continue;
          const [bx, by] = getBubbleXY(nc, nr, br, w);
          const d = Math.hypot(projX - bx, projY - by);
          if (d < bestDist) { bestDist = d; bestR = nr; bestC = nc; }
        }
      }
    }
    // Also check row 0 (ceiling snapping)
    for (let c = 0; c < COLS; c++) {
      if (g.grid[0][c] !== null) continue;
      const [bx, by] = getBubbleXY(c, 0, br, w);
      const d = Math.hypot(projX - bx, projY - by);
      if (d < bestDist) { bestDist = d; bestR = 0; bestC = c; }
    }

    // Expand grid if needed
    while (bestR >= g.grid.length) g.grid.push(Array(COLS).fill(null));
    g.grid[bestR][bestC] = g.projectile!.color;
    g.projectile = null;

    // Check cluster
    const color = g.grid[bestR][bestC]!;
    const cluster = bfsCluster(g.grid, bestR, bestC, color);
    if (cluster.length >= 3) {
      // Pop cluster
      for (const [r, c] of cluster) {
        const [bx, by] = getBubbleXY(c, r, br, w);
        g.grid[r][c] = null;
        // Spawn particles
        const ci = color;
        for (let p = 0; p < 10; p++) {
          const a = Math.random() * Math.PI * 2; const spd = 100 + Math.random() * 200;
          g.particles.push({ x: bx, y: by, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: 3 + Math.random() * 5, life: 0.8, max: 0.8, color: COLORS[ci] });
        }
      }
      g.score += cluster.length * 10 + (cluster.length >= 5 ? cluster.length * 5 : 0);
      setScore(g.score);
      g.combo++;
      if (g.combo > 1) { audioRef.current.combo(g.combo); setComboDisplay(g.combo); setTimeout(() => setComboDisplay(0), 1000); }
      audioRef.current.pop(cluster.length);
      g.comboT = 2.5;
      g.missedShots = 0;

      // Find and drop floating bubbles
      const floating = findFloatingBubbles(g.grid);
      for (const [r, c] of floating) {
        const [bx, by] = getBubbleXY(c, r, br, w);
        const ci = g.grid[r][c]!;
        g.grid[r][c] = null;
        g.score += 15;
        setScore(g.score);
        for (let p = 0; p < 8; p++) {
          const a = Math.random() * Math.PI * 2; const spd = 60 + Math.random() * 120;
          g.particles.push({ x: bx, y: by, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd + 200, r: 2 + Math.random() * 4, life: 0.7, max: 0.7, color: COLORS[ci] });
        }
        audioRef.current.drop();
      }

      if (g.score >= g.target) { endRef.current(g.score, "win"); return; }
    } else {
      g.combo = 0;
      g.missedShots++;
      if (g.missedShots >= 5) {
        // Add new row at top (shift everything down)
        g.missedShots = 0;
        const newRow: (number | null)[] = [];
        for (let c = 0; c < COLS; c++) newRow.push(Math.floor(Math.random() * COLORS.length));
        g.grid.unshift(newRow);
        // Check if any bubble in last rows (danger)
        for (let c = 0; c < COLS; c++) {
          const { h } = sizeRef.current;
          const [, by] = getBubbleXY(c, g.grid.length - 1, br, w);
          if (by > h - 120) { endRef.current(g.score, "time"); return; }
        }
      }
    }
    if (countBubbles(g.grid) === 0) { g.score += 100; setScore(g.score); endRef.current(g.score, "win"); }
  }, []);

  const loop = useCallback((time: number) => {
    const g = gameRef.current; const canvas = canvasRef.current; if (!g || !canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const { w, h, dpr } = sizeRef.current; const br = brRef.current;
    if (!g.lastTime) g.lastTime = time;
    const dt = Math.min((time - g.lastTime) / 1000, 0.05); g.lastTime = time;

    if (g.running) {
      g.timeLeft = Math.max(0, g.timeLeft - dt);
      const sec = Math.ceil(g.timeLeft);
      if (sec !== lastSecRef.current) { lastSecRef.current = sec; setTimeLeft(sec); if (sec <= 10 && sec > 0) audioRef.current.tick(sec <= 5); }
      const bar = timerBarRef.current; const ratio = g.timeLeft / g.timeMax;
      if (bar) { bar.style.width = `${ratio * 100}%`; bar.style.backgroundImage = ratio <= 0.25 ? "linear-gradient(to right,#e74c3c,#e67e22)" : "linear-gradient(to right,#9b59b6,#3498db)"; }
      if (g.timeLeft <= 0) { endRef.current(g.score, "time"); return; }
    }

    if (g.comboT > 0) g.comboT -= dt;

    // Update projectile
    if (g.projectile) {
      g.projectile.x += g.projectile.vx * dt;
      g.projectile.y += g.projectile.vy * dt;
      // Wall bounce
      if (g.projectile.x - br < 0) { g.projectile.x = br; g.projectile.vx = Math.abs(g.projectile.vx); audioRef.current.bounce(); }
      if (g.projectile.x + br > w) { g.projectile.x = w - br; g.projectile.vx = -Math.abs(g.projectile.vx); audioRef.current.bounce(); }
      // Top wall
      if (g.projectile.y - br < 45) { g.projectile.y = 45 + br; processCollision(g, g.projectile.x, g.projectile.y); }
      else {
        // Check collision with grid bubbles
        let hit = false;
        outer: for (let r = 0; r < g.grid.length; r++) {
          for (let c = 0; c < COLS; c++) {
            if (g.grid[r][c] === null) continue;
            const [bx, by] = getBubbleXY(c, r, br, w);
            if (Math.hypot(g.projectile.x - bx, g.projectile.y - by) < br * 1.85) { processCollision(g, g.projectile.x, g.projectile.y); hit = true; break outer; }
          }
        }
        void hit;
      }
    }

    // Update particles
    for (const p of g.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 350 * dt; }
    g.particles = g.particles.filter(p => p.life > 0);

    // ---- Render ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0d0021"); bg.addColorStop(0.5, "#160038"); bg.addColorStop(1, "#0a0018");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    // Star field
    for (let s = 0; s < 80; s++) {
      const sx = ((s * 137.5 + 50) % w);
      const sy = ((s * 211.3 + 30) % (h * 0.85));
      const ss = 0.5 + (s % 3) * 0.5;
      const sa = 0.4 + Math.sin(Date.now() * 0.001 + s) * 0.3;
      ctx.fillStyle = `rgba(255,255,255,${sa})`; ctx.beginPath(); ctx.arc(sx, sy, ss, 0, Math.PI * 2); ctx.fill();
    }

    // Ceiling bar
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, 50);
    ceilGrad.addColorStop(0, "#2d1b69"); ceilGrad.addColorStop(1, "rgba(45,27,105,0)");
    ctx.fillStyle = ceilGrad; ctx.fillRect(0, 0, w, 50);
    ctx.strokeStyle = "rgba(155,89,182,0.6)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 48); ctx.lineTo(w, 48); ctx.stroke();

    // Draw grid bubbles
    for (let r = 0; r < g.grid.length; r++) {
      for (let c = 0; c < COLS; c++) {
        const ci = g.grid[r][c];
        if (ci === null || ci === undefined) continue;
        const [bx, by] = getBubbleXY(c, r, br, w);
        if (by > h + br) continue;
        // Danger zone flicker
        const danger = by > h - 130;
        const alpha = danger ? 0.6 + Math.sin(Date.now() * 0.01) * 0.4 : 1;
        drawBubble(ctx, bx, by, br, ci, alpha);
      }
    }

    // Draw particles
    for (const p of g.particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Aim line
    const cannonX = w / 2; const cannonY = h - 70;
    if (g.aiming && !g.projectile) {
      let ax = cannonX, ay = cannonY;
      let vax = Math.sin(g.cannonAngle), vay = -Math.cos(g.cannonAngle);
      ctx.setLineDash([8, 10]);
      ctx.strokeStyle = `rgba(255,255,255,0.35)`; ctx.lineWidth = 2;
      for (let seg = 0; seg < 4; seg++) {
        // Ray march
        let tx = ax, ty = ay; let dist = 0;
        while (dist < 300) {
          tx += vax * 8; ty += vay * 8; dist += 8;
          if (tx - br < 0) { tx = br; vax = Math.abs(vax); }
          if (tx + br > w) { tx = w - br; vax = -Math.abs(vax); }
          if (ty < 50) break;
          // Check grid collision
          let hitGrid = false;
          for (let r = 0; r < g.grid.length && !hitGrid; r++) {
            for (let c = 0; c < COLS && !hitGrid; c++) {
              if (g.grid[r][c] === null) continue;
              const [bx2, by2] = getBubbleXY(c, r, br, w);
              if (Math.hypot(tx - bx2, ty - by2) < br * 1.9) hitGrid = true;
            }
          }
          if (hitGrid) break;
        }
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tx, ty); ctx.stroke();
        if (ty <= 50) break;
        ax = tx; ay = ty;
        if (tx <= br || tx >= w - br) continue;
        break;
      }
      ctx.setLineDash([]);
    }

    // Projectile
    if (g.projectile) drawBubble(ctx, g.projectile.x, g.projectile.y, br, g.projectile.color);

    // Cannon base
    const cannonLen = 44; const angle = g.cannonAngle;
    ctx.save(); ctx.translate(cannonX, cannonY);
    // Base circle
    const baseGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 30);
    baseGrad.addColorStop(0, "#4a2c8a"); baseGrad.addColorStop(1, "#1a0a3a");
    ctx.fillStyle = baseGrad; ctx.strokeStyle = "rgba(155,89,182,0.8)"; ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(155,89,182,0.5)"; ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    // Barrel
    ctx.rotate(angle);
    ctx.strokeStyle = "rgba(200,180,255,0.9)"; ctx.lineWidth = 10; ctx.lineCap = "round";
    ctx.shadowColor = "rgba(155,89,182,0.7)"; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, -cannonLen); ctx.stroke();
    ctx.shadowBlur = 0;
    // Next bubble preview inside barrel tip
    drawBubble(ctx, 0, 0, br * 0.7, g.nextColor);
    ctx.restore();

    // Danger zone line
    const dangerY = h - 120;
    ctx.strokeStyle = "rgba(231,76,60,0.25)"; ctx.lineWidth = 1; ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(0, dangerY); ctx.lineTo(w, dangerY); ctx.stroke();
    ctx.setLineDash([]);

    if (g.running || g.particles.length > 0) rafRef.current = requestAnimationFrame(loop);
  }, [processCollision]);

  const startLoop = useCallback(() => { cancelAnimationFrame(rafRef.current); if (gameRef.current) gameRef.current.lastTime = 0; rafRef.current = requestAnimationFrame(loop); }, [loop]);

  const playTicket = useCallback((t: Ticket) => {
    if (startingRef.current || t.price > balance) return; startingRef.current = true;
    setBalance(prev => { const n = prev - t.price; localStorage.setItem(BALANCE_KEY, String(n)); return n; });
    audioRef.current.start();
    setTicket(t);
    const grid = buildGrid(t.target);
    gameRef.current = {
      grid, rows: rowCount(0),
      projectile: null,
      nextColor: Math.floor(Math.random() * COLORS.length),
      cannonAngle: 0,
      particles: [], floaters: [],
      score: 0, target: t.target, timeLeft: t.time, timeMax: t.time,
      running: true, lastTime: 0,
      missedShots: 0, popTotal: 0,
      comboT: 0, combo: 0,
      aiming: false, aimX: 0, aimY: 0,
      dropRowT: 0,
    };
    lastSecRef.current = t.time; setScore(0); setTimeLeft(t.time);
    if (timerBarRef.current) timerBarRef.current.style.width = "100%";
    setPhase("playing"); startLoop();
  }, [balance, startLoop]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const g = gameRef.current; if (!g || !g.running) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    const { w, h } = sizeRef.current;
    const cannonX = w / 2; const cannonY = h - 70;
    const dx = x - cannonX; const dy = y - cannonY;
    const angle = Math.atan2(dx, -dy);
    g.cannonAngle = Math.max(-1.1, Math.min(1.1, angle));
    g.aiming = true; g.aimX = x; g.aimY = y;
  }, []);

  useEffect(() => { const audio = audioRef.current; return () => { cancelAnimationFrame(rafRef.current); audio.dispose(); }; }, []);
  const toggleMute = () => { audioRef.current.muted = !muted; setMuted(!muted); };

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{ background: "#0d0021" }}>
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3">
        <Link href="/games"><button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-purple-500/30 flex items-center justify-center text-purple-300 hover:text-white transition-colors"><ArrowLeft size={18} /></button></Link>
        <div className="flex flex-col items-center">
          <span className="text-[10px] tracking-[0.3em] text-purple-300/70 font-display uppercase">{phase === "playing" ? "POPPED" : "BUBBLE SHOOTER"}</span>
          <span data-testid="text-score" className="font-display font-black text-4xl text-purple-300 leading-none drop-shadow-[0_0_18px_rgba(155,89,182,0.9)]">{score}</span>
          {phase === "playing" && <span className="text-[9px] tracking-widest text-purple-300/60 font-display uppercase mt-0.5">GOAL {target}</span>}
        </div>
        <button onClick={toggleMute} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-purple-500/30 flex items-center justify-center text-purple-300">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
      </div>

      {comboDisplay > 1 && (
        <motion.div key={comboDisplay} initial={{ opacity: 1, y: 0, scale: 1 }} animate={{ opacity: 0, y: -60, scale: 1.4 }} transition={{ duration: 1 }} className="absolute top-1/3 left-1/2 -translate-x-1/2 z-30 font-display font-black text-2xl text-yellow-300 drop-shadow-[0_0_14px_rgba(255,220,0,0.9)] pointer-events-none">🔥 x{comboDisplay} COMBO!</motion.div>
      )}

      {phase === "playing" && (
        <div className="absolute top-[84px] left-1/2 -translate-x-1/2 z-30 w-[72%] flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-widest text-purple-300/70 font-display uppercase">Score</span><span data-testid="text-progress" className="text-[11px] font-mono font-bold tabular-nums text-white/90">{score} / {target}</span></div>
            <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden border border-purple-500/20"><div data-testid="bar-progress" className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-400 shadow-[0_0_12px_rgba(155,89,182,0.7)] transition-[width] duration-300" style={{ width: `${target > 0 ? Math.min(100, (score / target) * 100) : 0}%` }} /></div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-widest text-white/40 font-display uppercase">Time</span><span data-testid="text-timer" className={`text-[11px] font-mono font-bold tabular-nums ${timeLeft <= 10 ? "text-red-400" : "text-white/70"}`}>{timeLeft}s</span></div>
            <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} data-testid="bar-timer" className="h-full rounded-full" style={{ width: "100%" }} /></div>
          </div>
        </div>
      )}

      <div ref={wrapRef} className="flex-1 relative"
        onPointerMove={handlePointerMove}
        onPointerDown={(e) => { handlePointerMove(e); if (phase === "playing") { const g = gameRef.current; if (g) g.aiming = true; } }}
        onPointerUp={() => { const g = gameRef.current; if (g && g.running) { shootBubble(); g.aiming = false; } }}
        onPointerLeave={() => { const g = gameRef.current; if (g) g.aiming = false; }}>
        <canvas ref={canvasRef} className="absolute inset-0 touch-none" />
        {phase === "playing" && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-purple-300/40 font-display tracking-widest uppercase pointer-events-none">AIM & TAP to shoot</div>}
      </div>

      <AnimatePresence>{phase === "select" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col px-6 pt-16 pb-6 overflow-y-auto" style={{ background: "rgba(13,0,33,0.97)" }}>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <div className="text-4xl mb-2">🫧</div>
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-purple-400" /><span className="text-[11px] tracking-[0.4em] text-purple-400/60 uppercase">Bubble Shooter</span></div>
            <h1 className="font-display font-black text-2xl text-purple-300 mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/50 mb-4 max-w-[260px]">Aim the cannon and shoot to match 3+ bubbles of the same color. Pop chains for combo bonuses!</p>
            <div className="flex items-center gap-2 mb-5 px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30"><Coins size={14} className="text-purple-400" /><span data-testid="text-balance" className="text-sm font-mono font-bold text-purple-400">{balance.toLocaleString()} SKZ</span></div>
            <div className="w-full flex flex-col gap-2.5">
              {TICKETS.map(t => { const ok = t.price <= balance; return (
                <button key={t.id} disabled={!ok} onClick={() => ok && playTicket(t)} data-testid={`button-ticket-${t.id}`}
                  className={`w-full flex items-center justify-between rounded-2xl border p-3.5 transition-all ${ok ? "bg-purple-500/8 border-purple-500/30 hover:border-purple-400 active:scale-[0.98]" : "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed"}`}>
                  <div className="flex flex-col items-start"><span className="font-mono font-bold text-base text-purple-300">{t.name}</span><span className="text-[10px] text-white/40 font-mono uppercase mt-0.5">Score {t.target} · {t.time}s</span></div>
                  <div className="flex flex-col items-end"><span className="flex items-center gap-1 text-purple-400 font-mono font-bold text-sm"><Coins size={12} />{t.prize.toLocaleString()}</span><span className="text-[10px] text-white/40 font-mono uppercase mt-0.5">Entry {t.price}</span></div>
                </button>
              ); })}
            </div>
            <div className="flex items-center gap-1.5 mt-5 text-[11px] text-white/40"><Trophy size={11} className="text-purple-400" /><span data-testid="text-best" className="font-mono">Best {best}</span></div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}