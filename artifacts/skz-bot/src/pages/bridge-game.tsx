import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Volume2, VolumeX, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }

const BEST_KEY = "skz_bridge_best";
const BALANCE_KEY = "skz_balance";
const START_BALANCE = 1000;
const CHAR_W = 18; const CHAR_H = 36;
const PLATFORM_H = 24; const PLATFORM_MIN_W = 28; const PLATFORM_MAX_W = 120;
const STICK_GROW_RATE = 200; // px per second
const SCROLL_SPEED = 380;
const PLATFORM_Y_FRAC = 0.72;
const GAP_MIN = 100; const GAP_MAX = 240;
const TWO_PI = Math.PI * 2;

const TICKETS: Ticket[] = [
  { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 8,  time: 35 },
  { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 12, time: 33 },
  { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 16, time: 31 },
  { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 20, time: 30 },
  { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 25, time: 28 },
];

interface Platform { x: number; w: number; perfectX: number; hasPerfectDot: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number; shape: "circle" | "rect"; angle: number; va: number; }

type GameStep = "idle" | "growing" | "falling" | "walking" | "scrolling" | "falling_off";

interface GameState {
  platforms: Platform[];
  charX: number; charBaseX: number;
  stickLen: number; stickAngle: number; // 0 = vertical, PI/2 = horizontal
  step: GameStep;
  stepT: number;
  scrollOffset: number;
  particles: Particle[];
  score: number; target: number; timeLeft: number; timeMax: number;
  running: boolean; lastTime: number; flashT: number; goodFlashT: number;
  perfectT: number; perfectBonus: boolean;
  fallOffY: number;
  charY: number; charVY: number;
  blink: number;
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
  grow() { this.tone(220, 0.08, "sine", 0.12, 0, 260); }
  fall() { this.tone(440, 0.18, "sine", 0.28, 0, 220); }
  walk() { this.tone(330, 0.06, "triangle", 0.15); }
  perfect() { [659, 880, 1047, 1319].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.32, i * 0.04)); }
  land() { this.tone(392, 0.1, "triangle", 0.22, 0, 523); }
  fallOff() { this.noise(0.6, 0.5, 1000); this.tone(261, 0.5, "sawtooth", 0.35, 0, 130); }
  start() { [330, 440, 554].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.28, i * 0.06)); }
  goal() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.24, "triangle", 0.38, i * 0.07)); }
  gameOver() { [261, 220, 196, 165].forEach((f, i) => this.tone(f, 0.28, "sawtooth", 0.28, i * 0.11)); }
  tick(u = false) { this.tone(u ? 900 : 650, 0.07, "square", u ? 0.22 : 0.13); }
  dispose() { if (this.ctx) { void this.ctx.close(); this.ctx = null; this.master = null; } }
}

function genPlatform(x: number, score: number): Platform {
  const difficulty = Math.min(1, score * 0.04);
  const w = Math.max(PLATFORM_MIN_W, PLATFORM_MAX_W - difficulty * (PLATFORM_MAX_W - PLATFORM_MIN_W));
  return { x, w, perfectX: x + w / 2, hasPerfectDot: true };
}

function drawCharacter(ctx: CanvasRenderingContext2D, x: number, y: number, walking: boolean, t: number, blink: number) {
  ctx.save(); ctx.translate(x, y);
  const walkBob = walking ? Math.sin(t * 14) * 3 : 0;
  ctx.translate(0, walkBob);

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.beginPath(); ctx.ellipse(0, CHAR_H / 2 + 4, 10, 4, 0, 0, TWO_PI); ctx.fill();

  // Robe body (Zen style - black robe with sash)
  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath(); ctx.roundRect(-CHAR_W / 2, -CHAR_H * 0.3, CHAR_W, CHAR_H * 0.65, [3, 3, 8, 8]); ctx.fill();
  // Sash
  ctx.fillStyle = "#8b0000"; ctx.fillRect(-CHAR_W / 2, -CHAR_H * 0.05, CHAR_W, 5);
  // Sleeves
  if (walking) {
    const armSwing = Math.sin(t * 14) * 12;
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath(); ctx.roundRect(-CHAR_W * 0.55, -CHAR_H * 0.25 + armSwing, 8, 20, 4); ctx.fill();
    ctx.beginPath(); ctx.roundRect(CHAR_W * 0.55 - 8, -CHAR_H * 0.25 - armSwing, 8, 20, 4); ctx.fill();
  } else {
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath(); ctx.roundRect(-CHAR_W * 0.6, -CHAR_H * 0.2, 8, 18, 4); ctx.fill();
    ctx.beginPath(); ctx.roundRect(CHAR_W * 0.6 - 8, -CHAR_H * 0.2, 8, 18, 4); ctx.fill();
  }
  // Legs (walking animation)
  if (walking) {
    const legSwing = Math.sin(t * 14) * 7;
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath(); ctx.roundRect(-7, CHAR_H * 0.3 + legSwing, 6, 14, 3); ctx.fill();
    ctx.beginPath(); ctx.roundRect(1, CHAR_H * 0.3 - legSwing, 6, 14, 3); ctx.fill();
  }
  // Head
  const headGrad = ctx.createRadialGradient(0, -CHAR_H * 0.52, 1, 0, -CHAR_H * 0.5, 11);
  headGrad.addColorStop(0, "#f5d5a8"); headGrad.addColorStop(1, "#d4a06a");
  ctx.fillStyle = headGrad; ctx.shadowColor = "rgba(0,0,0,0.2)"; ctx.shadowBlur = 4;
  ctx.beginPath(); ctx.ellipse(0, -CHAR_H * 0.5, 9.5, 11, 0, 0, TWO_PI); ctx.fill(); ctx.shadowBlur = 0;
  // Topknot
  ctx.fillStyle = "#2a1a00"; ctx.beginPath(); ctx.ellipse(0, -CHAR_H * 0.63, 5, 7, 0, 0, TWO_PI); ctx.fill();
  // Eyes
  if (blink > 0) {
    ctx.fillStyle = "#2a1a00"; ctx.fillRect(-5, -CHAR_H * 0.52, 3, 1);
    ctx.fillStyle = "#2a1a00"; ctx.fillRect(2, -CHAR_H * 0.52, 3, 1);
  } else {
    ctx.fillStyle = "#2a1a00"; ctx.beginPath(); ctx.arc(-4, -CHAR_H * 0.52, 2, 0, TWO_PI); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -CHAR_H * 0.52, 2, 0, TWO_PI); ctx.fill();
  }
  // Mouth (slight smile)
  ctx.strokeStyle = "#2a1a00"; ctx.lineWidth = 1.2; ctx.beginPath();
  ctx.arc(0, -CHAR_H * 0.44, 3, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
}

function drawStick(ctx: CanvasRenderingContext2D, baseX: number, baseY: number, len: number, angle: number) {
  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.rotate(angle - Math.PI / 2); // angle 0 = straight up
  // Stick shadow
  ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(3, 3); ctx.lineTo(3, len); ctx.stroke();
  // Stick gradient
  const stickGrad = ctx.createLinearGradient(0, 0, 0, len);
  stickGrad.addColorStop(0, "#8b4513"); stickGrad.addColorStop(1, "#5c2e00");
  ctx.strokeStyle = stickGrad; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, len); ctx.stroke();
  // Grain lines
  ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.lineWidth = 1;
  for (let g = 0; g < len; g += 12) { ctx.beginPath(); ctx.moveTo(-2, g); ctx.lineTo(2, g); ctx.stroke(); }
  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, scrollOffset: number, t: number) {
  // Zen sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#e8e0d5"); sky.addColorStop(0.6, "#f5f0e8"); sky.addColorStop(1, "#d4cfc8");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

  // Mountains (far, parallax)
  ctx.save(); ctx.translate(-scrollOffset * 0.05, 0);
  for (let m = 0; m < 5; m++) {
    const mx = m * w * 0.28 - 40;
    const mh = h * 0.22 + m * 18;
    ctx.fillStyle = `rgba(140,130,120,${0.28 - m * 0.03})`;
    ctx.beginPath(); ctx.moveTo(mx, h * 0.55); ctx.lineTo(mx + w * 0.18, h * 0.55 - mh); ctx.lineTo(mx + w * 0.36, h * 0.55); ctx.closePath(); ctx.fill();
    // Snow caps
    ctx.fillStyle = "rgba(245,240,235,0.7)";
    ctx.beginPath(); ctx.moveTo(mx + w * 0.18, h * 0.55 - mh); ctx.lineTo(mx + w * 0.155, h * 0.55 - mh + mh * 0.22); ctx.lineTo(mx + w * 0.205, h * 0.55 - mh + mh * 0.22); ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // Cherry blossom trees (mid layer)
  ctx.save(); ctx.translate(-scrollOffset * 0.18, 0);
  for (let tr = 0; tr < 7; tr++) {
    const tx = (tr * 180 + 30) % (w * 1.5) - 60;
    const ty = h * 0.56;
    // Trunk
    ctx.strokeStyle = "#5c3a1e"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty - 50); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx, ty - 30); ctx.lineTo(tx + 20, ty - 55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx, ty - 30); ctx.lineTo(tx - 18, ty - 52); ctx.stroke();
    // Blossoms
    const colors = ["rgba(255,182,193,0.7)", "rgba(255,160,180,0.6)", "rgba(255,200,210,0.5)"];
    const sway = Math.sin(t * 0.8 + tr) * 3;
    for (let b = 0; b < 3; b++) {
      ctx.fillStyle = colors[b];
      ctx.beginPath(); ctx.arc(tx + sway + [-12, 8, -2][b], ty - [55, 58, 68][b], [18, 16, 20][b], 0, TWO_PI); ctx.fill();
    }
    // Falling petals
    for (let p = 0; p < 3; p++) {
      const pf = (t * 0.4 + tr * 0.3 + p * 0.7) % 1;
      const px = tx + Math.sin(pf * 8 + p) * 25;
      const py = ty - 60 + pf * 80;
      ctx.fillStyle = "rgba(255,180,190,0.6)";
      ctx.save(); ctx.translate(px, py); ctx.rotate(pf * 4 + p); ctx.beginPath(); ctx.ellipse(0, 0, 4, 2.5, 0, 0, TWO_PI); ctx.fill(); ctx.restore();
    }
  }
  ctx.restore();

  // Ground texture
  const groundGrad = ctx.createLinearGradient(0, h * 0.72, 0, h);
  groundGrad.addColorStop(0, "#8b7355"); groundGrad.addColorStop(0.3, "#7a6245"); groundGrad.addColorStop(1, "#4a3825");
  ctx.fillStyle = groundGrad; ctx.fillRect(0, h * 0.72, w, h - h * 0.72);
  // Ground highlight
  ctx.fillStyle = "rgba(200,180,140,0.3)"; ctx.fillRect(0, h * 0.72, w, 4);
  // Grass tufts (near layer)
  ctx.save(); ctx.translate(-(scrollOffset * 0.6) % w, 0);
  for (let g = 0; g < 20; g++) {
    const gx = g * (w / 9 + 14); const gy = h * 0.72;
    ctx.strokeStyle = `rgba(80,110,50,${0.4 + Math.sin(g * 2) * 0.15})`; ctx.lineWidth = 1.5;
    for (let s = 0; s < 3; s++) {
      const sw = Math.sin(t * 1.5 + g * 0.5 + s) * 4;
      ctx.beginPath(); ctx.moveTo(gx + s * 4, gy); ctx.quadraticCurveTo(gx + s * 4 + sw, gy - 12, gx + s * 4 + sw * 0.5, gy - 18); ctx.stroke();
    }
  }
  ctx.restore();

  // Lanterns
  ctx.save(); ctx.translate(-(scrollOffset * 0.35) % (w + 100), 0);
  for (let l = 0; l < 4; l++) {
    const lx = l * 200 + 80; const ly = h * 0.25;
    ctx.strokeStyle = "rgba(120,100,60,0.4)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(lx, ly - 20); ctx.lineTo(lx, ly); ctx.stroke();
    ctx.fillStyle = `rgba(255,160,0,${0.7 + Math.sin(t * 2 + l) * 0.15})`;
    ctx.shadowColor = "rgba(255,120,0,0.5)"; ctx.shadowBlur = 12 + Math.sin(t * 2 + l) * 5;
    ctx.beginPath(); ctx.roundRect(lx - 12, ly, 24, 32, [3, 3, 12, 12]); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(120,80,0,0.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(lx - 12, ly, 24, 32, [3, 3, 12, 12]); ctx.stroke();
    // Tassel
    ctx.strokeStyle = "rgba(180,20,20,0.6)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(lx, ly + 32); ctx.lineTo(lx, ly + 46); ctx.stroke();
  }
  ctx.restore();
}

export default function BridgeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const rafRef = useRef(0);
  const audioRef = useRef(new AudioEngine());
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const lastSecRef = useRef(0);
  const timerBarRef = useRef<HTMLDivElement>(null);
  const startingRef = useRef(false);
  const holdingRef = useRef(false);
  const timeRef = useRef(0);
  const growSoundTimer = useRef(0);

  const [phase, setPhase] = useState<Phase>("select");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [muted, setMuted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [balance, setBalance] = useState(START_BALANCE);
  const [perfectDisplay, setPerfectDisplay] = useState(false);
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

  const finishGame = useCallback((finalScore: number, outcome: "win" | "time") => {
    const g = gameRef.current; if (!g || !g.running) return; g.running = false; startingRef.current = false;
    holdingRef.current = false;
    setBest(prev => { const n = Math.max(prev, finalScore); localStorage.setItem(BEST_KEY, String(n)); return n; });
    if (outcome === "win") { audioRef.current.goal(); const t = ticketRef.current; if (t) setBalance(prev => { const n = prev + t.prize; localStorage.setItem(BALANCE_KEY, String(n)); return n; }); setPhase("won"); }
    else { audioRef.current.gameOver(); setPhase("lost"); }
  }, []);

  const endRef = useRef(finishGame);
  useEffect(() => { endRef.current = finishGame; }, [finishGame]);

  const loop = useCallback((time: number) => {
    const g = gameRef.current; const canvas = canvasRef.current; if (!g || !canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const { w, h, dpr } = sizeRef.current;
    if (!g.lastTime) g.lastTime = time;
    const dt = Math.min((time - g.lastTime) / 1000, 0.05); g.lastTime = time;
    timeRef.current += dt;
    g.blink = Math.max(0, g.blink - dt);

    if (g.running) {
      g.timeLeft = Math.max(0, g.timeLeft - dt);
      const sec = Math.ceil(g.timeLeft);
      if (sec !== lastSecRef.current) { lastSecRef.current = sec; setTimeLeft(sec); if (sec <= 5 && sec > 0) audioRef.current.tick(sec <= 3); }
      const bar = timerBarRef.current; const ratio = g.timeLeft / g.timeMax;
      if (bar) { bar.style.width = `${ratio * 100}%`; bar.style.backgroundImage = ratio <= 0.28 ? "linear-gradient(to right,rgb(239,68,68),rgb(251,146,60))" : "linear-gradient(to right,#8b4513,#d4af37)"; }
      if (g.timeLeft <= 0) { endRef.current(g.score, "time"); return; }
    }

    const platY = h * PLATFORM_Y_FRAC;
    const currentPlat = g.platforms[0];
    const nextPlat = g.platforms[1];

    // State machine
    switch (g.step) {
      case "idle":
        // Wait for press
        break;

      case "growing":
        g.stickLen += STICK_GROW_RATE * dt;
        growSoundTimer.current -= dt;
        if (growSoundTimer.current <= 0) { audioRef.current.grow(); growSoundTimer.current = 0.14; }
        if (!holdingRef.current) {
          // Release: fall the stick
          g.step = "falling"; g.stepT = 0;
          audioRef.current.fall();
        }
        break;

      case "falling":
        g.stepT += dt;
        g.stickAngle = Math.min(Math.PI / 2, (g.stepT / 0.38) * Math.PI / 2);
        if (g.stickAngle >= Math.PI / 2) {
          // Check if stick lands on next platform
          const stickEnd = currentPlat.x + currentPlat.w + g.stickLen;
          const nextX = nextPlat.x; const nextRight = nextPlat.x + nextPlat.w;
          if (stickEnd >= nextX && stickEnd <= nextRight) {
            // Success! Check perfect center
            const perfect = Math.abs(stickEnd - nextPlat.perfectX) < 10;
            if (perfect) {
              g.perfectBonus = true; g.perfectT = 1.5;
              audioRef.current.perfect(); setPerfectDisplay(true); setTimeout(() => setPerfectDisplay(false), 1300);
              // Double score for perfect
              g.score++; g.score++;
            } else {
              g.perfectBonus = false;
            }
            g.step = "walking"; g.stepT = 0;
            g.score++; setScore(g.score);
            audioRef.current.land();
            g.goodFlashT = 0.3;
            if (g.score >= g.target) { endRef.current(g.score, "win"); return; }
          } else {
            // Fall off!
            g.step = "falling_off"; g.stepT = 0;
            g.charVY = 0; g.fallOffY = g.charY;
            audioRef.current.fallOff();
            g.flashT = 0.8;
            g.blink = 0.5;
            // Spawn particles
            for (let i = 0; i < 18; i++) {
              const a = Math.random() * TWO_PI; const spd = 80 + Math.random() * 200;
              g.particles.push({ x: g.charX, y: platY, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 150, life: 1, max: 1, color: ["#d4af37","#8b0000","#f5f0e8","#8b4513"][i % 4], r: 3 + Math.random() * 5, shape: Math.random() < 0.5 ? "circle" : "rect", angle: Math.random() * TWO_PI, va: (Math.random() - 0.5) * 8 });
            }
          }
        }
        break;

      case "walking": {
        g.stepT += dt;
        const walkDist = currentPlat.w + g.stickLen;
        const walkTime = walkDist / SCROLL_SPEED;
        const progress = Math.min(1, g.stepT / walkTime);
        g.charX = currentPlat.x + currentPlat.w / 2 + (nextPlat.x + nextPlat.w / 2 - currentPlat.x - currentPlat.w / 2) * easeInOut(progress) - g.scrollOffset + 30;
        if (Math.floor(g.stepT * 8) % 2 === 0) audioRef.current.walk();
        if (progress >= 1) {
          // Start scrolling to center next platform
          g.step = "scrolling"; g.stepT = 0;
        }
        break;
      }

      case "scrolling": {
        g.stepT += dt;
        const scrollTime = 0.55;
        const targetOffset = g.scrollOffset + (nextPlat.x - currentPlat.x - w * 0.18);
        g.scrollOffset += (targetOffset - g.scrollOffset) * Math.min(1, dt * 6);
        g.charX = nextPlat.x + nextPlat.w / 2 - g.scrollOffset + 30;
        if (g.stepT > scrollTime || Math.abs(g.scrollOffset - targetOffset) < 2) {
          // Remove old platform, add new
          g.platforms.shift();
          const lastP = g.platforms[g.platforms.length - 1];
          const gap = GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN) * Math.max(0.3, 1 - g.score * 0.04);
          g.platforms.push(genPlatform(lastP.x + lastP.w + gap, g.score));
          g.stickLen = 0; g.stickAngle = 0;
          g.step = "idle"; g.stepT = 0;
          g.charX = g.platforms[0].x + g.platforms[0].w / 2 - g.scrollOffset + 30;
        }
        break;
      }

      case "falling_off":
        g.stepT += dt;
        g.charVY += 1200 * dt;
        g.charY += g.charVY * dt;
        g.charX += -50 * dt;
        if (g.charY > h + 80) {
          // Respawn after short delay
          endRef.current(g.score, "time");
          return;
        }
        break;
    }

    if (g.perfectT > 0) g.perfectT -= dt;
    g.flashT = Math.max(0, g.flashT - dt);
    g.goodFlashT = Math.max(0, g.goodFlashT - dt);

    // Particles
    for (const p of g.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; p.angle += p.va * dt; }
    g.particles = g.particles.filter(p => p.life > 0);

    // ---- Render ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawBackground(ctx, w, h, g.scrollOffset, timeRef.current);

    // Platforms
    for (const plat of g.platforms) {
      const rx = plat.x - g.scrollOffset;
      if (rx > w + 50 || rx + plat.w < -50) continue;

      // Platform shadow
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath(); ctx.roundRect(rx + 4, platY + PLATFORM_H + 3, plat.w, 8, [0, 0, 4, 4]); ctx.fill();

      // Platform gradient
      const platGrad = ctx.createLinearGradient(rx, platY, rx, platY + PLATFORM_H);
      platGrad.addColorStop(0, "#d4af37"); platGrad.addColorStop(0.4, "#b8860b"); platGrad.addColorStop(1, "#8b6914");
      ctx.fillStyle = platGrad;
      ctx.shadowColor = "rgba(212,175,55,0.3)"; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.roundRect(rx, platY, plat.w, PLATFORM_H, [4, 4, 2, 2]); ctx.fill();
      ctx.shadowBlur = 0;

      // Inlay pattern
      ctx.strokeStyle = "rgba(255,220,80,0.35)"; ctx.lineWidth = 1;
      ctx.strokeRect(rx + 3, platY + 3, plat.w - 6, PLATFORM_H - 6);
      // Dragon scale pattern
      for (let sp = 4; sp < plat.w - 4; sp += 12) {
        ctx.fillStyle = "rgba(255,200,50,0.18)";
        ctx.beginPath(); ctx.arc(rx + sp, platY + PLATFORM_H / 2, 4, Math.PI, TWO_PI); ctx.fill();
      }

      // Perfect center dot
      if (plat.hasPerfectDot) {
        const dotX = rx + plat.w / 2;
        const dotGlow = (g.perfectT > 0 && g.platforms[0] !== plat) ? Math.sin(timeRef.current * 8) * 0.4 + 0.6 : 0.85;
        ctx.shadowColor = "rgba(220,40,40,0.8)"; ctx.shadowBlur = 8;
        ctx.fillStyle = `rgba(220,40,40,${dotGlow})`;
        ctx.beginPath(); ctx.arc(dotX, platY + PLATFORM_H / 2, 5, 0, TWO_PI); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,180,180,0.9)"; ctx.beginPath(); ctx.arc(dotX - 1.5, platY + PLATFORM_H / 2 - 1.5, 1.5, 0, TWO_PI); ctx.fill();
      }
    }

    // Stick
    const stickBaseX = g.platforms[0].x + g.platforms[0].w - g.scrollOffset;
    if (g.step !== "falling_off" && g.stickLen > 0) {
      drawStick(ctx, stickBaseX, platY, g.stickLen, g.stickAngle);
    }

    // Particles
    for (const p of g.particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = p.color;
      if (p.shape === "rect") {
        ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TWO_PI); ctx.fill();
      }
      ctx.restore();
    }

    // Character
    const walking = g.step === "walking";
    const charScreenX = g.step === "falling_off" ? g.charX : g.charX;
    const charScreenY = g.step === "falling_off" ? g.charY - CHAR_H / 2 : platY - CHAR_H / 2;
    drawCharacter(ctx, charScreenX, charScreenY, walking, timeRef.current, g.blink > 0 ? 1 : 0);

    // Perfect banner flash
    if (g.perfectT > 0) {
      const a = Math.min(1, g.perfectT) * (g.perfectT < 0.5 ? g.perfectT * 2 : 1);
      ctx.fillStyle = `rgba(212,175,55,${a * 0.15})`; ctx.fillRect(0, 0, w, h);
    }

    // Flash
    if (g.flashT > 0) { ctx.fillStyle = `rgba(180,40,40,${(g.flashT / 0.8) * 0.35})`; ctx.fillRect(0, 0, w, h); }
    if (g.goodFlashT > 0) { ctx.fillStyle = `rgba(212,175,55,${(g.goodFlashT / 0.3) * 0.15})`; ctx.fillRect(0, 0, w, h); }

    // Idle hint
    if (g.step === "idle" && g.running) {
      const pulse = Math.sin(timeRef.current * 4) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(212,175,55,${pulse * 0.7})`;
      ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("HOLD to extend bridge", w / 2, platY - 55);
    }

    if (g.running || g.particles.length > 0) rafRef.current = requestAnimationFrame(loop);
  }, []);

  const startLoop = useCallback(() => { cancelAnimationFrame(rafRef.current); if (gameRef.current) gameRef.current.lastTime = 0; rafRef.current = requestAnimationFrame(loop); }, [loop]);

  const playTicket = useCallback((t: Ticket) => {
    if (startingRef.current || t.price > balance) return; startingRef.current = true;
    setBalance(prev => { const n = prev - t.price; localStorage.setItem(BALANCE_KEY, String(n)); return n; });
    audioRef.current.start();
    setTicket(t);
    const { w, h } = sizeRef.current;
    const platY = (h || 600) * PLATFORM_Y_FRAC;
    const p0 = genPlatform(30, 0); p0.w = 80;
    const p1 = genPlatform(p0.x + p0.w + 140, 0);
    const p2 = genPlatform(p1.x + p1.w + GAP_MIN + Math.random() * 80, 0);
    gameRef.current = {
      platforms: [p0, p1, p2],
      charX: p0.x + p0.w / 2 + 30, charBaseX: p0.x + p0.w / 2,
      stickLen: 0, stickAngle: 0,
      step: "idle", stepT: 0,
      scrollOffset: 0,
      particles: [],
      score: 0, target: t.target, timeLeft: t.time, timeMax: t.time,
      running: true, lastTime: 0, flashT: 0, goodFlashT: 0,
      perfectT: 0, perfectBonus: false,
      fallOffY: platY, charY: platY - CHAR_H / 2, charVY: 0,
      blink: 0,
    };
    void w;
    timeRef.current = 0; growSoundTimer.current = 0;
    lastSecRef.current = t.time; setScore(0); setTimeLeft(t.time);
    if (timerBarRef.current) timerBarRef.current.style.width = "100%";
    setPhase("playing"); startLoop();
  }, [balance, startLoop]);

  useEffect(() => { const audio = audioRef.current; return () => { cancelAnimationFrame(rafRef.current); audio.dispose(); }; }, []);
  const toggleMute = () => { audioRef.current.muted = !muted; setMuted(!muted); };

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{ background: "#e8e0d5" }}>
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3">
        <Link href="/games"><button className="w-10 h-10 rounded-full bg-black/15 backdrop-blur border border-amber-800/40 flex items-center justify-center text-amber-900 hover:text-amber-700 transition-colors"><ArrowLeft size={18} /></button></Link>
        <div className="flex flex-col items-center">
          <span className="text-[10px] tracking-[0.3em] text-amber-900/70 font-display uppercase">{phase === "playing" ? "CROSSINGS" : "BRIDGE BUILDER"}</span>
          <span data-testid="text-score" className="font-display font-black text-4xl text-amber-900 leading-none drop-shadow-[0_0_10px_rgba(139,69,19,0.3)]">{score}</span>
          {phase === "playing" && <span className="text-[9px] tracking-widest text-amber-900/60 font-display uppercase mt-0.5">GOAL {target}</span>}
        </div>
        <button onClick={toggleMute} className="w-10 h-10 rounded-full bg-black/15 backdrop-blur border border-amber-800/40 flex items-center justify-center text-amber-900">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
      </div>

      {perfectDisplay && phase === "playing" && (
        <motion.div initial={{ opacity: 1, y: 0, scale: 1 }} animate={{ opacity: 0, y: -70, scale: 1.5 }} transition={{ duration: 1.2 }} className="absolute top-1/3 left-1/2 -translate-x-1/2 z-30 font-display font-black text-3xl text-amber-800 drop-shadow-[0_0_16px_rgba(212,175,55,0.9)] pointer-events-none">⭐ PERFECT! ×2</motion.div>
      )}

      {phase === "playing" && (
        <div className="absolute top-[84px] left-1/2 -translate-x-1/2 z-30 w-[72%] flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-widest text-amber-900/70 font-display uppercase">Crossings</span><span data-testid="text-progress" className="text-[11px] font-mono font-bold tabular-nums text-amber-900/90">{score} / {target}</span></div>
            <div className="w-full h-2.5 rounded-full bg-amber-900/15 overflow-hidden border border-amber-800/20"><div data-testid="bar-progress" className="h-full rounded-full bg-gradient-to-r from-amber-800 to-yellow-700 shadow-[0_0_12px_rgba(139,69,19,0.4)] transition-[width] duration-300" style={{ width: `${target > 0 ? Math.min(100, (score / target) * 100) : 0}%` }} /></div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-widest text-amber-900/50 font-display uppercase">Time</span><span data-testid="text-timer" className={`text-[11px] font-mono font-bold tabular-nums ${timeLeft <= 5 ? "text-red-600" : "text-amber-900/70"}`}>{timeLeft}s</span></div>
            <div className="w-full h-1.5 rounded-full bg-amber-900/15 overflow-hidden"><div ref={timerBarRef} data-testid="bar-timer" className="h-full rounded-full" style={{ width: "100%" }} /></div>
          </div>
        </div>
      )}

      <div ref={wrapRef} className="flex-1 relative"
        onPointerDown={() => {
          const g = gameRef.current;
          if (!g || !g.running || phase !== "playing") return;
          if (g.step === "idle") { g.step = "growing"; holdingRef.current = true; growSoundTimer.current = 0; }
        }}
        onPointerUp={() => { holdingRef.current = false; }}
        onPointerLeave={() => { holdingRef.current = false; }}>
        <canvas ref={canvasRef} className="absolute inset-0 touch-none" />
      </div>

      <AnimatePresence>{phase === "select" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col px-6 pt-16 pb-6 overflow-y-auto" style={{ background: "rgba(232,224,213,0.97)" }}>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <div className="text-4xl mb-2">🌉</div>
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-amber-800" /><span className="text-[11px] tracking-[0.4em] text-amber-800/60 uppercase">Bridge Builder</span></div>
            <h1 className="font-display font-black text-2xl text-amber-900 mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-amber-900/60 mb-4 max-w-[260px]">Hold to extend the bridge, release to drop it. Land on the red dot for Perfect (×2 points)!</p>
            <div className="flex items-center gap-2 mb-5 px-4 py-2 rounded-xl bg-amber-800/10 border border-amber-800/30"><Coins size={14} className="text-amber-800" /><span data-testid="text-balance" className="text-sm font-mono font-bold text-amber-800">{balance.toLocaleString()} SKZ</span></div>
            <div className="w-full flex flex-col gap-2.5">
              {TICKETS.map(t => { const ok = t.price <= balance; return (
                <button key={t.id} disabled={!ok} onClick={() => ok && playTicket(t)} data-testid={`button-ticket-${t.id}`}
                  className={`w-full flex items-center justify-between rounded-2xl border p-3.5 transition-all ${ok ? "bg-amber-800/8 border-amber-800/30 hover:border-amber-800 active:scale-[0.98]" : "bg-black/5 border-black/10 opacity-40 cursor-not-allowed"}`}>
                  <div className="flex flex-col items-start"><span className="font-mono font-bold text-base text-amber-800">{t.name}</span><span className="text-[10px] text-amber-900/50 font-mono uppercase mt-0.5">Cross {t.target} · {t.time}s</span></div>
                  <div className="flex flex-col items-end"><span className="flex items-center gap-1 text-amber-800 font-mono font-bold text-sm"><Coins size={12} />{t.prize.toLocaleString()}</span><span className="text-[10px] text-amber-900/50 font-mono uppercase mt-0.5">Entry {t.price}</span></div>
                </button>
              ); })}
            </div>
            <div className="flex items-center gap-1.5 mt-5 text-[11px] text-amber-900/40"><Trophy size={11} className="text-amber-800" /><span data-testid="text-best" className="font-mono">Best {best}</span></div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      <AnimatePresence>{phase === "won" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-center justify-center px-8" style={{ background: "rgba(232,224,213,0.95)" }}>
          <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.4 }} className="w-full max-w-[300px] flex flex-col items-center text-center">
            <div className="text-5xl mb-3">⛩️</div>
            <span data-testid="text-result" className="text-xs tracking-[0.4em] font-display uppercase mb-2 text-amber-800">Zen Master!</span>
            <div className="font-display font-black text-5xl text-amber-800 mb-1">+{ticket?.prize.toLocaleString()}</div>
            <span className="text-sm text-amber-900/60 mb-6 font-mono">SKZ prize claimed</span>
            <div className="w-full grid grid-cols-2 gap-3 mb-7">
              <div className="bg-amber-800/8 border border-amber-800/25 rounded-2xl p-3 flex flex-col items-center"><div className="text-amber-900/50 text-[10px] font-mono uppercase mb-1">Crossed</div><span data-testid="text-final-score" className="font-mono font-bold text-xl text-amber-800">{score}</span></div>
              <div className="bg-amber-800/8 border border-amber-800/25 rounded-2xl p-3 flex flex-col items-center"><div className="text-amber-900/50 text-[10px] font-mono uppercase mb-1">Balance</div><span data-testid="text-balance-final" className="font-mono font-bold text-xl text-amber-800">{balance.toLocaleString()}</span></div>
            </div>
            <button onClick={() => setPhase("select")} data-testid="button-replay" className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-700 to-yellow-600 text-white font-mono font-bold tracking-widest flex items-center justify-center gap-2 mb-3 active:scale-95"><RotateCcw size={18} />PLAY AGAIN</button>
            <Link href="/games"><button data-testid="button-exit" className="text-sm text-amber-800/40 hover:text-amber-800 font-mono">← Back to Arena</button></Link>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      <AnimatePresence>{phase === "lost" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-center justify-center px-8" style={{ background: "rgba(232,224,213,0.95)" }}>
          <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.35 }} className="w-full max-w-[300px] flex flex-col items-center text-center">
            <div className="text-5xl mb-3">😮</div>
            <span data-testid="text-result" className="text-xs tracking-[0.4em] font-display uppercase mb-2 text-red-700">Fell off!</span>
            <div data-testid="text-loss-amount" className="font-display font-black text-5xl text-red-700 mb-1">-{ticket?.price ?? 0}</div>
            <span className="text-sm text-amber-900/60 mb-6 font-mono">SKZ entry lost</span>
            <div className="w-full grid grid-cols-2 gap-3 mb-7">
              <div className="bg-white/50 border border-amber-800/20 rounded-2xl p-3 flex flex-col items-center"><div className="text-amber-900/50 text-[10px] font-mono uppercase mb-1">Crossed</div><span data-testid="text-final-score" className="font-mono font-bold text-xl text-amber-900">{score}/{target}</span></div>
              <div className="bg-white/50 border border-amber-800/20 rounded-2xl p-3 flex flex-col items-center"><div className="text-amber-900/50 text-[10px] font-mono uppercase mb-1">Balance</div><span data-testid="text-balance-final" className="font-mono font-bold text-xl text-amber-900">{balance.toLocaleString()}</span></div>
            </div>
            <button onClick={() => setPhase("select")} data-testid="button-replay" className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-700 to-yellow-600 text-white font-mono font-bold tracking-widest flex items-center justify-center gap-2 mb-3 active:scale-95"><RotateCcw size={18} />TRY AGAIN</button>
            <Link href="/games"><button data-testid="button-exit" className="text-sm text-amber-800/40 hover:text-amber-800 font-mono">← Back to Arena</button></Link>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}

function easeInOut(t: number): number { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
