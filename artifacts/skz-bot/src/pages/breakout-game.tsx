import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Volume2, VolumeX, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";
import { GAME_TICKETS } from "@/lib/tickets-data";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }

const BEST_KEY = "skz_breakout_best";
const BALANCE_KEY = "skz_balance";
const START_BALANCE = 1000;
const TWO_PI = Math.PI * 2;

const RAW_TICKETS: Ticket[] = GAME_TICKETS.breakout;

const BRICK_ROWS = 6; const BRICK_COLS = 8;
const BRICK_COLORS = [
  ["#e74c3c","#c0392b"], // red
  ["#e67e22","#d35400"], // orange
  ["#f1c40f","#f39c12"], // yellow
  ["#2ecc71","#27ae60"], // green
  ["#3498db","#2980b9"], // blue
  ["#9b59b6","#8e44ad"], // purple
];
const BRICK_GLOW = ["rgba(231,76,60,0.6)","rgba(230,126,34,0.6)","rgba(241,196,15,0.6)","rgba(46,204,113,0.6)","rgba(52,152,219,0.6)","rgba(155,89,182,0.6)"];
const POWERUP_TYPES = ["wide","multi","laser","slow"] as const;
type PowerupType = typeof POWERUP_TYPES[number];

interface Brick { col: number; row: number; hp: number; maxHp: number; colorRow: number; special: "" | "bomb" | "powerup"; powerupType?: PowerupType; x: number; y: number; w: number; h: number; flashT: number; breaking: boolean; breakT: number; }
interface Ball { x: number; y: number; vx: number; vy: number; r: number; trail: {x: number; y: number}[]; }
interface Laser { x: number; y: number; h: number; life: number; }
interface PowerupDrop { x: number; y: number; vy: number; type: PowerupType; life: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number; }

interface GameState {
  bricks: Brick[];
  balls: Ball[];
  paddleX: number; paddleW: number; paddleTargetX: number;
  lasers: Laser[];
  powerups: PowerupDrop[];
  particles: Particle[];
  score: number; target: number; timeLeft: number; timeMax: number;
  running: boolean; lastTime: number;
  launched: boolean;
  wideT: number; laserT: number; slowT: number;
  laserFireT: number;
  level: number; brokenCount: number;
  flashT: number; goodFlashT: number;
  shakeT: number; shakeX: number; shakeY: number;
  dragging: boolean; dragX: number;
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
  bounce(high: boolean) { this.tone(high ? 660 : 440, 0.06, "square", 0.2, 0, high ? 880 : 554); }
  break_(multi: boolean) { this.noise(multi ? 0.3 : 0.15, multi ? 0.5 : 0.3, multi ? 2000 : 4000); this.tone(multi ? 440 : 330, 0.12, "triangle", 0.28); }
  paddle() { this.tone(330, 0.05, "square", 0.18, 0, 440); }
  powerup() { [440, 554, 659].forEach((f, i) => this.tone(f, 0.15, "triangle", 0.28, i * 0.05)); }
  laser_() { this.tone(1200, 0.15, "sawtooth", 0.25, 0, 300); }
  bomb() { this.noise(0.4, 0.7, 1200); this.tone(80, 0.35, "sawtooth", 0.4); }
  start() { [330, 440, 554, 659].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.3, i * 0.06)); }
  goal() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.24, "triangle", 0.38, i * 0.07)); }
  gameOver() { [261, 220, 196, 165].forEach((f, i) => this.tone(f, 0.28, "sawtooth", 0.28, i * 0.11)); }
  tick(u = false) { this.tone(u ? 900 : 650, 0.07, "square", u ? 0.22 : 0.13); }
  dispose() { if (this.ctx) { void this.ctx.close(); this.ctx = null; this.master = null; } }
}

function buildBricks(w: number, h: number, level: number): Brick[] {
  const bricks: Brick[] = [];
  const brickW = (w - 20) / BRICK_COLS;
  const brickH = Math.min(32, (h * 0.42) / BRICK_ROWS);
  const startY = 55;
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      const colorRow = r % BRICK_COLORS.length;
      const maxHp = r === 0 ? Math.min(3, 1 + Math.floor(level / 2)) : r <= 1 ? Math.min(2, 1 + Math.floor(level / 3)) : 1;
      const isSpecial = Math.random() < 0.08 + level * 0.02;
      const isBomb = Math.random() < 0.04;
      bricks.push({
        col: c, row: r,
        hp: maxHp, maxHp,
        colorRow,
        special: isBomb ? "bomb" : isSpecial ? "powerup" : "",
        powerupType: isSpecial ? POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)] : undefined,
        x: 10 + c * brickW, y: startY + r * (brickH + 4),
        w: brickW - 5, h: brickH,
        flashT: 0, breaking: false, breakT: 0
      });
    }
  }
  return bricks;
}

function reflectBall(ball: Ball, nx: number, ny: number, speed: number) {
  const dot = ball.vx * nx + ball.vy * ny;
  ball.vx -= 2 * dot * nx;
  ball.vy -= 2 * dot * ny;
  // Normalize to constant speed
  const len = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  ball.vx = (ball.vx / len) * speed;
  ball.vy = (ball.vy / len) * speed;
}

function drawBrick(ctx: CanvasRenderingContext2D, b: Brick, t: number) {
  if (b.breaking) {
    const a = Math.max(0, 1 - b.breakT);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.scale(1 + (1 - a) * 0.4, 1 + (1 - a) * 0.4);
    ctx.translate(-b.w / 2, -b.h / 2);
  }
  const [c1, c2] = BRICK_COLORS[b.colorRow];
  const flashAlpha = b.flashT > 0 ? b.flashT : 0;
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.roundRect(b.x + 3, b.y + 3, b.w, b.h, 4); ctx.fill();
  // Main gradient
  const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
  g.addColorStop(0, b.flashT > 0 ? "#ffffff" : c1);
  g.addColorStop(1, b.flashT > 0 ? c1 : c2);
  ctx.fillStyle = g;
  ctx.shadowColor = flashAlpha > 0 ? "#fff" : BRICK_GLOW[b.colorRow]; ctx.shadowBlur = 6 + flashAlpha * 10;
  ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 4); ctx.fill();
  ctx.shadowBlur = 0;
  // Inner highlight
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath(); ctx.roundRect(b.x + 3, b.y + 2, b.w - 6, b.h * 0.45, [3, 3, 0, 0]); ctx.fill();
  // Rim
  ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 4); ctx.stroke();
  // HP indicator for multi-hit
  if (b.maxHp > 1) {
    for (let i = 0; i < b.maxHp; i++) {
      ctx.fillStyle = i < b.hp ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.3)";
      ctx.beginPath(); ctx.arc(b.x + b.w / 2 - (b.maxHp - 1) * 6 + i * 12, b.y + b.h - 7, 3.5, 0, TWO_PI); ctx.fill();
    }
  }
  // Bomb indicator
  if (b.special === "bomb") {
    ctx.fillStyle = "rgba(255,80,0,0.9)"; ctx.font = `bold ${b.h * 0.55}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("💣", b.x + b.w / 2, b.y + b.h / 2);
  }
  // Powerup indicator
  if (b.special === "powerup") {
    const icons: Record<PowerupType, string> = { wide: "↔", multi: "⚡", laser: "🔫", slow: "❄" };
    ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.font = `bold ${b.h * 0.5}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(icons[b.powerupType!] ?? "★", b.x + b.w / 2, b.y + b.h / 2);
    // Twinkle
    const tw = Math.sin(t * 6 + b.col) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255,255,200,${tw * 0.25})`; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 4); ctx.fill();
  }
  if (b.breaking) ctx.restore();
  void t;
}

export default function BreakoutGame() {
  const TICKETS = useGameTickets("breakout", RAW_TICKETS);
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

  const [phase, setPhase] = useState<Phase>("select");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [muted, setMuted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [balance, setBalance] = useState(START_BALANCE);
  const [activeItems, setActiveItems] = useState<string[]>([]);
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
    setBest(prev => { const n = Math.max(prev, finalScore); localStorage.setItem(BEST_KEY, String(n)); return n; });
    if (outcome === "win") { audioRef.current.goal(); const t = ticketRef.current; if (t) setBalance(prev => { const n = prev + t.prize; localStorage.setItem(BALANCE_KEY, String(n)); return n; }); setPhase("won"); }
    else { audioRef.current.gameOver(); setPhase("lost"); }
  }, []);

  const endRef = useRef(finishGame);
  useEffect(() => { endRef.current = finishGame; }, [finishGame]);

  const breakBrick = useCallback((g: GameState, b: Brick, ball: Ball | null, w: number) => {
    b.breaking = true; b.breakT = 0;
    const cx = b.x + b.w / 2; const cy = b.y + b.h / 2;
    const c = BRICK_COLORS[b.colorRow][0];
    for (let i = 0; i < (b.special === "bomb" ? 18 : 8); i++) {
      const a = Math.random() * TWO_PI; const spd = 80 + Math.random() * 200;
      g.particles.push({ x: cx, y: cy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 0.8, max: 0.8, color: c, r: 2 + Math.random() * 4 });
    }
    if (b.special === "bomb") {
      audioRef.current.bomb(); g.shakeT = 0.35;
      g.bricks.forEach(other => {
        if (other === b || other.breaking) return;
        if (Math.abs(other.x - b.x) < b.w * 2 && Math.abs(other.y - b.y) < b.h * 3) {
          other.hp = 0; breakBrick(g, other, null, w);
          g.score += 15; g.brokenCount++; setScore(g.score);
        }
      });
    }
    if (b.special === "powerup" && b.powerupType) {
      g.powerups.push({ x: cx, y: cy, vy: 110, type: b.powerupType, life: 8 });
    }
    audioRef.current.break_(b.special === "bomb");
    g.score += b.maxHp * 10; g.brokenCount++; setScore(g.score);
    g.goodFlashT = 0.15;
    if (g.score >= g.target) { endRef.current(g.score, "win"); }

    // Check if all bricks broken → new level
    const remaining = g.bricks.filter(bk => !bk.breaking && bk.hp > 0);
    if (remaining.length === 0) {
      g.level++;
      const newBricks = buildBricks(w, sizeRef.current.h, g.level);
      g.bricks = newBricks;
      // Speed up ball slightly
      g.balls.forEach(ball2 => {
        const spd = Math.sqrt(ball2.vx ** 2 + ball2.vy ** 2);
        const newSpd = Math.min(spd + 30, 600);
        const len = spd > 0 ? spd : 1;
        ball2.vx = (ball2.vx / len) * newSpd; ball2.vy = (ball2.vy / len) * newSpd;
      });
    }
    void ball;
  }, []);

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
      if (bar) { bar.style.width = `${ratio * 100}%`; bar.style.backgroundImage = ratio <= 0.25 ? "linear-gradient(to right,#e74c3c,#e67e22)" : "linear-gradient(to right,#9b59b6,#e74c3c)"; }
      if (g.timeLeft <= 0) { endRef.current(g.score, "time"); return; }
    }

    g.flashT = Math.max(0, g.flashT - dt); g.goodFlashT = Math.max(0, g.goodFlashT - dt);
    if (g.shakeT > 0) { g.shakeT -= dt; g.shakeX = (Math.random() - 0.5) * 10 * (g.shakeT / 0.35); g.shakeY = (Math.random() - 0.5) * 10 * (g.shakeT / 0.35); } else { g.shakeX = 0; g.shakeY = 0; }
    if (g.wideT > 0) { g.wideT -= dt; if (g.wideT <= 0) { g.paddleW = 80; setActiveItems(a => a.filter(x => x !== "wide")); } }
    if (g.laserT > 0) { g.laserT -= dt; if (g.laserT <= 0) setActiveItems(a => a.filter(x => x !== "laser")); }
    if (g.slowT > 0) { g.slowT -= dt; if (g.slowT <= 0) setActiveItems(a => a.filter(x => x !== "slow")); }

    // Paddle movement
    if (g.dragging) {
      g.paddleTargetX = Math.max(g.paddleW / 2, Math.min(w - g.paddleW / 2, g.dragX));
    }
    g.paddleX += (g.paddleTargetX - g.paddleX) * Math.min(1, dt * 14);

    const paddleY = h - 50;
    const ballSpeed = g.slowT > 0 ? 260 : 380 + g.level * 20;

    if (g.running) {
      // Laser
      if (g.laserT > 0) {
        g.laserFireT -= dt;
        if (g.laserFireT <= 0) {
          g.laserFireT = 0.18;
          g.lasers.push({ x: g.paddleX - 12, y: paddleY, h: h, life: 0.35 });
          g.lasers.push({ x: g.paddleX + 12, y: paddleY, h: h, life: 0.35 });
          audioRef.current.laser_();
          // Check laser hits
          for (const laser of g.lasers) {
            for (const b of g.bricks) {
              if (b.breaking || b.hp <= 0) continue;
              if (laser.x >= b.x && laser.x <= b.x + b.w && laser.y - laser.h < b.y + b.h) {
                b.hp--; b.flashT = 0.25;
                if (b.hp <= 0) breakBrick(g, b, null, w);
              }
            }
          }
        }
      }
      for (const l of g.lasers) l.life -= dt;
      g.lasers = g.lasers.filter(l => l.life > 0);

      // Powerup drops
      for (const pu of g.powerups) {
        pu.y += pu.vy * dt; pu.life -= dt;
        if (Math.abs(pu.x - g.paddleX) < g.paddleW / 2 + 14 && Math.abs(pu.y - paddleY) < 20) {
          pu.life = -1; audioRef.current.powerup();
          if (pu.type === "wide") { g.paddleW = 140; g.wideT = 10; setActiveItems(a => [...a.filter(x => x !== "wide"), "wide"]); }
          else if (pu.type === "multi") {
            const ball0 = g.balls[0];
            if (ball0) {
              g.balls.push({ x: ball0.x, y: ball0.y, vx: -ball0.vx * 0.8 + 80, vy: ball0.vy, r: ball0.r, trail: [] });
              g.balls.push({ x: ball0.x, y: ball0.y, vx: ball0.vx * 0.8 - 80, vy: ball0.vy, r: ball0.r, trail: [] });
            }
            setActiveItems(a => [...a.filter(x => x !== "multi"), "multi"]);
          }
          else if (pu.type === "laser") { g.laserT = 8; g.laserFireT = 0; setActiveItems(a => [...a.filter(x => x !== "laser"), "laser"]); }
          else if (pu.type === "slow") { g.slowT = 6; setActiveItems(a => [...a.filter(x => x !== "slow"), "slow"]); }
        }
      }
      g.powerups = g.powerups.filter(pu => pu.life > 0 && pu.y < h + 30);

      // Move balls
      for (const ball of g.balls) {
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 12) ball.trail.shift();
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        // Wall bounce
        if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); audioRef.current.bounce(false); }
        if (ball.x + ball.r > w) { ball.x = w - ball.r; ball.vx = -Math.abs(ball.vx); audioRef.current.bounce(false); }
        if (ball.y - ball.r < 50) { ball.y = 50 + ball.r; ball.vy = Math.abs(ball.vy); audioRef.current.bounce(false); }
        // Paddle collision
        if (ball.vy > 0 && ball.y + ball.r > paddleY - 8 && ball.y + ball.r < paddleY + 16 && ball.x > g.paddleX - g.paddleW / 2 - ball.r && ball.x < g.paddleX + g.paddleW / 2 + ball.r) {
          const hitPos = (ball.x - g.paddleX) / (g.paddleW / 2);
          const angle = hitPos * 1.1;
          const spd = ballSpeed;
          ball.vx = Math.sin(angle) * spd;
          ball.vy = -Math.abs(Math.cos(angle) * spd);
          ball.y = paddleY - 8 - ball.r;
          audioRef.current.paddle();
          g.goodFlashT = 0.1;
        }
        // Miss (fall off bottom)
        if (ball.y - ball.r > h + 20) {
          (ball as Ball & { dead?: boolean }).dead = true;
        }
        // Brick collision
        for (const b of g.bricks) {
          if (b.breaking || b.hp <= 0) continue;
          const bLeft = b.x; const bRight = b.x + b.w; const bTop = b.y; const bBot = b.y + b.h;
          if (ball.x + ball.r > bLeft && ball.x - ball.r < bRight && ball.y + ball.r > bTop && ball.y - ball.r < bBot) {
            b.hp--; b.flashT = 0.2;
            // Determine collision side
            const fromLeft = ball.x < bLeft + 8; const fromRight = ball.x > bRight - 8;
            const fromTop = ball.y < bTop + 8; const fromBot = ball.y > bBot - 8;
            if (fromTop || fromBot) { ball.vy *= -1; reflectBall(ball, 0, fromTop ? -1 : 1, ballSpeed); }
            else if (fromLeft || fromRight) { ball.vx *= -1; reflectBall(ball, fromLeft ? -1 : 1, 0, ballSpeed); }
            else { reflectBall(ball, 0, ball.vy < 0 ? 1 : -1, ballSpeed); }
            if (b.hp <= 0) breakBrick(g, b, ball, w);
            else audioRef.current.bounce(true);
            break;
          }
        }
      }
      g.balls = g.balls.filter(b => !(b as Ball & { dead?: boolean }).dead);
      if (g.balls.length === 0) { endRef.current(g.score, "time"); return; }
    }

    // Update bricks animation
    for (const b of g.bricks) {
      if (b.flashT > 0) b.flashT -= dt;
      if (b.breaking) { b.breakT = Math.min(1, b.breakT + dt * 3.5); }
    }

    // Update particles
    for (const p of g.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; }
    g.particles = g.particles.filter(p => p.life > 0);

    // ---- Render ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save(); ctx.translate(g.shakeX, g.shakeY);

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0a0015"); bg.addColorStop(0.6, "#120020"); bg.addColorStop(1, "#08000e");
    ctx.fillStyle = bg; ctx.fillRect(-4, -4, w + 8, h + 8);
    // Grid lines (subtle)
    ctx.strokeStyle = "rgba(100,50,150,0.07)"; ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 30) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = 0; gy < h; gy += 30) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

    // Ceiling bar
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, 55);
    ceilGrad.addColorStop(0, "#200040"); ceilGrad.addColorStop(1, "rgba(32,0,64,0)");
    ctx.fillStyle = ceilGrad; ctx.fillRect(-4, -4, w + 8, 55);
    ctx.strokeStyle = "rgba(180,100,255,0.4)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 50); ctx.lineTo(w, 50); ctx.stroke();

    // Lasers
    for (const l of g.lasers) {
      const la = Math.max(0, l.life / 0.35);
      const lg = ctx.createLinearGradient(l.x, l.y - l.h, l.x, l.y);
      lg.addColorStop(0, "rgba(255,0,100,0)"); lg.addColorStop(0.7, `rgba(255,100,200,${la * 0.6})`); lg.addColorStop(1, `rgba(255,200,255,${la})`);
      ctx.strokeStyle = lg; ctx.lineWidth = 4;
      ctx.shadowColor = "#ff40ff"; ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x, l.y - l.h); ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Power-up drops
    for (const pu of g.powerups) {
      const icons: Record<PowerupType, string> = { wide: "↔", multi: "⚡", laser: "🔫", slow: "❄" };
      const cols: Record<PowerupType, string> = { wide: "#f39c12", multi: "#2ecc71", laser: "#e74c3c", slow: "#3498db" };
      ctx.save(); ctx.translate(pu.x, pu.y);
      ctx.fillStyle = `rgba(0,0,0,0.6)`; ctx.beginPath(); ctx.roundRect(-14, -12, 28, 24, 6); ctx.fill();
      ctx.strokeStyle = cols[pu.type]; ctx.lineWidth = 2.5;
      ctx.shadowColor = cols[pu.type]; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.roundRect(-14, -12, 28, 24, 6); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = cols[pu.type]; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(icons[pu.type], 0, 1);
      ctx.restore();
    }

    // Bricks
    for (const b of g.bricks) {
      if (b.breaking && b.breakT >= 1) continue;
      drawBrick(ctx, b, t);
    }

    // Particles
    for (const p of g.particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TWO_PI); ctx.fill(); ctx.restore();
    }

    // Balls with trails
    for (const ball of g.balls) {
      for (let i = 0; i < ball.trail.length; i++) {
        const tp = ball.trail[i]; const a = (i / ball.trail.length) * 0.4;
        ctx.save(); ctx.globalAlpha = a;
        ctx.fillStyle = "#bb88ff"; ctx.beginPath(); ctx.arc(tp.x, tp.y, ball.r * (i / ball.trail.length) * 0.7, 0, TWO_PI); ctx.fill();
        ctx.restore();
      }
      const ballGrad = ctx.createRadialGradient(ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, ball.r * 0.05, ball.x, ball.y, ball.r);
      ballGrad.addColorStop(0, "#ffffff"); ballGrad.addColorStop(0.35, "#cc88ff"); ballGrad.addColorStop(0.8, "#7733bb"); ballGrad.addColorStop(1, "#330055");
      ctx.fillStyle = ballGrad;
      ctx.shadowColor = "rgba(180,100,255,0.8)"; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, TWO_PI); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.beginPath(); ctx.ellipse(ball.x - ball.r * 0.3, ball.y - ball.r * 0.32, ball.r * 0.24, ball.r * 0.15, -0.4, 0, TWO_PI); ctx.fill();
    }

    // Paddle
    const pGrad = ctx.createLinearGradient(g.paddleX - g.paddleW / 2, paddleY - 8, g.paddleX + g.paddleW / 2, paddleY + 8);
    pGrad.addColorStop(0, "#8844ee"); pGrad.addColorStop(0.5, "#cc88ff"); pGrad.addColorStop(1, "#6622cc");
    ctx.fillStyle = pGrad;
    ctx.shadowColor = "rgba(180,100,255,0.7)"; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.roundRect(g.paddleX - g.paddleW / 2, paddleY - 8, g.paddleW, 16, 8); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.roundRect(g.paddleX - g.paddleW / 2 + 4, paddleY - 6, g.paddleW - 8, 6, [4, 4, 0, 0]); ctx.fill();

    // Flash
    if (g.flashT > 0) { ctx.fillStyle = `rgba(200,50,50,${(g.flashT / 0.4) * 0.3})`; ctx.fillRect(-4, -4, w + 8, h + 8); }
    if (g.goodFlashT > 0) { ctx.fillStyle = `rgba(180,100,255,${(g.goodFlashT / 0.2) * 0.12})`; ctx.fillRect(-4, -4, w + 8, h + 8); }

    // Launch hint
    if (!g.launched && g.running) {
      const pulse = Math.sin(t * 4) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(200,150,255,${pulse * 0.75})`;
      ctx.font = "bold 13px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("TAP to launch!", w / 2, h - 90);
    }

    ctx.restore();
    if (g.running || g.particles.length > 0) rafRef.current = requestAnimationFrame(loop);
  }, [breakBrick]);

  const startLoop = useCallback(() => { cancelAnimationFrame(rafRef.current); if (gameRef.current) gameRef.current.lastTime = 0; rafRef.current = requestAnimationFrame(loop); }, [loop]);

  const launchBall = useCallback(() => {
    const g = gameRef.current; if (!g || !g.running || g.launched) return;
    g.launched = true;
    g.balls[0].vy = -(380 + g.level * 20); g.balls[0].vx = (Math.random() - 0.5) * 160;
  }, []);

  const playTicket = useCallback((t: Ticket) => {
    if (startingRef.current || t.price > balance) return; startingRef.current = true;
    setBalance(prev => { const n = prev - t.price; localStorage.setItem(BALANCE_KEY, String(n)); return n; });
    audioRef.current.start();
    setTicket(t);
    const { w, h } = sizeRef.current;
    const paddleW = 80; const paddleY = h - 50;
    gameRef.current = {
      bricks: buildBricks(w || 320, h || 600, 0),
      balls: [{ x: (w || 320) / 2, y: paddleY - 14, vx: 0, vy: 0, r: 8, trail: [] }],
      paddleX: (w || 320) / 2, paddleW, paddleTargetX: (w || 320) / 2,
      lasers: [], powerups: [], particles: [],
      score: 0, target: t.target, timeLeft: t.time, timeMax: t.time,
      running: true, lastTime: 0,
      launched: false,
      wideT: 0, laserT: 0, slowT: 0, laserFireT: 0,
      level: 0, brokenCount: 0,
      flashT: 0, goodFlashT: 0,
      shakeT: 0, shakeX: 0, shakeY: 0,
      dragging: false, dragX: (w || 320) / 2,
    };
    timeElapsedRef.current = 0;
    lastSecRef.current = t.time; setScore(0); setTimeLeft(t.time); setActiveItems([]);
    if (timerBarRef.current) timerBarRef.current.style.width = "100%";
    setPhase("playing"); startLoop();
  }, [balance, startLoop]);

  useEffect(() => { const audio = audioRef.current; return () => { cancelAnimationFrame(rafRef.current); audio.dispose(); }; }, []);
  const toggleMute = () => { audioRef.current.muted = !muted; setMuted(!muted); };

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{ background: "#0a0015" }}>
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3">
        <Link href="/games"><button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-purple-700/40 flex items-center justify-center text-purple-300 hover:text-white transition-colors"><ArrowLeft size={18} /></button></Link>
        <div className="flex flex-col items-center">
          <span className="text-[10px] tracking-[0.3em] text-purple-300/70 font-display uppercase">{phase === "playing" ? "BROKEN" : "HYPERBREAK"}</span>
          <span data-testid="text-score" className="font-display font-black text-4xl text-purple-300 leading-none drop-shadow-[0_0_18px_rgba(155,89,182,0.9)]">{score}</span>
          {phase === "playing" && <span className="text-[9px] tracking-widest text-purple-300/60 font-display uppercase mt-0.5">GOAL {target}</span>}
        </div>
        <button onClick={toggleMute} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-purple-700/40 flex items-center justify-center text-purple-300">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
      </div>

      {activeItems.length > 0 && phase === "playing" && (
        <div className="absolute top-[88px] left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
          {activeItems.includes("wide") && <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-yellow-500/20 border border-yellow-400/50 text-yellow-300">↔ WIDE</span>}
          {activeItems.includes("laser") && <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-red-500/20 border border-red-400/50 text-red-300">🔫 LASER</span>}
          {activeItems.includes("slow") && <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-blue-500/20 border border-blue-400/50 text-blue-300">❄ SLOW</span>}
          {activeItems.includes("multi") && <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-green-500/20 border border-green-400/50 text-green-300">⚡ MULTI</span>}
        </div>
      )}

      {phase === "playing" && (
        <div className={`absolute z-30 w-[72%] left-1/2 -translate-x-1/2 flex flex-col gap-2.5 ${activeItems.length > 0 ? "top-[116px]" : "top-[84px]"}`}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-widest text-purple-300/70 font-display uppercase">Score</span><span data-testid="text-progress" className="text-[11px] font-mono font-bold tabular-nums text-white/90">{score} / {target}</span></div>
            <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden border border-purple-700/20"><div data-testid="bar-progress" className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-500 shadow-[0_0_12px_rgba(180,50,255,0.7)] transition-[width] duration-300" style={{ width: `${target > 0 ? Math.min(100, (score / target) * 100) : 0}%` }} /></div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-widest text-white/40 font-display uppercase">Time</span><span data-testid="text-timer" className={`text-[11px] font-mono font-bold tabular-nums ${timeLeft <= 8 ? "text-red-400" : "text-white/70"}`}>{timeLeft}s</span></div>
            <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} data-testid="bar-timer" className="h-full rounded-full" style={{ width: "100%" }} /></div>
          </div>
        </div>
      )}

      <div ref={wrapRef} className="flex-1 relative"
        onPointerDown={(e) => {
          const g = gameRef.current; if (!g || !g.running) return;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          g.dragX = e.clientX - rect.left; g.dragging = true;
          if (!g.launched) launchBall();
        }}
        onPointerMove={(e) => { const g = gameRef.current; if (!g || !g.dragging) return; const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); g.dragX = e.clientX - rect.left; }}
        onPointerUp={() => { const g = gameRef.current; if (g) g.dragging = false; }}
        onPointerLeave={() => { const g = gameRef.current; if (g) g.dragging = false; }}>
        <canvas ref={canvasRef} className="absolute inset-0 touch-none" />
        {phase === "playing" && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-purple-300/35 font-display tracking-widest uppercase pointer-events-none">DRAG paddle · Collect power-ups</div>}
      </div>

      <AnimatePresence>{phase === "select" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col px-6 pt-16 pb-6 overflow-y-auto" style={{ background: "rgba(10,0,21,0.97)" }}>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <div className="text-4xl mb-2">🧱</div>
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-purple-400" /><span className="text-[11px] tracking-[0.4em] text-purple-400/60 uppercase">HyperBreak</span></div>
            <h1 className="font-display font-black text-2xl text-purple-300 mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/50 mb-4 max-w-[260px]">Classic brick-breaker with power-ups: Wide paddle, Laser beam, Multi-ball, Slow-mo. Hit bombs for chain explosions!</p>
            <div className="flex items-center gap-2 mb-5 px-4 py-2 rounded-xl bg-purple-700/10 border border-purple-700/30"><Coins size={14} className="text-purple-400" /><span data-testid="text-balance" className="text-sm font-mono font-bold text-purple-400">{balance.toLocaleString()} SKZ</span></div>
            <div className="w-full flex flex-col gap-2.5">
              {TICKETS.map(t => { const ok = t.price <= balance; return (
                <button key={t.id} disabled={!ok} onClick={() => ok && playTicket(t)} data-testid={`button-ticket-${t.id}`}
                  className={`w-full flex items-center justify-between rounded-2xl border p-3.5 transition-all ${ok ? "bg-purple-700/8 border-purple-700/30 hover:border-purple-500 active:scale-[0.98]" : "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed"}`}>
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