import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Volume2, VolumeX, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";
import { GAME_TICKETS } from "@/lib/tickets-data";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }

const BEST_KEY = "skz_jumper_best";
const BALANCE_KEY = "skz_balance";
const START_BALANCE = 1000;
const TWO_PI = Math.PI * 2;
const GRAVITY = 1800;
const JUMP_VY = -680;
const SPRING_VY = -1050;
const PLATFORM_GAP_Y = 90;
const PLATFORM_SPEED_X = 90;
const PLAYER_R = 14;
const MOVE_SPEED = 240;

const RAW_TICKETS: Ticket[] = GAME_TICKETS.hopper;

type PlatType = "solid" | "moving" | "spring" | "breaking" | "cloud";
interface Platform { x: number; y: number; w: number; type: PlatType; vx: number; bounced: boolean; breakTimer: number; broken: boolean; springs: boolean; glowT: number; }
interface Enemy { x: number; y: number; vx: number; vy: number; r: number; phase: number; dead: boolean; onPlatY: number; }
interface Star { x: number; y: number; r: number; twinT: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number; }

interface GameState {
  playerX: number; playerY: number; playerVX: number; playerVY: number;
  playerFacingRight: boolean; playerOnGround: boolean; playerAnim: number;
  cameraY: number; platforms: Platform[]; enemies: Enemy[];
  particles: Particle[]; stars: Star[];
  score: number; target: number; timeLeft: number; timeMax: number;
  running: boolean; lastTime: number;
  peakY: number; nextPlatY: number;
  holdLeft: boolean; holdRight: boolean;
  flashT: number; flashColor: string;
  invincT: number;
  highScore: number;
  jumpCount: number;
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
  jump() { this.tone(480, 0.1, "triangle", 0.28, 0, 660); }
  spring() { this.tone(660, 0.08, "triangle", 0.35, 0, 1100); this.tone(880, 0.08, "triangle", 0.28, 0.04, 1320); }
  break_() { this.noise(0.2, 0.3, 3000); this.tone(220, 0.15, "sawtooth", 0.2); }
  enemyHit() { this.noise(0.25, 0.4, 1500); this.tone(150, 0.2, "sawtooth", 0.3); }
  milestone() { [523, 659, 784, 880].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.3, i * 0.05)); }
  start() { [330, 440, 554, 659].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.3, i * 0.06)); }
  goal() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.24, "triangle", 0.38, i * 0.07)); }
  gameOver() { [261, 220, 196, 165].forEach((f, i) => this.tone(f, 0.28, "sawtooth", 0.28, i * 0.11)); }
  tick(u = false) { this.tone(u ? 900 : 650, 0.07, "square", u ? 0.22 : 0.13); }
  dispose() { if (this.ctx) { void this.ctx.close(); this.ctx = null; this.master = null; } }
}

function randomPlatType(score: number): PlatType {
  const r = Math.random();
  if (score < 5) return "solid";
  if (score < 15) return r < 0.75 ? "solid" : r < 0.88 ? "moving" : "spring";
  if (score < 35) return r < 0.55 ? "solid" : r < 0.72 ? "moving" : r < 0.86 ? "spring" : "breaking";
  return r < 0.4 ? "solid" : r < 0.6 ? "moving" : r < 0.75 ? "spring" : r < 0.88 ? "breaking" : "cloud";
}

function genPlatforms(w: number, startY: number, count: number, score: number): Platform[] {
  const plats: Platform[] = [];
  let y = startY;
  for (let i = 0; i < count; i++) {
    const type = i === 0 ? "solid" : randomPlatType(score);
    const pw = type === "cloud" ? 80 + Math.random() * 50 : 50 + Math.random() * (w * 0.45);
    const px = Math.random() * (w - pw);
    const hasSpring = type === "solid" && Math.random() < 0.15;
    plats.push({
      x: px, y, w: pw, type,
      vx: type === "moving" ? (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * PLATFORM_SPEED_X) : 0,
      bounced: false, breakTimer: 0, broken: false, springs: hasSpring, glowT: 0,
    });
    y -= PLATFORM_GAP_Y + Math.random() * 30;
  }
  return plats;
}

const PLATTYPE_COLOR: Record<PlatType, string> = {
  solid: "#2ecc71", moving: "#3498db", spring: "#f39c12", breaking: "#e74c3c", cloud: "#ecf0f1"
};
const PLATTYPE_GLOW: Record<PlatType, string> = {
  solid: "rgba(46,204,113,0.5)", moving: "rgba(52,152,219,0.5)", spring: "rgba(243,156,18,0.5)", breaking: "rgba(231,76,60,0.5)", cloud: "rgba(200,200,255,0.3)"
};

function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform, screenY: number, t: number) {
  if (p.broken) return;
  const c = PLATTYPE_COLOR[p.type];
  const brk = p.type === "breaking" && p.breakTimer > 0;
  const brkAlpha = brk ? 1 - p.breakTimer / 0.5 : 1;
  const h = p.type === "cloud" ? 18 : 14;
  ctx.save(); ctx.globalAlpha = brkAlpha;
  if (p.type === "cloud") {
    // Cloud fluffy shape
    ctx.fillStyle = "rgba(220,230,255,0.85)";
    ctx.shadowColor = "rgba(180,200,255,0.5)"; ctx.shadowBlur = 12;
    for (let bx = 0; bx <= p.w; bx += 20) {
      const br2 = 14 + Math.sin(bx * 0.3 + t * 0.5) * 3;
      ctx.beginPath(); ctx.arc(p.x + bx, screenY - br2 * 0.4, br2, 0, TWO_PI); ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.beginPath(); ctx.roundRect(p.x, screenY - 4, p.w, h, 8); ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    // Normal platform
    ctx.shadowColor = p.glowT > 0 ? "#fff" : PLATTYPE_GLOW[p.type]; ctx.shadowBlur = p.glowT > 0 ? 18 : 8;
    const g = ctx.createLinearGradient(p.x, screenY - h, p.x, screenY);
    const lighter = c + "dd"; const darker = c.replace(/[0-9a-f]{2}$/i, "88");
    g.addColorStop(0, p.glowT > 0 ? "#fff" : lighter); g.addColorStop(1, darker);
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(p.x, screenY - h, p.w, h, [6, 6, 3, 3]); ctx.fill();
    ctx.shadowBlur = 0;
    // Shine
    ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.beginPath(); ctx.roundRect(p.x + 4, screenY - h + 2, p.w - 8, 4, [3, 3, 0, 0]); ctx.fill();
    // Moving platform direction arrows
    if (p.type === "moving") {
      ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(p.vx > 0 ? "→" : "←", p.x + p.w / 2, screenY - h / 2);
    }
    // Spring
    if (p.springs) {
      const sx = p.x + p.w / 2;
      ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.shadowColor = "rgba(241,196,15,0.8)"; ctx.shadowBlur = 10;
      for (let i = 0; i < 3; i++) {
        const y2 = screenY - h - 4 - i * 5;
        ctx.beginPath(); ctx.moveTo(sx - 6 + (i % 2) * 12, y2 + 5); ctx.lineTo(sx + 6 - (i % 2) * 12, y2); ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
  }
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, vx: number, vy: number, anim: number, invinct: boolean, t: number) {
  ctx.save(); ctx.translate(x, y);
  if (invinct && Math.floor(t * 15) % 2 === 0) { ctx.restore(); return; }
  const facingRight = vx >= 0;
  const running = Math.abs(vx) > 20;
  const jumping = vy < -50;
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(0, PLAYER_R + 3, 12, 5, 0, 0, TWO_PI); ctx.fill();
  // Body
  ctx.shadowColor = "rgba(255,200,50,0.5)"; ctx.shadowBlur = 12;
  const bodyG = ctx.createRadialGradient(-4, -4, 2, 0, 0, PLAYER_R);
  bodyG.addColorStop(0, "#ffe066"); bodyG.addColorStop(0.4, "#ffb300"); bodyG.addColorStop(0.8, "#e67e00"); bodyG.addColorStop(1, "#c05000");
  ctx.fillStyle = bodyG; ctx.beginPath(); ctx.arc(0, 0, PLAYER_R, 0, TWO_PI); ctx.fill();
  ctx.shadowBlur = 0;
  // Eyes
  const ex = facingRight ? 5 : -5;
  ctx.fillStyle = "#1a0a00"; ctx.beginPath(); ctx.arc(ex, -3, 4, 0, TWO_PI); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex + (facingRight ? 1 : -1), -4, 1.5, 0, TWO_PI); ctx.fill();
  ctx.fillStyle = "#1a0a00"; ctx.beginPath(); ctx.arc(ex, -3 + (jumping ? -1 : 1), 1.5, 0, TWO_PI); ctx.fill();
  // Mouth
  if (jumping) {
    ctx.fillStyle = "#1a0a00"; ctx.beginPath(); ctx.arc(ex * 0.3, 2, 3, 0, Math.PI); ctx.fill();
  } else {
    ctx.strokeStyle = "#1a0a00"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ex * 0.4, 1, 2.5, 0.2, Math.PI - 0.2); ctx.stroke();
  }
  // Ears/hair
  ctx.fillStyle = "#c05000";
  ctx.beginPath(); ctx.ellipse(facingRight ? 6 : -6, -PLAYER_R + 2, 4, 6, facingRight ? 0.3 : -0.3, 0, TWO_PI); ctx.fill();
  // Legs animation
  if (running) {
    const legSwing = Math.sin(anim * 12) * 7;
    ctx.strokeStyle = "#c05000"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-4, PLAYER_R - 4); ctx.lineTo(-6 + legSwing, PLAYER_R + 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, PLAYER_R - 4); ctx.lineTo(6 - legSwing, PLAYER_R + 8); ctx.stroke();
  } else if (!jumping) {
    ctx.strokeStyle = "#c05000"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-4, PLAYER_R - 4); ctx.lineTo(-5, PLAYER_R + 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, PLAYER_R - 4); ctx.lineTo(5, PLAYER_R + 8); ctx.stroke();
  }
  // Propeller spring legs when jumping high
  if (jumping && Math.abs(vy) > 500) {
    ctx.strokeStyle = "rgba(255,220,0,0.7)"; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const y2 = PLAYER_R + 2 + i * 5;
      const w2 = 8 - i * 2;
      ctx.beginPath(); ctx.moveTo(-w2, y2); ctx.lineTo(w2, y2); ctx.stroke();
    }
  }
  ctx.restore();
  void t;
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, screenY: number, t: number) {
  ctx.save(); ctx.translate(e.x, screenY);
  const eyePulse = Math.sin(t * 3 + e.phase) * 0.15 + 0.85;
  ctx.shadowColor = "rgba(255,50,50,0.7)"; ctx.shadowBlur = 12 + Math.sin(t * 5 + e.phase) * 5;
  // Body
  const bg = ctx.createRadialGradient(0, 0, 2, 0, 0, e.r);
  bg.addColorStop(0, "#ff6666"); bg.addColorStop(0.5, "#cc0000"); bg.addColorStop(1, "#660000");
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, e.r * eyePulse, 0, TWO_PI); ctx.fill();
  ctx.shadowBlur = 0;
  // Spiky hair
  ctx.fillStyle = "#880000";
  for (let s = 0; s < 5; s++) {
    const a = (s / 5) * Math.PI * 2 - Math.PI / 2 + Math.sin(t * 3 + s) * 0.2;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * e.r * 0.7, Math.sin(a) * e.r * 0.7);
    ctx.lineTo(Math.cos(a - 0.25) * e.r, Math.sin(a - 0.25) * e.r);
    ctx.lineTo(Math.cos(a + 0.25) * e.r, Math.sin(a + 0.25) * e.r); ctx.closePath(); ctx.fill();
  }
  // Eyes (evil)
  ctx.fillStyle = "#ffff00"; ctx.beginPath(); ctx.ellipse(-4, -3, 4, 3, -0.3, 0, TWO_PI); ctx.fill();
  ctx.fillStyle = "#ffff00"; ctx.beginPath(); ctx.ellipse(4, -3, 4, 3, 0.3, 0, TWO_PI); ctx.fill();
  ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(-4, -3, 1.5, 0, TWO_PI); ctx.fill();
  ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(4, -3, 1.5, 0, TWO_PI); ctx.fill();
  // Mouth
  ctx.strokeStyle = "#330000"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 2, 4, 0, Math.PI); ctx.stroke();
  for (let t2 = 0; t2 < 3; t2++) { ctx.fillStyle = "#550000"; ctx.beginPath(); ctx.arc(-3 + t2 * 3, 5.5, 1.5, 0, TWO_PI); ctx.fill(); }
  ctx.restore();
}

export default function JumperGame() {
  const TICKETS = useGameTickets("hopper", RAW_TICKETS);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const rafRef = useRef(0);
  const audioRef = useRef(new AudioEngine());
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const lastSecRef = useRef(0);
  const timerBarRef = useRef<HTMLDivElement>(null);
  const startingRef = useRef(false);
  const timeElapsedRef = useRef(0);
  const lastMilestone = useRef(0);

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

  const finishGame = useCallback((finalScore: number, outcome: "win" | "fall" | "time") => {
    const g = gameRef.current; if (!g || !g.running) return; g.running = false; startingRef.current = false;
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
    timeElapsedRef.current += dt;
    const t = timeElapsedRef.current;

    if (g.running) {
      g.timeLeft = Math.max(0, g.timeLeft - dt);
      const sec = Math.ceil(g.timeLeft);
      if (sec !== lastSecRef.current) { lastSecRef.current = sec; setTimeLeft(sec); if (sec <= 8 && sec > 0) audioRef.current.tick(sec <= 4); }
      const bar = timerBarRef.current; const ratio = g.timeLeft / g.timeMax;
      if (bar) { bar.style.width = `${ratio * 100}%`; bar.style.backgroundImage = ratio <= 0.25 ? "linear-gradient(to right,#e74c3c,#e67e22)" : "linear-gradient(to right,#2ecc71,#3498db)"; }
      if (g.timeLeft <= 0) { endRef.current(g.score, "time"); return; }
    }

    if (g.invincT > 0) g.invincT -= dt;
    g.flashT = Math.max(0, g.flashT - dt);
    g.playerAnim += dt;

    if (g.running) {
      // Input
      if (g.holdLeft) g.playerVX -= MOVE_SPEED * dt * 4;
      if (g.holdRight) g.playerVX += MOVE_SPEED * dt * 4;
      g.playerVX = Math.max(-MOVE_SPEED, Math.min(MOVE_SPEED, g.playerVX));
      g.playerVX *= Math.pow(0.85, dt * 60); // friction
      if (g.playerFacingRight !== undefined) g.playerFacingRight = g.playerVX >= 0;

      // Physics
      g.playerVY += GRAVITY * dt;
      g.playerX = ((g.playerX + g.playerVX * dt) + w) % w;
      g.playerY += g.playerVY * dt;
      g.playerOnGround = false;

      // Platform collision
      for (const p of g.platforms) {
        if (p.broken) continue;
        // Move platform
        p.x += p.vx * dt;
        if (p.x < 0 || p.x + p.w > w) { p.vx *= -1; p.x = Math.max(0, Math.min(w - p.w, p.x)); }
        // Break timer
        if (p.breakTimer > 0) { p.breakTimer += dt; if (p.breakTimer > 0.5) { p.broken = true; for (let i = 0; i < 12; i++) { const a = Math.random() * TWO_PI; const spd = 80 + Math.random() * 150; g.particles.push({ x: p.x + p.w / 2, y: g.cameraY + p.y + h / 2, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 100, life: 0.8, max: 0.8, color: "#e74c3c", r: 3 + Math.random() * 4 }); } audioRef.current.break_(); } }
        if (p.glowT > 0) p.glowT = Math.max(0, p.glowT - dt);

        const screenY = p.y - g.cameraY + h / 2;
        // Collision: player falling onto platform
        if (g.playerVY > 0 && g.playerY + PLAYER_R > screenY - 12 && g.playerY + PLAYER_R < screenY + 8 && g.playerX > p.x - 8 && g.playerX < p.x + p.w + 8) {
          if (p.type === "cloud" && !p.bounced) { /* pass-through if moving up */ }
          else if (!p.bounced) {
            p.bounced = true;
            if (p.type === "spring" || p.springs) {
              g.playerVY = SPRING_VY; g.playerOnGround = true;
              audioRef.current.spring();
              p.glowT = 0.4;
              for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.2; g.particles.push({ x: g.playerX, y: g.playerY + PLAYER_R, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, life: 0.5, max: 0.5, color: "#f39c12", r: 3 + Math.random() * 3 }); }
            } else if (p.type === "breaking") {
              g.playerVY = JUMP_VY; g.playerOnGround = true;
              if (p.breakTimer === 0) p.breakTimer = 0.001;
              audioRef.current.jump();
            } else {
              g.playerVY = JUMP_VY; g.playerOnGround = true;
              p.glowT = 0.25;
              audioRef.current.jump();
              for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5; g.particles.push({ x: g.playerX, y: g.playerY + PLAYER_R, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, life: 0.4, max: 0.4, color: PLATTYPE_COLOR[p.type], r: 2 + Math.random() * 3 }); }
            }
          }
        } else {
          if (g.playerVY < 0) p.bounced = false;
        }
      }

      // Camera follow player going up
      const screenPlayerY = g.playerY;
      if (screenPlayerY < h * 0.4) {
        const diff = h * 0.4 - screenPlayerY;
        g.cameraY -= diff;
        g.playerY += diff;
      }

      // Score based on height
      const height = Math.floor(-g.cameraY / 80);
      if (height > g.score) { g.score = height; setScore(height); if (height >= g.target) { endRef.current(height, "win"); return; } if (height > 0 && height % 10 === 0 && height !== lastMilestone.current) { lastMilestone.current = height; audioRef.current.milestone(); } }

      // Generate more platforms above
      while (g.platforms.length > 0 && g.platforms[g.platforms.length - 1].y > g.cameraY - h * 0.8) {
        const topPlat = g.platforms[g.platforms.length - 1];
        const newPlatY = topPlat.y - (PLATFORM_GAP_Y + Math.random() * 25);
        const type = randomPlatType(g.score);
        const pw = type === "cloud" ? 80 + Math.random() * 50 : 50 + Math.random() * (w * 0.45);
        const px = Math.random() * (w - pw);
        const hasSpring = type === "solid" && Math.random() < 0.15;
        g.platforms.push({ x: px, y: newPlatY, w: pw, type, vx: type === "moving" ? (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * PLATFORM_SPEED_X) : 0, bounced: false, breakTimer: 0, broken: false, springs: hasSpring, glowT: 0 });
        // Spawn enemy occasionally
        if (g.score > 10 && Math.random() < 0.1 && type === "solid") {
          g.enemies.push({ x: px + pw * 0.5, y: newPlatY, vx: (Math.random() < 0.5 ? -1 : 1) * 60, vy: 0, r: 14, phase: Math.random() * TWO_PI, dead: false, onPlatY: newPlatY });
        }
      }
      // Remove platforms below camera
      g.platforms = g.platforms.filter(p => p.y < g.cameraY + h * 1.5);
      g.enemies = g.enemies.filter(e => !e.dead && e.y < g.cameraY + h * 1.5);

      // Enemy movement
      for (const e of g.enemies) {
        e.x += e.vx * dt; e.y = e.onPlatY - 16;
        if (e.x < e.r || e.x > w - e.r) e.vx *= -1;
        e.phase += dt;
        // Enemy collision with player
        if (g.invincT <= 0 && Math.hypot(g.playerX - e.x, g.playerY - (e.y - g.cameraY + h / 2)) < PLAYER_R + e.r) {
          if (g.playerVY > 0 && g.playerY < e.y - g.cameraY + h / 2 - e.r * 0.3) {
            // Stomp
            e.dead = true; g.playerVY = JUMP_VY * 0.8;
            audioRef.current.enemyHit();
            for (let i = 0; i < 14; i++) { const a = Math.random() * TWO_PI; g.particles.push({ x: e.x, y: e.y - g.cameraY + h / 2, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120 - 80, life: 0.7, max: 0.7, color: "#ff4444", r: 3 + Math.random() * 4 }); }
            g.score += 2; setScore(g.score);
          } else {
            // Hit
            g.invincT = 1.8; g.flashT = 0.5; g.flashColor = "#ff0000";
            audioRef.current.enemyHit();
          }
        }
      }

      // Fall off screen
      if (g.playerY > h + 60) { endRef.current(g.score, "fall"); return; }
    }

    // Update particles
    for (const p of g.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; }
    g.particles = g.particles.filter(p => p.life > 0);

    // Stars drift
    for (const s of g.stars) { if (Math.random() < 0.01) s.twinT = 0.5; if (s.twinT > 0) s.twinT -= dt; }

    // ---- Render ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background - sky gradient changes with height
    const heightFrac = Math.min(1, Math.max(0, -g.cameraY / 5000));
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    if (heightFrac < 0.3) {
      sky.addColorStop(0, "#0a0020"); sky.addColorStop(1, "#001040");
    } else if (heightFrac < 0.6) {
      sky.addColorStop(0, "#000010"); sky.addColorStop(1, "#000830");
    } else {
      sky.addColorStop(0, "#000000"); sky.addColorStop(1, "#000018");
    }
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

    // Stars
    for (const star of g.stars) {
      const sa = star.twinT > 0 ? 0.3 + star.twinT * 2 : 0.5 + Math.sin(t * 1.5 + star.r * 10) * 0.2;
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, sa)})`; ctx.beginPath(); ctx.arc(star.x, star.y + (g.cameraY * 0.05) % h, star.r, 0, TWO_PI); ctx.fill();
    }

    // Atmospheric glow at higher altitudes
    if (heightFrac > 0.2) {
      const ng = ctx.createRadialGradient(w / 2, h * 0.3, 0, w / 2, h * 0.3, w * 0.6);
      ng.addColorStop(0, `rgba(100,50,200,${heightFrac * 0.08})`); ng.addColorStop(1, "rgba(0,0,50,0)");
      ctx.fillStyle = ng; ctx.fillRect(0, 0, w, h);
    }

    // Platforms
    for (const p of g.platforms) {
      if (p.broken) continue;
      const screenY = p.y - g.cameraY + h / 2;
      if (screenY < -50 || screenY > h + 50) continue;
      drawPlatform(ctx, p, screenY, t);
    }

    // Enemies
    for (const e of g.enemies) {
      if (e.dead) continue;
      const screenY = e.y - g.cameraY + h / 2;
      if (screenY < -50 || screenY > h + 50) continue;
      drawEnemy(ctx, e, screenY, t);
    }

    // Particles
    for (const p of g.particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TWO_PI); ctx.fill(); ctx.restore();
    }

    // Player
    drawPlayer(ctx, g.playerX, g.playerY, g.playerVX, g.playerVY, g.playerAnim, g.invincT > 0, t);

    // Flash
    if (g.flashT > 0) { ctx.fillStyle = `rgba(255,50,50,${(g.flashT / 0.5) * 0.3})`; ctx.fillRect(0, 0, w, h); }

    // Height meter (right side)
    if (g.running) {
      const meterH = h * 0.3; const meterX = w - 18; const meterY = h * 0.35;
      ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.roundRect(meterX - 6, meterY, 12, meterH, 6); ctx.fill();
      const prog = Math.min(1, g.score / g.target);
      const fillH = meterH * prog;
      const mGrad = ctx.createLinearGradient(0, meterY + meterH, 0, meterY);
      mGrad.addColorStop(0, "#2ecc71"); mGrad.addColorStop(0.5, "#3498db"); mGrad.addColorStop(1, "#9b59b6");
      ctx.fillStyle = mGrad; ctx.beginPath(); ctx.roundRect(meterX - 5, meterY + meterH - fillH, 10, fillH, 5); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillText(`${g.score}`, meterX, meterY - 2);
      ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.textBaseline = "top";
      ctx.fillText(`${g.target}`, meterX, meterY + meterH + 2);
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
    const startPlatY = 30;
    const platforms = genPlatforms(w || 320, startPlatY, 18, 0);
    const stars: Star[] = [];
    for (let i = 0; i < 100; i++) stars.push({ x: Math.random() * (w || 320), y: Math.random() * h * 2, r: 0.5 + Math.random() * 2, twinT: 0 });
    // Player starts on first platform
    const firstPlat = platforms[0];
    gameRef.current = {
      playerX: firstPlat.x + firstPlat.w / 2, playerY: firstPlat.y - PLAYER_R - 12,
      playerVX: 0, playerVY: 0, playerFacingRight: true, playerOnGround: false, playerAnim: 0,
      cameraY: 0, platforms, enemies: [], particles: [], stars,
      score: 0, target: t.target, timeLeft: t.time, timeMax: t.time,
      running: true, lastTime: 0,
      peakY: 0, nextPlatY: startPlatY - PLATFORM_GAP_Y * 18,
      holdLeft: false, holdRight: false,
      flashT: 0, flashColor: "#ff0000",
      invincT: 0, highScore: 0, jumpCount: 0,
    };
    timeElapsedRef.current = 0; lastMilestone.current = 0;
    lastSecRef.current = t.time; setScore(0); setTimeLeft(t.time);
    if (timerBarRef.current) timerBarRef.current.style.width = "100%";
    setPhase("playing"); startLoop();
  }, [balance, startLoop]);

  useEffect(() => { const audio = audioRef.current; return () => { cancelAnimationFrame(rafRef.current); audio.dispose(); }; }, []);
  const toggleMute = () => { audioRef.current.muted = !muted; setMuted(!muted); };

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const g = gameRef.current; if (!g || !g.running) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    if (x < w / 2) g.holdLeft = true; else g.holdRight = true;
  }, []);
  const handlePointerUp = useCallback(() => { const g = gameRef.current; if (g) { g.holdLeft = false; g.holdRight = false; } }, []);

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{ background: "#0a0020" }}>
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3">
        <Link href="/games"><button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-green-500/30 flex items-center justify-center text-green-300 hover:text-white transition-colors"><ArrowLeft size={18} /></button></Link>
        <div className="flex flex-col items-center">
          <span className="text-[10px] tracking-[0.3em] text-green-300/70 font-display uppercase">{phase === "playing" ? "HEIGHT" : "SKY HOPPER"}</span>
          <span data-testid="text-score" className="font-display font-black text-4xl text-green-300 leading-none drop-shadow-[0_0_18px_rgba(46,204,113,0.9)]">{score}</span>
          {phase === "playing" && <span className="text-[9px] tracking-widest text-green-300/60 font-display uppercase mt-0.5">GOAL {target}</span>}
        </div>
        <button onClick={toggleMute} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-green-500/30 flex items-center justify-center text-green-300">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
      </div>

      {phase === "playing" && (
        <div className="absolute top-[84px] left-4 z-30 flex flex-col gap-2.5 w-[60%]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-widest text-green-300/70 font-display uppercase">Height</span><span data-testid="text-progress" className="text-[11px] font-mono font-bold tabular-nums text-white/90">{score} / {target}</span></div>
            <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden border border-green-500/20"><div data-testid="bar-progress" className="h-full rounded-full bg-gradient-to-r from-green-500 to-blue-400 shadow-[0_0_12px_rgba(46,204,113,0.7)] transition-[width] duration-300" style={{ width: `${target > 0 ? Math.min(100, (score / target) * 100) : 0}%` }} /></div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-widest text-white/40 font-display uppercase">Time</span><span data-testid="text-timer" className={`text-[11px] font-mono font-bold tabular-nums ${timeLeft <= 8 ? "text-red-400" : "text-white/70"}`}>{timeLeft}s</span></div>
            <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} data-testid="bar-timer" className="h-full rounded-full" style={{ width: "100%" }} /></div>
          </div>
        </div>
      )}

      <div ref={wrapRef} className="flex-1 relative"
        onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
        <canvas ref={canvasRef} className="absolute inset-0 touch-none" />
        {phase === "playing" && (
          <div className="absolute bottom-4 w-full flex justify-between px-4 pointer-events-none">
            <div className="text-[11px] text-green-300/35 font-display tracking-widest uppercase">TAP LEFT</div>
            <div className="text-[11px] text-green-300/35 font-display tracking-widest uppercase">TAP RIGHT</div>
          </div>
        )}
      </div>

      <AnimatePresence>{phase === "select" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col px-6 pt-16 pb-6 overflow-y-auto" style={{ background: "rgba(10,0,32,0.97)" }}>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <div className="text-4xl mb-2">🐸</div>
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-green-400" /><span className="text-[11px] tracking-[0.4em] text-green-400/60 uppercase">Sky Hopper</span></div>
            <h1 className="font-display font-black text-2xl text-green-300 mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/50 mb-4 max-w-[260px]">Jump on platforms to ascend! Tap left/right to move. Avoid evil monsters. Springs boost you high. Breaking platforms crumble fast!</p>
            <div className="flex items-center gap-2 mb-5 px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/30"><Coins size={14} className="text-green-400" /><span data-testid="text-balance" className="text-sm font-mono font-bold text-green-400">{balance.toLocaleString()} SKZ</span></div>
            <div className="w-full flex flex-col gap-2.5">
              {TICKETS.map(t => { const ok = t.price <= balance; return (
                <button key={t.id} disabled={!ok} onClick={() => ok && playTicket(t)} data-testid={`button-ticket-${t.id}`}
                  className={`w-full flex items-center justify-between rounded-2xl border p-3.5 transition-all ${ok ? "bg-green-500/8 border-green-500/30 hover:border-green-400 active:scale-[0.98]" : "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed"}`}>
                  <div className="flex flex-col items-start"><span className="font-mono font-bold text-base text-green-300">{t.name}</span><span className="text-[10px] text-white/40 font-mono uppercase mt-0.5">Height {t.target} · {t.time}s</span></div>
                  <div className="flex flex-col items-end"><span className="flex items-center gap-1 text-green-400 font-mono font-bold text-sm"><Coins size={12} />{t.prize.toLocaleString()}</span><span className="text-[10px] text-white/40 font-mono uppercase mt-0.5">Entry {t.price}</span></div>
                </button>
              ); })}
            </div>
            <div className="flex items-center gap-1.5 mt-5 text-[11px] text-white/40"><Trophy size={11} className="text-green-400" /><span data-testid="text-best" className="font-mono">Best {best}</span></div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}