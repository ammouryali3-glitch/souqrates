import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Volume2, VolumeX, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }

const BEST_KEY = "skz_sub_best";
const BALANCE_KEY = "skz_balance";
const START_BALANCE = 1000;

const TICKETS: Ticket[] = [
  { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 8,  time: 35 },
  { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 12, time: 33 },
  { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 16, time: 31 },
  { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 20, time: 30 },
  { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 25, time: 28 },
];

const GRAVITY = 900;
const LIFT = -620;
const SUB_W = 46; const SUB_H = 22;
const GAP_MIN = 130; const GAP_MAX = 190;
const SCROLL_SPEED_BASE = 175;
const TWO_PI = Math.PI * 2;

interface Obstacle { x: number; gapY: number; gapH: number; passed: boolean; }
interface Current { x: number; y: number; w: number; h: number; vy: number; life: number; max: number; }
interface Mine { x: number; y: number; vy: number; r: number; phase: number; }
interface Bubble { x: number; y: number; vy: number; r: number; life: number; max: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number; }

interface GameState {
  subY: number; subVY: number; subRot: number;
  scrollX: number; scrollSpeed: number;
  obstacles: Obstacle[]; nextObstacleX: number;
  currents: Current[]; nextCurrentX: number;
  mines: Mine[]; bubbles: Bubble[]; particles: Particle[];
  score: number; target: number; timeLeft: number; timeMax: number;
  running: boolean; lastTime: number; flashT: number;
  holding: boolean;
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
    const src = ctx.createBufferSource(); src.buffer = buf; const g = ctx.createGain(); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    const flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = cf;
    src.connect(flt); flt.connect(g); g.connect(this.master); src.start(t0);
  }
  thrust() { this.tone(80, 0.12, "sine", 0.2, 0, 120); this.noise(0.08, 0.08, 2000); }
  pass() { this.tone(523, 0.1, "triangle", 0.25); }
  crash() { this.noise(0.5, 0.7, 1000); this.tone(55, 0.4, "sawtooth", 0.4); }
  start() { [330, 415, 523].forEach((f, i) => this.tone(f, 0.18, "sine", 0.3, i * 0.07)); }
  goal() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.24, "triangle", 0.38, i * 0.07)); }
  gameOver() { [261, 220, 196, 165].forEach((f, i) => this.tone(f, 0.28, "sawtooth", 0.28, i * 0.11)); }
  tick(u = false) { this.tone(u ? 900 : 650, 0.07, "square", u ? 0.22 : 0.13); }
  dispose() { if (this.ctx) { void this.ctx.close(); this.ctx = null; this.master = null; } }
}

function drawCoral(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, top: boolean, seed: number) {
  const rng = (n: number) => Math.sin(seed * 127.1 + n * 311.7) * 0.5 + 0.5;
  ctx.save();
  // Base column
  const gradient = ctx.createLinearGradient(x - 18, 0, x + 18, 0);
  gradient.addColorStop(0, "#d4387a"); gradient.addColorStop(0.5, "#e95c8a"); gradient.addColorStop(1, "#b02d65");
  ctx.fillStyle = gradient;
  if (top) { ctx.fillRect(x - 20, y, 40, h); } else { ctx.fillRect(x - 20, y - h, 40, h); }
  // Coral tip bumps
  const tipY = top ? y + h : y - h;
  const bumpDir = top ? 1 : -1;
  for (let b = 0; b < 4; b++) {
    const bx = x - 18 + b * 12 + rng(b) * 4;
    const bh = 18 + rng(b + 1) * 22;
    const bw = 8 + rng(b + 2) * 8;
    ctx.fillStyle = `hsl(${320 + rng(b) * 40},75%,${50 + rng(b + 3) * 20}%)`;
    ctx.beginPath();
    ctx.ellipse(bx, tipY, bw * 0.5, bh, 0, 0, TWO_PI);
    void bumpDir;
    ctx.fill();
    // Polyp dots
    ctx.fillStyle = `rgba(255,200,220,0.7)`;
    for (let p = 0; p < 3; p++) { ctx.beginPath(); ctx.arc(bx + (rng(b * 3 + p) - 0.5) * bw, tipY + (rng(b * 4 + p) - 0.5) * bh * 0.6, 2 + rng(b * 5 + p) * 2, 0, TWO_PI); ctx.fill(); }
  }
  // Seaweed strands
  for (let s = 0; s < 2; s++) {
    const sx = x - 14 + s * 20 + rng(s) * 8;
    const sh = 25 + rng(s + 10) * 30;
    ctx.strokeStyle = `hsl(145,70%,${30 + rng(s + 20) * 30}%)`; ctx.lineWidth = 3;
    ctx.beginPath();
    const startY = top ? y : y - h;
    ctx.moveTo(sx, startY);
    ctx.bezierCurveTo(sx + 10, startY + sh * bumpDir * 0.3, sx - 8, startY + sh * bumpDir * 0.6, sx + 5, startY + sh * bumpDir);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSub(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, t: number, bubbles: boolean) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  // Body
  const bodyGrad = ctx.createLinearGradient(-SUB_W / 2, -SUB_H / 2, -SUB_W / 2, SUB_H / 2);
  bodyGrad.addColorStop(0, "#6ec6f5"); bodyGrad.addColorStop(0.5, "#2a8fd4"); bodyGrad.addColorStop(1, "#1a5fa0");
  ctx.fillStyle = bodyGrad;
  ctx.shadowColor = "rgba(100,200,255,0.5)"; ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.ellipse(0, 0, SUB_W / 2, SUB_H / 2, 0, 0, TWO_PI);
  ctx.fill(); ctx.shadowBlur = 0;
  // Conning tower
  ctx.fillStyle = "#1a5fa0";
  ctx.beginPath(); ctx.roundRect(-5, -SUB_H / 2 - 10, 14, 12, 3); ctx.fill();
  ctx.fillStyle = "#6ec6f5"; ctx.beginPath(); ctx.roundRect(-3, -SUB_H / 2 - 9, 4, 4, 1); ctx.fill(); // Periscope
  // Porthole
  ctx.fillStyle = "rgba(160,230,255,0.7)"; ctx.strokeStyle = "#1a5fa0"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(2, 0, 6, 0, TWO_PI); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.arc(4, -2, 2, 0, TWO_PI); ctx.fill();
  // Propeller
  const propSpin = t * 8;
  ctx.save(); ctx.translate(-SUB_W / 2 - 4, 0);
  for (let b = 0; b < 3; b++) {
    ctx.save(); ctx.rotate(propSpin + b * TWO_PI / 3);
    ctx.fillStyle = "#2a8fd4"; ctx.beginPath(); ctx.ellipse(0, -8, 3, 8, 0, 0, TWO_PI); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = "#1a5fa0"; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TWO_PI); ctx.fill();
  ctx.restore();
  // Thruster glow when holding
  if (bubbles) {
    ctx.shadowColor = "rgba(100,200,255,0.8)"; ctx.shadowBlur = 20;
    ctx.fillStyle = "rgba(150,230,255,0.6)";
    ctx.beginPath(); ctx.ellipse(-SUB_W / 2 - 2, 0, 8, 5, 0, 0, TWO_PI); ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawMine(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, phase: number) {
  ctx.save(); ctx.translate(x, y);
  const pulse = Math.sin(phase * 4) * 0.08;
  // Body
  ctx.shadowColor = "rgba(255,80,80,0.6)"; ctx.shadowBlur = 10 + Math.sin(phase * 4) * 5;
  ctx.fillStyle = "#cc2222";
  ctx.beginPath(); ctx.arc(0, 0, r * (1 + pulse), 0, TWO_PI); ctx.fill();
  ctx.shadowBlur = 0;
  // Spikes
  ctx.strokeStyle = "#ff4444"; ctx.lineWidth = 2;
  for (let s = 0; s < 8; s++) {
    const a = (s / 8) * TWO_PI; const sr = r + 8;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a) * sr, Math.sin(a) * sr); ctx.stroke();
    ctx.fillStyle = "#ff6666"; ctx.beginPath(); ctx.arc(Math.cos(a) * sr, Math.sin(a) * sr, 3, 0, TWO_PI); ctx.fill();
  }
  // Skull
  ctx.fillStyle = "#330000"; ctx.font = `bold ${r}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("💀", 0, 1);
  ctx.restore();
}

export default function SubmarineGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const rafRef = useRef(0);
  const audioRef = useRef(new AudioEngine());
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const lastSecRef = useRef(0);
  const timerBarRef = useRef<HTMLDivElement>(null);
  const startingRef = useRef(false);

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

  const ticketRef = useRef<Ticket | null>(null);
  useEffect(() => { ticketRef.current = ticket; }, [ticket]);

  const finishGame = useCallback((finalScore: number, outcome: "win" | "crash" | "time") => {
    const g = gameRef.current; if (!g || !g.running) return; g.running = false; startingRef.current = false;
    setBest(prev => { const n = Math.max(prev, finalScore); localStorage.setItem(BEST_KEY, String(n)); return n; });
    if (outcome === "win") { audioRef.current.goal(); const t = ticketRef.current; if (t) setBalance(prev => { const n = prev + t.prize; localStorage.setItem(BALANCE_KEY, String(n)); return n; }); setPhase("won"); }
    else { audioRef.current.gameOver(); setPhase("lost"); }
  }, []);

  const endRef = useRef(finishGame);
  useEffect(() => { endRef.current = finishGame; }, [finishGame]);

  const timeRef = useRef(0);

  const loop = useCallback((time: number) => {
    const g = gameRef.current; const canvas = canvasRef.current; if (!g || !canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const { w, h, dpr } = sizeRef.current;
    if (!g.lastTime) g.lastTime = time;
    const dt = Math.min((time - g.lastTime) / 1000, 0.05); g.lastTime = time;
    timeRef.current += dt;

    if (g.running) {
      g.timeLeft = Math.max(0, g.timeLeft - dt);
      const sec = Math.ceil(g.timeLeft);
      if (sec !== lastSecRef.current) { lastSecRef.current = sec; setTimeLeft(sec); if (sec <= 5 && sec > 0) audioRef.current.tick(sec <= 3); }
      const bar = timerBarRef.current; const ratio = g.timeLeft / g.timeMax;
      if (bar) { bar.style.width = `${ratio * 100}%`; bar.style.backgroundImage = ratio <= 0.28 ? "linear-gradient(to right,rgb(239,68,68),rgb(251,146,60))" : "linear-gradient(to right,#00c6ff,#0072ff)"; }
      if (g.timeLeft <= 0) { endRef.current(g.score, "time"); return; }
    }

    const diffFactor = 1 + g.score * 0.04;
    if (g.running) {
      // Physics
      const grav = g.holding ? LIFT * 0.5 + GRAVITY * 0.5 : GRAVITY;
      g.subVY += grav * dt;
      if (g.holding) { g.subVY += LIFT * dt; if (Math.random() < 0.3) audioRef.current.thrust(); }
      g.subVY = Math.max(-400, Math.min(550, g.subVY));
      g.subY = Math.max(SUB_H / 2 + 5, Math.min(h - SUB_H / 2 - 5, g.subY + g.subVY * dt));
      g.subRot = Math.max(-0.45, Math.min(0.45, g.subVY * 0.0006));

      const subX = w * 0.25;
      g.scrollX += g.scrollSpeed * diffFactor * dt;

      // Spawn obstacles
      if (g.scrollX + w * 0.8 > g.nextObstacleX) {
        const gapH = Math.max(GAP_MIN, GAP_MAX - g.score * 3);
        const gapY = 80 + Math.random() * (h - 160 - gapH);
        g.obstacles.push({ x: g.nextObstacleX, gapY, gapH, passed: false });
        g.nextObstacleX += 220 + Math.random() * 80;
      }

      // Spawn currents
      if (g.scrollX + w > g.nextCurrentX) {
        g.currents.push({ x: g.nextCurrentX - g.scrollX + w + 30, y: Math.random() * h * 0.7 + h * 0.1, w: 30 + Math.random() * 40, h: 80 + Math.random() * 80, vy: (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 150), life: 3.5, max: 3.5 });
        g.nextCurrentX += 340 + Math.random() * 200;
      }

      // Spawn mines
      if (g.score >= 3 && Math.random() < 0.008) {
        g.mines.push({ x: w + 30, y: 50 + Math.random() * (h - 100), vy: (Math.random() - 0.5) * 80, r: 14 + Math.random() * 8, phase: Math.random() * Math.PI * 2 });
      }

      // Obstacle collision & score
      for (const obs of g.obstacles) {
        obs.x -= g.scrollSpeed * diffFactor * dt;
        if (!obs.passed && obs.x + 20 < subX) { obs.passed = true; g.score++; setScore(g.score); audioRef.current.pass(); if (g.score >= g.target) { endRef.current(g.score, "win"); return; } }
        const obsCX = obs.x; const subCX = subX;
        if (Math.abs(obsCX - subCX) < SUB_W * 0.55) {
          const inTopCoral = g.subY - SUB_H * 0.45 < obs.gapY;
          const inBotCoral = g.subY + SUB_H * 0.45 > obs.gapY + obs.gapH;
          if (inTopCoral || inBotCoral) { spawnCrashParticles(g, subX, g.subY); audioRef.current.crash(); g.flashT = 0.7; endRef.current(g.score, "crash"); return; }
        }
      }

      // Mine collision
      for (const mine of g.mines) {
        mine.x -= g.scrollSpeed * diffFactor * dt * 0.4;
        mine.y += mine.vy * dt; mine.phase += dt;
        if (mine.y < mine.r || mine.y > h - mine.r) mine.vy *= -1;
        const dx = subX - mine.x; const dy = g.subY - mine.y;
        if (Math.sqrt(dx * dx + dy * dy) < SUB_W * 0.5 + mine.r - 4) { spawnCrashParticles(g, subX, g.subY); audioRef.current.crash(); g.flashT = 0.7; endRef.current(g.score, "crash"); return; }
      }

      // Currents effect
      for (const cur of g.currents) { cur.life -= dt; if (Math.abs(cur.x - subX) < cur.w * 0.5 && g.subY > cur.y && g.subY < cur.y + cur.h) { g.subVY += cur.vy * dt * 3.5; } }
      g.currents = g.currents.filter(c => c.life > 0 && c.x > -100);

      // Wall collision
      if (g.subY <= SUB_H / 2 + 4 || g.subY >= h - SUB_H / 2 - 4) { spawnCrashParticles(g, subX, g.subY); audioRef.current.crash(); g.flashT = 0.7; endRef.current(g.score, "crash"); return; }

      // Bubbles on thrust
      if (g.holding && Math.random() < 0.5) {
        g.bubbles.push({ x: subX - SUB_W * 0.45, y: g.subY + (Math.random() - 0.5) * SUB_H * 0.8, vy: -(80 + Math.random() * 100), r: 2 + Math.random() * 4, life: 1.2, max: 1.2 });
      }

      // Cleanup
      g.obstacles = g.obstacles.filter(o => o.x > -60);
      g.mines = g.mines.filter(m => m.x > -30);
      g.bubbles = g.bubbles.filter(b => b.life > 0);
      g.particles = g.particles.filter(p => p.life > 0);

      for (const b of g.bubbles) { b.life -= dt; b.y += b.vy * dt; b.x += Math.sin(b.life * 5) * 1.5; }
      for (const p of g.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    }
    g.flashT = Math.max(0, (g.flashT ?? 0) - dt);

    // ---- Render ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Ocean background gradient
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, h);
    oceanGrad.addColorStop(0, "#001a2e");
    oceanGrad.addColorStop(0.4, "#003355");
    oceanGrad.addColorStop(1, "#001520");
    ctx.fillStyle = oceanGrad; ctx.fillRect(0, 0, w, h);

    // Caustic light shafts
    const t3 = timeRef.current;
    for (let s = 0; s < 5; s++) {
      const shaftX = ((s * 137 + t3 * 40) % (w + 100)) - 50;
      const grad = ctx.createLinearGradient(shaftX - 30, 0, shaftX + 30, h);
      grad.addColorStop(0, `rgba(0,150,255,${0.04 + Math.sin(t3 * 0.8 + s) * 0.02})`);
      grad.addColorStop(1, "rgba(0,100,200,0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(shaftX - 50, 0); ctx.lineTo(shaftX + 50, 0); ctx.lineTo(shaftX + 80, h); ctx.lineTo(shaftX - 20, h); ctx.closePath(); ctx.fill();
    }

    // Seabed & surface
    ctx.fillStyle = "#001a2e";
    const seabedGrad = ctx.createLinearGradient(0, h - 35, 0, h);
    seabedGrad.addColorStop(0, "#0d2a1a"); seabedGrad.addColorStop(1, "#051409");
    ctx.fillStyle = seabedGrad; ctx.fillRect(0, h - 35, w, 35);
    // Surface shimmer
    ctx.fillStyle = "rgba(100,200,255,0.08)"; ctx.fillRect(0, 0, w, 18);
    for (let wx = 0; wx < w; wx += 25) {
      const wy = 9 + Math.sin(wx * 0.1 + t3 * 2) * 5;
      ctx.strokeStyle = "rgba(150,230,255,0.18)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx + 12, wy - 6, wx + 25, wy); ctx.stroke();
    }

    // Floating particles (plankton)
    for (let p = 0; p < 14; p++) {
      const px = ((p * 89 + t3 * 20) % (w + 20)) - 10;
      const py = ((p * 61 + t3 * 8) % (h - 50)) + 25;
      ctx.fillStyle = `rgba(100,230,200,${0.2 + Math.sin(t3 * 2 + p) * 0.1})`;
      ctx.beginPath(); ctx.arc(px, py, 1.5 + Math.sin(t3 + p) * 0.5, 0, TWO_PI); ctx.fill();
    }

    const subX = w * 0.25;

    // Obstacles (coral)
    for (const obs of g.obstacles) {
      const topH = obs.gapY;
      const botH = h - (obs.gapY + obs.gapH);
      if (topH > 0) drawCoral(ctx, obs.x, 0, topH, true, obs.x * 0.01);
      if (botH > 0) drawCoral(ctx, obs.x, h, botH, false, obs.x * 0.01 + 5);
    }

    // Currents
    for (const cur of g.currents) {
      const a = (cur.life / cur.max) * 0.25;
      const cgrad = ctx.createLinearGradient(cur.x - cur.w * 0.5, 0, cur.x + cur.w * 0.5, 0);
      cgrad.addColorStop(0, "rgba(0,200,255,0)"); cgrad.addColorStop(0.5, `rgba(0,200,255,${a})`); cgrad.addColorStop(1, "rgba(0,200,255,0)");
      ctx.fillStyle = cgrad; ctx.fillRect(cur.x - cur.w * 0.5, cur.y, cur.w, cur.h);
      // Current arrows
      ctx.strokeStyle = `rgba(150,230,255,${a * 2})`; ctx.lineWidth = 1.5;
      for (let r = 0; r < 3; r++) {
        const ay = cur.y + cur.h * (r / 3 + 0.15);
        const dir = cur.vy > 0 ? 1 : -1;
        ctx.beginPath(); ctx.moveTo(cur.x, ay); ctx.lineTo(cur.x, ay + dir * 18); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cur.x - 6, ay + dir * 10); ctx.lineTo(cur.x, ay + dir * 18); ctx.lineTo(cur.x + 6, ay + dir * 10); ctx.stroke();
      }
    }

    // Mines
    for (const mine of g.mines) drawMine(ctx, mine.x, mine.y, mine.r, mine.phase);

    // Bubbles
    for (const b of g.bubbles) {
      const a = Math.max(0, b.life / b.max);
      ctx.save(); ctx.globalAlpha = a * 0.7;
      ctx.strokeStyle = "rgba(200,240,255,0.8)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TWO_PI); ctx.stroke(); ctx.restore();
    }

    // Crash particles
    for (const p of g.particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TWO_PI); ctx.fill(); ctx.restore();
    }

    // Submarine
    drawSub(ctx, subX, g.subY, g.subRot, t3, g.holding);

    // Flash
    if ((g.flashT ?? 0) > 0) { ctx.fillStyle = `rgba(200,50,50,${(g.flashT / 0.7) * 0.4})`; ctx.fillRect(0, 0, w, h); }

    if (g.running || g.particles.length > 0) rafRef.current = requestAnimationFrame(loop);
  }, []);

  const startLoop = useCallback(() => { cancelAnimationFrame(rafRef.current); if (gameRef.current) gameRef.current.lastTime = 0; rafRef.current = requestAnimationFrame(loop); }, [loop]);

  const playTicket = useCallback((t: Ticket) => {
    if (startingRef.current || t.price > balance) return; startingRef.current = true;
    setBalance(prev => { const n = prev - t.price; localStorage.setItem(BALANCE_KEY, String(n)); return n; });
    audioRef.current.start();
    setTicket(t);
    const { h } = sizeRef.current;
    gameRef.current = {
      subY: (h || 500) * 0.5, subVY: 0, subRot: 0,
      scrollX: 0, scrollSpeed: SCROLL_SPEED_BASE,
      obstacles: [], nextObstacleX: 320,
      currents: [], nextCurrentX: 500,
      mines: [], bubbles: [], particles: [],
      score: 0, target: t.target, timeLeft: t.time, timeMax: t.time,
      running: true, lastTime: 0, flashT: 0, holding: false,
    };
    timeRef.current = 0;
    lastSecRef.current = t.time; setScore(0); setTimeLeft(t.time);
    if (timerBarRef.current) timerBarRef.current.style.width = "100%";
    setPhase("playing"); startLoop();
  }, [balance, startLoop]);

  useEffect(() => { const audio = audioRef.current; return () => { cancelAnimationFrame(rafRef.current); audio.dispose(); }; }, []);
  const refillBalance = useCallback(() => { setBalance(START_BALANCE); localStorage.setItem(BALANCE_KEY, String(START_BALANCE)); }, []);
  const toggleMute = () => { audioRef.current.muted = !muted; setMuted(!muted); };

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{ background: "#001a2e" }}>
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3">
        <Link href="/games"><button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-cyan-400/30 flex items-center justify-center text-cyan-300 hover:text-white transition-colors"><ArrowLeft size={18} /></button></Link>
        <div className="flex flex-col items-center">
          <span className="text-[10px] tracking-[0.3em] text-cyan-300/70 font-display uppercase">{phase === "playing" ? "CLEARED" : "FLAPPY SUB"}</span>
          <span data-testid="text-score" className="font-display font-black text-4xl text-cyan-300 leading-none drop-shadow-[0_0_18px_rgba(0,200,255,0.7)]">{score}</span>
          {phase === "playing" && <span className="text-[9px] tracking-widest text-cyan-300/60 font-display uppercase mt-0.5">GOAL {target}</span>}
        </div>
        <button onClick={toggleMute} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-cyan-400/30 flex items-center justify-center text-cyan-300">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
      </div>

      {phase === "playing" && (
        <div className="absolute top-[84px] left-1/2 -translate-x-1/2 z-30 w-[72%] flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-widest text-cyan-300/70 font-display uppercase">Cleared</span><span data-testid="text-progress" className="text-[11px] font-mono font-bold tabular-nums text-white/90">{score} / {target}</span></div>
            <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden border border-cyan-400/20"><div data-testid="bar-progress" className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 shadow-[0_0_12px_rgba(0,200,255,0.6)] transition-[width] duration-300" style={{ width: `${target > 0 ? Math.min(100, (score / target) * 100) : 0}%` }} /></div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-widest text-white/40 font-display uppercase">Time</span><span data-testid="text-timer" className={`text-[11px] font-mono font-bold tabular-nums ${timeLeft <= 5 ? "text-red-400" : "text-white/70"}`}>{timeLeft}s</span></div>
            <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} data-testid="bar-timer" className="h-full rounded-full" style={{ width: "100%" }} /></div>
          </div>
        </div>
      )}

      <div ref={wrapRef} className="flex-1 relative"
        onPointerDown={() => { if (gameRef.current && phase === "playing") { gameRef.current.holding = true; } }}
        onPointerUp={() => { if (gameRef.current) gameRef.current.holding = false; }}
        onPointerLeave={() => { if (gameRef.current) gameRef.current.holding = false; }}>
        <canvas ref={canvasRef} className="absolute inset-0 touch-none" />
        {phase === "playing" && <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[11px] text-cyan-300/40 font-display tracking-widest uppercase pointer-events-none">HOLD to ascend</div>}
      </div>

      <AnimatePresence>{phase === "select" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col px-6 pt-16 pb-6 overflow-y-auto" style={{ background: "rgba(0,20,40,0.96)" }}>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <div className="text-4xl mb-2">🚢</div>
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-cyan-400" /><span className="text-[11px] tracking-[0.4em] text-cyan-400/60 uppercase">Flappy Submarine</span></div>
            <h1 className="font-display font-black text-2xl text-cyan-300 mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/50 mb-4 max-w-[260px]">Hold to ascend through coral reefs. Watch out for moving mines and powerful ocean currents!</p>
            <div className="flex items-center gap-2 mb-5 px-4 py-2 rounded-xl bg-cyan-400/10 border border-cyan-400/30"><Coins size={14} className="text-cyan-400" /><span data-testid="text-balance" className="text-sm font-mono font-bold text-cyan-400">{balance.toLocaleString()} SKZ</span></div>
            <div className="w-full flex flex-col gap-2.5">
              {TICKETS.map(t => { const ok = t.price <= balance; return (
                <button key={t.id} disabled={!ok} onClick={() => ok && playTicket(t)} data-testid={`button-ticket-${t.id}`}
                  className={`w-full flex items-center justify-between rounded-2xl border p-3.5 transition-all ${ok ? "bg-cyan-400/8 border-cyan-400/30 hover:border-cyan-400 active:scale-[0.98]" : "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed"}`}>
                  <div className="flex flex-col items-start"><span className="font-mono font-bold text-base text-cyan-300">{t.name}</span><span className="text-[10px] text-white/40 font-mono uppercase mt-0.5">Clear {t.target} · {t.time}s</span></div>
                  <div className="flex flex-col items-end"><span className="flex items-center gap-1 text-cyan-400 font-mono font-bold text-sm"><Coins size={12} />{t.prize.toLocaleString()}</span><span className="text-[10px] text-white/40 font-mono uppercase mt-0.5">Entry {t.price}</span></div>
                </button>
              ); })}
            </div>
            <div className="flex items-center gap-1.5 mt-5 text-[11px] text-white/40"><Trophy size={11} className="text-cyan-400" /><span data-testid="text-best" className="font-mono">Best {best}</span></div>
            {balance < 30 ? (<button onClick={refillBalance} data-testid="button-refill" className="mt-5 w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-400 text-black font-mono font-bold text-sm tracking-widest shadow-[0_0_24px_rgba(0,200,255,0.5)] active:scale-95 transition-transform">🎁 GET 1,000 FREE CHIPS</button>) : (<button onClick={refillBalance} data-testid="button-refill" className="mt-3 text-[10px] text-white/25 hover:text-white/50 transition-colors underline underline-offset-2 font-mono">Low on chips? Get 1,000 free</button>)}
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      <AnimatePresence>{phase === "won" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-center justify-center px-8" style={{ background: "rgba(0,20,40,0.93)" }}>
          <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.4 }} className="w-full max-w-[300px] flex flex-col items-center text-center">
            <div className="text-5xl mb-3">🎯</div>
            <span data-testid="text-result" className="text-xs tracking-[0.4em] font-display uppercase mb-2 text-cyan-300">Mission Clear!</span>
            <div className="font-display font-black text-5xl text-cyan-300 mb-1">+{ticket?.prize.toLocaleString()}</div>
            <span className="text-sm text-white/50 mb-6 font-mono">SKZ prize claimed</span>
            <div className="w-full grid grid-cols-2 gap-3 mb-7">
              <div className="bg-cyan-400/8 border border-cyan-400/30 rounded-2xl p-3 flex flex-col items-center"><div className="text-white/40 text-[10px] font-mono uppercase mb-1">Cleared</div><span data-testid="text-final-score" className="font-mono font-bold text-xl text-cyan-300">{score}</span></div>
              <div className="bg-cyan-400/8 border border-cyan-400/30 rounded-2xl p-3 flex flex-col items-center"><div className="text-white/40 text-[10px] font-mono uppercase mb-1">Balance</div><span data-testid="text-balance-final" className="font-mono font-bold text-xl text-cyan-300">{balance.toLocaleString()}</span></div>
            </div>
            <button onClick={() => setPhase("select")} data-testid="button-replay" className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-mono font-bold tracking-widest flex items-center justify-center gap-2 mb-3 active:scale-95"><RotateCcw size={18} />PLAY AGAIN</button>
            <Link href="/games"><button data-testid="button-exit" className="text-sm text-cyan-300/40 hover:text-cyan-300 font-mono">← Back to Arena</button></Link>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      <AnimatePresence>{phase === "lost" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-center justify-center px-8" style={{ background: "rgba(0,20,40,0.93)" }}>
          <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.35 }} className="w-full max-w-[300px] flex flex-col items-center text-center">
            <div className="text-5xl mb-3">💥</div>
            <span data-testid="text-result" className="text-xs tracking-[0.4em] font-display uppercase mb-2 text-red-400">Destroyed!</span>
            <div data-testid="text-loss-amount" className="font-display font-black text-5xl text-red-400 mb-1">-{ticket?.price ?? 0}</div>
            <span className="text-sm text-white/50 mb-6 font-mono">SKZ entry lost</span>
            <div className="w-full grid grid-cols-2 gap-3 mb-7">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center"><div className="text-white/40 text-[10px] font-mono uppercase mb-1">Cleared</div><span data-testid="text-final-score" className="font-mono font-bold text-xl text-white">{score}/{target}</span></div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center"><div className="text-white/40 text-[10px] font-mono uppercase mb-1">Balance</div><span data-testid="text-balance-final" className="font-mono font-bold text-xl text-white">{balance.toLocaleString()}</span></div>
            </div>
            <button onClick={() => setPhase("select")} data-testid="button-replay" className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-mono font-bold tracking-widest flex items-center justify-center gap-2 mb-3 active:scale-95"><RotateCcw size={18} />TRY AGAIN</button>
            <Link href="/games"><button data-testid="button-exit" className="text-sm text-cyan-300/40 hover:text-cyan-300 font-mono">← Back to Arena</button></Link>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}

function spawnCrashParticles(g: GameState, x: number, y: number) {
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2; const spd = 80 + Math.random() * 200;
    g.particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 80, life: 0.8, max: 0.8, color: i % 3 === 0 ? "#00c6ff" : i % 3 === 1 ? "#ffffff" : "#ff4444", r: 3 + Math.random() * 4 });
  }
}
