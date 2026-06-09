import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Volume2, VolumeX, RotateCcw, Trophy, Coins, Flame } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GameOverOverlay, GameWonOverlay } from "@/components/game-end-overlay";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }

const BEST_KEY = "skz_dunk_best";
const BALANCE_KEY = "skz_balance";
const START_BALANCE = 1000;
const BALL_R = 16;
const GRAVITY = 1100;
const TWO_PI = Math.PI * 2;
const HOOP_R = 22; const HOOP_BOARD_W = 8; const HOOP_BOARD_H = 54;
const NET_SEGS = 8; const NET_DROP = 28;

const TICKETS: Ticket[] = [
  { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 8,  time: 35 },
  { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 12, time: 33 },
  { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 16, time: 31 },
  { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 20, time: 30 },
  { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 25, time: 28 },
];

interface Hoop { x: number; y: number; vx: number; vy: number; scored: boolean; scoreFlash: number; }
interface BallTrail { x: number; y: number; r: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number; }

interface GameState {
  ballX: number; ballY: number; ballVX: number; ballVY: number;
  ballLaunched: boolean; ballInHoop: boolean;
  dragStartX: number; dragStartY: number; isDragging: boolean;
  dragX: number; dragY: number;
  hoop: Hoop;
  trail: BallTrail[];
  particles: Particle[];
  score: number; target: number; timeLeft: number; timeMax: number;
  running: boolean; lastTime: number; flashT: number; goodFlashT: number;
  swishT: number; comboT: number;
  lastShotSwish: boolean; combo: number;
  onFire: boolean; fireT: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null; private master: GainNode | null = null; muted = false;
  private ensure() {
    if (!this.ctx) { const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.45; this.master.connect(this.ctx.destination); }
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
  swish() { this.noise(0.15, 0.35, 8000); this.tone(880, 0.2, "sine", 0.3, 0, 1320); this.tone(1100, 0.15, "triangle", 0.2, 0.05); }
  score_() { this.tone(523, 0.1, "triangle", 0.28); this.noise(0.08, 0.2, 5000); }
  launch() { this.tone(440, 0.08, "triangle", 0.25, 0, 660); }
  miss() { this.tone(261, 0.25, "sawtooth", 0.35); }
  onFire_() { [659, 880, 1047, 1319].forEach((f, i) => this.tone(f, 0.2, "triangle", 0.35, i * 0.04)); }
  start() { [330, 440, 554].forEach((f, i) => this.tone(f, 0.2, "triangle", 0.3, i * 0.07)); }
  goal() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.24, "triangle", 0.38, i * 0.07)); }
  gameOver() { [330, 261, 220, 196].forEach((f, i) => this.tone(f, 0.3, "sawtooth", 0.28, i * 0.12)); }
  tick(u = false) { this.tone(u ? 900 : 650, 0.07, "square", u ? 0.22 : 0.13); }
  dispose() { if (this.ctx) { void this.ctx.close(); this.ctx = null; this.master = null; } }
}

function spawnScoreParticles(g: GameState, x: number, y: number, fire: boolean) {
  const colors = fire ? ["#ff6b00", "#ff9d00", "#ffcc00", "#fff"] : ["#FFD700", "#FFA500", "#FF8C00", "#fff"];
  for (let i = 0; i < 22; i++) {
    const a = (Math.random() * 2 - 1) * Math.PI; const spd = 120 + Math.random() * 260;
    g.particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 140, life: 0.9, max: 0.9, color: colors[i % colors.length], r: 3 + Math.random() * 5 });
  }
}

function drawHoop(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, scored: boolean, scoreFlash: number, onFire: boolean, fireT: number) {
  ctx.save();
  // Backboard
  ctx.fillStyle = scored ? `rgba(255,180,0,${0.3 + scoreFlash * 0.5})` : "#e8e8e8";
  ctx.strokeStyle = "#ccc"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x + HOOP_R + 4, y - HOOP_BOARD_H / 2, HOOP_BOARD_W, HOOP_BOARD_H, 2); ctx.fill(); ctx.stroke();
  // Square on backboard
  ctx.strokeStyle = "rgba(255,100,0,0.7)"; ctx.lineWidth = 2;
  ctx.strokeRect(x + HOOP_R + 6, y - 14, 4, 28);

  // Rim
  const rimColor = onFire ? `hsl(${20 + Math.sin(fireT * 12) * 10},100%,${50 + Math.sin(fireT * 8) * 15}%)` : scored ? `rgba(255,160,0,${0.8 + scoreFlash * 0.2})` : "#e85e00";
  ctx.strokeStyle = rimColor; ctx.lineWidth = 4;
  ctx.shadowColor = onFire ? "#ff4400" : "#e85e00"; ctx.shadowBlur = onFire ? 18 + Math.sin(fireT * 8) * 8 : scored ? 14 : 6;
  // Left rim segment
  ctx.beginPath(); ctx.arc(x, y, HOOP_R, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
  // Right rim to board
  ctx.beginPath(); ctx.moveTo(x + HOOP_R - 1, y); ctx.lineTo(x + HOOP_R + 4, y); ctx.stroke();
  ctx.shadowBlur = 0;

  // Net
  const netAlpha = onFire ? 0.9 : 0.75;
  ctx.strokeStyle = `rgba(255,255,255,${netAlpha})`; ctx.lineWidth = 1.2;
  const netX = x - HOOP_R * 0.8; const netW = HOOP_R * 1.6;
  // Vertical lines
  for (let ns = 0; ns <= NET_SEGS; ns++) {
    const nx = netX + (ns / NET_SEGS) * netW;
    const sag = Math.sin(ns * Math.PI / NET_SEGS) * NET_DROP * 0.5;
    const twist = scored ? Math.sin(t * 12 + ns) * 4 * scoreFlash : 0;
    ctx.beginPath(); ctx.moveTo(nx, y); ctx.quadraticCurveTo(nx + twist, y + NET_DROP * 0.5 + sag, netX + netW * 0.5, y + NET_DROP + sag * 0.5); ctx.stroke();
  }
  // Horizontal net rows
  for (let nr = 1; nr <= 3; nr++) {
    const ny = y + NET_DROP * (nr / 3);
    const shrink = (nr / 3) * 0.35;
    ctx.beginPath(); ctx.moveTo(netX + netW * shrink * 0.5, ny); ctx.lineTo(netX + netW * (1 - shrink * 0.5), ny); ctx.stroke();
  }

  // Fire effect on rim
  if (onFire) {
    for (let f = 0; f < 6; f++) {
      const fa = (f / 6) * TWO_PI * 1.4 + Math.PI * 1.1;
      const fr = HOOP_R + 2;
      const fx = x + Math.cos(fa) * fr; const fy = y + Math.sin(fa) * fr;
      const fh = 10 + Math.sin(fireT * 8 + f) * 8;
      const fgrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fh);
      fgrad.addColorStop(0, "rgba(255,220,0,0.9)"); fgrad.addColorStop(0.5, "rgba(255,80,0,0.6)"); fgrad.addColorStop(1, "rgba(255,0,0,0)");
      ctx.fillStyle = fgrad; ctx.beginPath(); ctx.arc(fx, fy - fh * 0.3, fh * 0.6, 0, TWO_PI); ctx.fill();
    }
  }
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, rotation: number, onFire: boolean, fireT: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);

  // Fire aura
  if (onFire) {
    for (let f = 0; f < 8; f++) {
      const fa = (f / 8) * TWO_PI + fireT * 3;
      const fr = BALL_R + 6 + Math.sin(fireT * 7 + f) * 5;
      const fgrad = ctx.createRadialGradient(Math.cos(fa) * fr * 0.3, Math.sin(fa) * fr * 0.3, 0, 0, 0, fr);
      fgrad.addColorStop(0, "rgba(255,160,0,0.5)"); fgrad.addColorStop(0.5, "rgba(255,60,0,0.3)"); fgrad.addColorStop(1, "rgba(255,0,0,0)");
      ctx.fillStyle = fgrad; ctx.beginPath(); ctx.arc(0, 0, fr, 0, TWO_PI); ctx.fill();
    }
  }

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(0, BALL_R + 3, 14, 5, 0, 0, TWO_PI); ctx.fill();

  // Ball gradient
  const ballGrad = ctx.createRadialGradient(-BALL_R * 0.35, -BALL_R * 0.35, BALL_R * 0.05, 0, 0, BALL_R);
  if (onFire) {
    ballGrad.addColorStop(0, "#ffee88"); ballGrad.addColorStop(0.3, "#ff8800"); ballGrad.addColorStop(0.7, "#cc3300"); ballGrad.addColorStop(1, "#770000");
  } else {
    ballGrad.addColorStop(0, "#ff9a3c"); ballGrad.addColorStop(0.4, "#e65c00"); ballGrad.addColorStop(0.8, "#c04000"); ballGrad.addColorStop(1, "#7a2000");
  }
  ctx.fillStyle = ballGrad;
  ctx.shadowColor = onFire ? "rgba(255,120,0,0.8)" : "rgba(200,80,0,0.4)"; ctx.shadowBlur = onFire ? 20 : 8;
  ctx.beginPath(); ctx.arc(0, 0, BALL_R, 0, TWO_PI); ctx.fill(); ctx.shadowBlur = 0;

  // Basketball seams
  ctx.strokeStyle = `rgba(80,20,0,${onFire ? 0.5 : 0.7})`; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, BALL_R, 0, TWO_PI); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -BALL_R); ctx.bezierCurveTo(BALL_R * 0.6, -BALL_R * 0.3, BALL_R * 0.6, BALL_R * 0.3, 0, BALL_R); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -BALL_R); ctx.bezierCurveTo(-BALL_R * 0.6, -BALL_R * 0.3, -BALL_R * 0.6, BALL_R * 0.3, 0, BALL_R); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-BALL_R, 0); ctx.lineTo(BALL_R, 0); ctx.stroke();

  // Shine
  ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.ellipse(-BALL_R * 0.3, -BALL_R * 0.3, BALL_R * 0.28, BALL_R * 0.18, -0.5, 0, TWO_PI); ctx.fill();
  ctx.restore();
}

function drawAimLine(ctx: CanvasRenderingContext2D, ballX: number, ballY: number, dragX: number, dragY: number) {
  const dx = ballX - dragX; const dy = ballY - dragY;
  const power = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 120);
  const vx = dx * 4.5; const vy = dy * 4.5 - 150;
  const points: [number, number][] = [];
  for (let step = 0; step < 28; step++) {
    const t2 = step * 0.035;
    const px = ballX + vx * t2;
    const py = ballY + vy * t2 + 0.5 * GRAVITY * t2 * t2;
    points.push([px, py]);
    if (py > ballY + 400) break;
  }
  for (let i = 1; i < points.length; i++) {
    const a = (1 - i / points.length) * 0.7 * power;
    ctx.strokeStyle = `rgba(255,180,0,${a})`; ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 8]); ctx.lineDashOffset = -i * 3;
    ctx.beginPath(); ctx.moveTo(points[i - 1][0], points[i - 1][1]); ctx.lineTo(points[i][0], points[i][1]); ctx.stroke();
  }
  ctx.setLineDash([]);
}

export default function DunkGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const rafRef = useRef(0);
  const audioRef = useRef(new AudioEngine());
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const lastSecRef = useRef(0);
  const timerBarRef = useRef<HTMLDivElement>(null);
  const startingRef = useRef(false);
  const ballRotRef = useRef(0);
  const timeElapsedRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("select");
  const [lostReason, setLostReason] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [muted, setMuted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [balance, setBalance] = useState(START_BALANCE);
  const [swishDisplay, setSwishDisplay] = useState(false);
  const [onFireDisplay, setOnFireDisplay] = useState(false);
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

  const spawnNewHoop = useCallback((g: GameState, w: number, h: number) => {
    const difficulty = Math.min(1, g.score * 0.05);
    const maxSpd = 60 + difficulty * 180;
    g.hoop = {
      x: w * 0.6 + (Math.random() - 0.2) * w * 0.25,
      y: h * 0.25 + Math.random() * h * 0.3,
      vx: g.score >= 5 ? (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * maxSpd) : 0,
      vy: g.score >= 10 ? (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * maxSpd * 0.6) : 0,
      scored: false, scoreFlash: 0,
    };
  }, []);

  const resetBall = useCallback((g: GameState, w: number, h: number) => {
    g.ballX = w * 0.25; g.ballY = h * 0.72;
    g.ballVX = 0; g.ballVY = 0;
    g.ballLaunched = false; g.ballInHoop = false;
    g.isDragging = false;
  }, []);

  const finishGame = useCallback((finalScore: number, outcome: "win" | "time") => {
    const g = gameRef.current; if (!g || !g.running) return; g.running = false; startingRef.current = false;
    setBest(prev => { const n = Math.max(prev, finalScore); localStorage.setItem(BEST_KEY, String(n)); return n; });
    if (outcome === "win") { audioRef.current.goal(); const t = ticketRef.current; if (t) setBalance(prev => { const n = prev + t.prize; localStorage.setItem(BALANCE_KEY, String(n)); return n; }); setPhase("won"); }
    else { audioRef.current.gameOver(); setLostReason(outcome); setPhase("lost"); }
  }, []);

  const endRef = useRef(finishGame);
  useEffect(() => { endRef.current = finishGame; }, [finishGame]);

  const loop = useCallback((time: number) => {
    const g = gameRef.current; const canvas = canvasRef.current; if (!g || !canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const { w, h, dpr } = sizeRef.current;
    if (!g.lastTime) g.lastTime = time;
    const dt = Math.min((time - g.lastTime) / 1000, 0.05); g.lastTime = time;
    timeElapsedRef.current += dt;

    if (g.running) {
      g.timeLeft = Math.max(0, g.timeLeft - dt);
      const sec = Math.ceil(g.timeLeft);
      if (sec !== lastSecRef.current) { lastSecRef.current = sec; setTimeLeft(sec); if (sec <= 5 && sec > 0) audioRef.current.tick(sec <= 3); }
      const bar = timerBarRef.current; const ratio = g.timeLeft / g.timeMax;
      if (bar) { bar.style.width = `${ratio * 100}%`; bar.style.backgroundImage = ratio <= 0.28 ? "linear-gradient(to right,rgb(239,68,68),rgb(251,146,60))" : "linear-gradient(to right,#f7971e,#ffd200)"; }
      if (g.timeLeft <= 0) { endRef.current(g.score, "time"); return; }
    }

    if (g.swishT > 0) g.swishT -= dt;
    if (g.comboT > 0) g.comboT -= dt;
    if (g.fireT > 0) { g.fireT -= dt; if (g.fireT <= 0) { g.onFire = false; setOnFireDisplay(false); } }
    if (g.hoop.scoreFlash > 0) g.hoop.scoreFlash -= dt * 3;
    g.flashT = Math.max(0, g.flashT - dt);
    g.goodFlashT = Math.max(0, g.goodFlashT - dt);

    // Move hoop
    if (g.running) {
      g.hoop.x += g.hoop.vx * dt; g.hoop.y += g.hoop.vy * dt;
      if (g.hoop.x < HOOP_R + 50 || g.hoop.x > w - 20) g.hoop.vx *= -1;
      if (g.hoop.y < 60 || g.hoop.y > h * 0.65) g.hoop.vy *= -1;
    }

    // Ball physics
    if (g.ballLaunched && g.running) {
      g.ballVY += GRAVITY * dt;
      g.ballX += g.ballVX * dt; g.ballY += g.ballVY * dt;
      ballRotRef.current += g.ballVX * 0.04 * dt;

      // Trail
      g.trail.push({ x: g.ballX, y: g.ballY, r: BALL_R });
      if (g.trail.length > 14) g.trail.shift();

      // Hoop scoring
      if (!g.hoop.scored) {
        const dx = g.ballX - g.hoop.x; const dy = g.ballY - g.hoop.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Ball passes through the rim from above
        if (dist < HOOP_R * 1.15 && g.ballVY > 0 && g.ballY < g.hoop.y + 10) {
          g.hoop.scored = true; g.hoop.scoreFlash = 1;
          const swish = dist < HOOP_R * 0.55;
          const pts = swish ? (g.onFire ? 4 : 2) : (g.onFire ? 2 : 1);
          g.score += pts; setScore(g.score);
          g.lastShotSwish = swish;

          if (swish) {
            audioRef.current.swish(); setSwishDisplay(true); setTimeout(() => setSwishDisplay(false), 1200);
            g.combo++; g.comboT = 3;
            if (g.combo >= 3 && !g.onFire) { g.onFire = true; g.fireT = 8; audioRef.current.onFire_(); setOnFireDisplay(true); }
          } else {
            audioRef.current.score_(); g.combo = 0;
          }
          spawnScoreParticles(g, g.hoop.x, g.hoop.y, g.onFire);
          g.goodFlashT = 0.25;
          if (g.score >= g.target) { endRef.current(g.score, "win"); return; }

          setTimeout(() => {
            const g2 = gameRef.current; if (!g2) return;
            resetBall(g2, w, h); spawnNewHoop(g2, w, h);
          }, 350);
        }
      }

      // Miss detection (ball out of bounds or too low)
      if (g.ballY > h + 30 || g.ballX < -30 || g.ballX > w + 30) {
        if (!g.hoop.scored) { audioRef.current.miss(); g.combo = 0; g.flashT = 0.3; }
        resetBall(g, w, h);
      }
    }

    // Update particles
    for (const p of g.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; }
    g.particles = g.particles.filter(p => p.life > 0);

    // ---- Render ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Court background
    const courtGrad = ctx.createLinearGradient(0, 0, 0, h);
    courtGrad.addColorStop(0, "#0d0d1a");
    courtGrad.addColorStop(0.5, "#0a0515");
    courtGrad.addColorStop(1, "#050210");
    ctx.fillStyle = courtGrad; ctx.fillRect(0, 0, w, h);

    // Court floor glow
    const floorY = h * 0.78;
    const floorGrad = ctx.createLinearGradient(0, floorY - 10, 0, h);
    floorGrad.addColorStop(0, "#1a0a00"); floorGrad.addColorStop(1, "#0d0500");
    ctx.fillStyle = floorGrad; ctx.fillRect(0, floorY, w, h - floorY);
    // Floor reflection line
    ctx.strokeStyle = "rgba(255,120,0,0.2)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(w, floorY); ctx.stroke();

    // Court lines (faint)
    ctx.strokeStyle = "rgba(255,140,0,0.12)"; ctx.lineWidth = 2;
    // Center circle
    ctx.beginPath(); ctx.arc(w / 2, floorY + 5, 50, Math.PI, TWO_PI); ctx.stroke();
    // Three point arc
    ctx.beginPath(); ctx.arc(w * 0.25, floorY, w * 0.35, Math.PI, TWO_PI); ctx.stroke();

    // Ball trail
    for (let i = 0; i < g.trail.length; i++) {
      const tp = g.trail[i]; const a = (i / g.trail.length) * 0.35;
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = g.onFire ? "#ff6600" : "#ff8c00";
      ctx.beginPath(); ctx.arc(tp.x, tp.y, BALL_R * (i / g.trail.length) * 0.7, 0, TWO_PI); ctx.fill();
      ctx.restore();
    }

    // Aim line
    if (!g.ballLaunched && g.isDragging && g.running) drawAimLine(ctx, g.ballX, g.ballY, g.dragX, g.dragY);

    // Particles
    for (const p of g.particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TWO_PI); ctx.fill(); ctx.restore();
    }

    // Hoop
    drawHoop(ctx, g.hoop.x, g.hoop.y, timeElapsedRef.current, g.hoop.scored, g.hoop.scoreFlash, g.onFire, g.fireT);

    // Ball (if in play or resting)
    if (!g.ballInHoop) drawBall(ctx, g.ballX, g.ballY, ballRotRef.current, g.onFire, timeElapsedRef.current);

    // Drag indicator (launch zone)
    if (!g.ballLaunched && g.running) {
      ctx.strokeStyle = "rgba(255,180,0,0.15)"; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.arc(g.ballX, g.ballY, 60, 0, TWO_PI); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Flash overlays
    if (g.flashT > 0) { ctx.fillStyle = `rgba(200,50,50,${(g.flashT / 0.4) * 0.3})`; ctx.fillRect(0, 0, w, h); }
    if (g.goodFlashT > 0) { ctx.fillStyle = `rgba(255,200,0,${(g.goodFlashT / 0.25) * 0.15})`; ctx.fillRect(0, 0, w, h); }

    if (g.running || g.particles.length > 0) rafRef.current = requestAnimationFrame(loop);
  }, [resetBall, spawnNewHoop]);

  const startLoop = useCallback(() => { cancelAnimationFrame(rafRef.current); if (gameRef.current) gameRef.current.lastTime = 0; rafRef.current = requestAnimationFrame(loop); }, [loop]);

  const playTicket = useCallback((t: Ticket) => {
    if (startingRef.current || t.price > balance) return; startingRef.current = true;
    setBalance(prev => { const n = prev - t.price; localStorage.setItem(BALANCE_KEY, String(n)); return n; });
    audioRef.current.start();
    setTicket(t);
    const { w, h } = sizeRef.current;
    const g: GameState = {
      ballX: (w || 320) * 0.25, ballY: (h || 600) * 0.72, ballVX: 0, ballVY: 0,
      ballLaunched: false, ballInHoop: false,
      dragStartX: 0, dragStartY: 0, isDragging: false, dragX: 0, dragY: 0,
      hoop: { x: (w || 320) * 0.65, y: (h || 600) * 0.3, vx: 0, vy: 0, scored: false, scoreFlash: 0 },
      trail: [], particles: [],
      score: 0, target: t.target, timeLeft: t.time, timeMax: t.time,
      running: true, lastTime: 0, flashT: 0, goodFlashT: 0,
      swishT: 0, comboT: 0, lastShotSwish: false, combo: 0,
      onFire: false, fireT: 0,
    };
    gameRef.current = g;
    timeElapsedRef.current = 0; ballRotRef.current = 0;
    lastSecRef.current = t.time; setScore(0); setTimeLeft(t.time);
    if (timerBarRef.current) timerBarRef.current.style.width = "100%";
    setPhase("playing"); startLoop();
  }, [balance, startLoop]);

  useEffect(() => { const audio = audioRef.current; return () => { cancelAnimationFrame(rafRef.current); audio.dispose(); }; }, []);
  const toggleMute = () => { audioRef.current.muted = !muted; setMuted(!muted); };

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{ background: "#0d0d1a" }}>
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3">
        <Link href="/games"><button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-orange-400/30 flex items-center justify-center text-orange-300 hover:text-white transition-colors"><ArrowLeft size={18} /></button></Link>
        <div className="flex flex-col items-center">
          <span className="text-[10px] tracking-[0.3em] text-orange-300/70 font-display uppercase">{phase === "playing" ? "DUNKS" : "DUNK SHOT"}</span>
          <span data-testid="text-score" className="font-display font-black text-4xl text-orange-300 leading-none drop-shadow-[0_0_18px_rgba(255,140,0,0.7)]">{score}</span>
          {phase === "playing" && <span className="text-[9px] tracking-widest text-orange-300/60 font-display uppercase mt-0.5">GOAL {target}</span>}
        </div>
        <button onClick={toggleMute} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-orange-400/30 flex items-center justify-center text-orange-300">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
      </div>

      {swishDisplay && phase === "playing" && (
        <motion.div initial={{ opacity: 1, y: 0, scale: 1 }} animate={{ opacity: 0, y: -70, scale: 1.4 }} transition={{ duration: 1.1 }} className="absolute top-1/3 left-1/2 -translate-x-1/2 z-30 font-display font-black text-3xl text-yellow-300 drop-shadow-[0_0_16px_rgba(255,220,0,0.9)] pointer-events-none">🔥 SWISH!</motion.div>
      )}
      {onFireDisplay && phase === "playing" && (
        <div className="absolute top-[88px] left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-400/50">
          <Flame size={13} className="text-orange-400" /><span className="text-[11px] font-mono font-bold text-orange-300 tracking-wider">ON FIRE!</span>
        </div>
      )}

      {phase === "playing" && (
        <div className={`absolute z-30 w-[72%] left-1/2 -translate-x-1/2 flex flex-col gap-2.5 ${onFireDisplay ? "top-[120px]" : "top-[84px]"}`}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-widest text-orange-300/70 font-display uppercase">Dunks</span><span data-testid="text-progress" className="text-[11px] font-mono font-bold tabular-nums text-white/90">{score} / {target}</span></div>
            <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden border border-orange-400/20"><div data-testid="bar-progress" className="h-full rounded-full bg-gradient-to-r from-orange-400 to-yellow-400 shadow-[0_0_12px_rgba(255,150,0,0.6)] transition-[width] duration-300" style={{ width: `${target > 0 ? Math.min(100, (score / target) * 100) : 0}%` }} /></div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-widest text-white/40 font-display uppercase">Time</span><span data-testid="text-timer" className={`text-[11px] font-mono font-bold tabular-nums ${timeLeft <= 5 ? "text-red-400" : "text-white/70"}`}>{timeLeft}s</span></div>
            <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} data-testid="bar-timer" className="h-full rounded-full" style={{ width: "100%" }} /></div>
          </div>
        </div>
      )}

      <div ref={wrapRef} className="flex-1 relative"
        onPointerDown={(e) => {
          if (phase !== "playing") return;
          const g = gameRef.current; if (!g || !g.running || g.ballLaunched) return;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          g.isDragging = true; g.dragStartX = e.clientX - rect.left; g.dragStartY = e.clientY - rect.top;
          g.dragX = g.dragStartX; g.dragY = g.dragStartY;
        }}
        onPointerMove={(e) => {
          const g = gameRef.current; if (!g || !g.isDragging) return;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          g.dragX = e.clientX - rect.left; g.dragY = e.clientY - rect.top;
        }}
        onPointerUp={(e) => {
          const g = gameRef.current; if (!g || !g.isDragging || g.ballLaunched) return;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const upX = e.clientX - rect.left; const upY = e.clientY - rect.top;
          const dx = g.ballX - upX; const dy = g.ballY - upY;
          const power = Math.min(1.4, Math.sqrt(dx * dx + dy * dy) / 85);
          if (power > 0.05) {
            g.ballVX = dx * 4.5 * power; g.ballVY = dy * 4.5 * power - 150 * power;
            g.ballLaunched = true; g.isDragging = false;
            audioRef.current.launch();
          } else { g.isDragging = false; }
        }}
        onPointerLeave={() => { const g = gameRef.current; if (g) g.isDragging = false; }}>
        <canvas ref={canvasRef} className="absolute inset-0 touch-none" />
        {phase === "playing" && <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[11px] text-orange-300/40 font-display tracking-widest uppercase pointer-events-none">DRAG & RELEASE to shoot</div>}
      </div>

      <AnimatePresence>{phase === "select" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col px-6 pt-16 pb-6 overflow-y-auto" style={{ background: "rgba(13,13,26,0.97)" }}>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <div className="text-4xl mb-2">🏀</div>
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-orange-400" /><span className="text-[11px] tracking-[0.4em] text-orange-400/60 uppercase">Dunk Shot</span></div>
            <h1 className="font-display font-black text-2xl text-orange-300 mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/50 mb-4 max-w-[260px]">Drag & release to slingshot the ball. Swish (no rim) = ×2 points. 3 swishes in a row = ON FIRE mode!</p>
            <div className="flex items-center gap-2 mb-5 px-4 py-2 rounded-xl bg-orange-400/10 border border-orange-400/30"><Coins size={14} className="text-orange-400" /><span data-testid="text-balance" className="text-sm font-mono font-bold text-orange-400">{balance.toLocaleString()} SKZ</span></div>
            <div className="w-full flex flex-col gap-2.5">
              {TICKETS.map(t => { const ok = t.price <= balance; return (
                <button key={t.id} disabled={!ok} onClick={() => ok && playTicket(t)} data-testid={`button-ticket-${t.id}`}
                  className={`w-full flex items-center justify-between rounded-2xl border p-3.5 transition-all ${ok ? "bg-orange-400/8 border-orange-400/30 hover:border-orange-400 active:scale-[0.98]" : "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed"}`}>
                  <div className="flex flex-col items-start"><span className="font-mono font-bold text-base text-orange-300">{t.name}</span><span className="text-[10px] text-white/40 font-mono uppercase mt-0.5">Goal {t.target} · {t.time}s</span></div>
                  <div className="flex flex-col items-end"><span className="flex items-center gap-1 text-orange-400 font-mono font-bold text-sm"><Coins size={12} />{t.prize.toLocaleString()}</span><span className="text-[10px] text-white/40 font-mono uppercase mt-0.5">Entry {t.price}</span></div>
                </button>
              ); })}
            </div>
            <div className="flex items-center gap-1.5 mt-5 text-[11px] text-white/40"><Trophy size={11} className="text-orange-400" /><span data-testid="text-best" className="font-mono">Best {best}</span></div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
      <GameOverOverlay show={phase === "lost"} entryFee={ticket?.price ?? 0} score={score} target={target} balance={balance} lostReason={lostReason} onRetry={() => { setLostReason(null); setPhase("select"); }} />
      <GameWonOverlay show={phase === "won"} prize={ticket?.prize ?? 0} score={score} target={target} balance={balance} onRetry={() => setPhase("select")} />
    </div>
  );
}