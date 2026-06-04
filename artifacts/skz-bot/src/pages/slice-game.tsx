import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Volume2, VolumeX, RotateCcw, Trophy, Coins, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "select" | "playing" | "won" | "lost";

interface Ticket {
  id: string;
  name: string;
  price: number;
  prize: number;
  target: number;
  time: number;
}

type ShapeType = "circle" | "rect" | "diamond" | "star";

interface SliceItem {
  id: number;
  kind: "slice" | "barrier";
  baseX: number; // smooth x (jitter computed from this)
  x: number; // rendered x
  prevX: number;
  size: number; // half-width for drawing
  color: string;
  shape: ShapeType;
  crossed: boolean; // fired the cut-line event?
  cutFrozen: boolean; // true once cut (x frozen)
  cutT: number; // 0→1 cut animation
  jitter: boolean; // barrier that briefly reverses direction
  jitterState: "waiting" | "reversing" | "done";
  jitterT: number; // remaining reverse seconds
}

interface PaintDrop {
  x: number;
  y: number;
  r: number;
  color: string;
  alpha: number;
  decay: number; // alpha/s
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  life: number;
  max: number;
}

interface GameState {
  items: SliceItem[];
  paintDrops: PaintDrop[];
  particles: Particle[];
  beltOffset: number;
  bladeY: number;
  bladeTarget: number;
  score: number;
  target: number;
  timeLeft: number;
  timeMax: number;
  scrollSpeed: number;
  spawnTimer: number;
  nextId: number;
  running: boolean;
  lastTime: number;
  shakeT: number;
  shakeMag: number;
  flashT: number;
  goodFlashT: number;
}

const BEST_KEY = "skz_slice_best";
const BALANCE_KEY = "skz_balance";
const START_BALANCE = 1000;
const TWO_PI = Math.PI * 2;

const TICKETS: Ticket[] = [
  { id: "rookie", name: "Rookie", price: 30, prize: 55, target: 8, time: 35 },
  { id: "bronze", name: "Bronze", price: 75, prize: 140, target: 12, time: 33 },
  { id: "silver", name: "Silver", price: 150, prize: 320, target: 16, time: 31 },
  { id: "gold", name: "Gold", price: 350, prize: 800, target: 20, time: 30 },
  { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 26, time: 28 },
];

const SLICE_COLORS = ["#FF6B9D", "#FFD93D", "#6BCB77", "#4ECDC4", "#FF6B35", "#C77DFF", "#4CC9F0", "#FF9F43"];
const SHAPES: ShapeType[] = ["circle", "rect", "diamond", "star"];

const getScrollSpeed = (score: number) => Math.min(560, 190 + score * 20);
const getBarrierProb = (score: number) => Math.min(0.42, 0.08 + score * 0.026);
const getJitterProb = (score: number) => (score >= 5 ? Math.min(0.38, (score - 5) * 0.07) : 0);

function drawStarPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  pts: number,
) {
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i / (pts * 2)) * TWO_PI - Math.PI / 2;
    i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a)) : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  shape: ShapeType,
  alpha = 1,
) {
  if (alpha <= 0) return;
  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.translate(x, y);

  const S = size;
  const O = S + 3; // outline size

  // Thick dark outline for cartoon look
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  if (shape === "circle") {
    ctx.beginPath(); ctx.arc(0, 0, O, 0, TWO_PI); ctx.fill();
  } else if (shape === "rect") {
    ctx.beginPath(); ctx.roundRect(-O, -O, O * 2, O * 2, 7); ctx.fill();
  } else if (shape === "diamond") {
    ctx.beginPath();
    ctx.moveTo(0, -O); ctx.lineTo(O, 0); ctx.lineTo(0, O); ctx.lineTo(-O, 0);
    ctx.closePath(); ctx.fill();
  } else {
    drawStarPath(ctx, 0, 0, O, O * 0.44, 5); ctx.fill();
  }

  // Vibrant flat fill
  ctx.fillStyle = color;
  if (shape === "circle") {
    ctx.beginPath(); ctx.arc(0, 0, S, 0, TWO_PI); ctx.fill();
  } else if (shape === "rect") {
    ctx.beginPath(); ctx.roundRect(-S, -S, S * 2, S * 2, 6); ctx.fill();
  } else if (shape === "diamond") {
    ctx.beginPath();
    ctx.moveTo(0, -S); ctx.lineTo(S, 0); ctx.lineTo(0, S); ctx.lineTo(-S, 0);
    ctx.closePath(); ctx.fill();
  } else {
    drawStarPath(ctx, 0, 0, S, S * 0.44, 5); ctx.fill();
  }

  // Top-left gloss highlight
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(-S * 0.18, -S * 0.28, S * 0.42, S * 0.26, -0.5, 0, TWO_PI);
  ctx.fill();
  // Tiny spec
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.arc(-S * 0.2, -S * 0.35, S * 0.1, 0, TWO_PI);
  ctx.fill();

  ctx.restore();
}

function drawBarrier(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  isJitter: boolean,
  jitterState: string,
  time: number,
) {
  ctx.save();
  ctx.translate(x, y);

  const w2 = size + 5;
  const h2 = size * 1.05;

  // Glow when jitter is reversing
  if (isJitter && jitterState === "reversing") {
    ctx.save();
    ctx.globalAlpha = 0.45 + Math.sin(time * 18) * 0.2;
    ctx.shadowColor = "#ff3333";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "#ff4444";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-w2 - 3, -h2 - 3, (w2 + 3) * 2, (h2 + 3) * 2, 7);
    ctx.stroke();
    ctx.restore();
  }

  // Body
  const bodyColor = isJitter ? "#5a0808" : "#282828";
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.roundRect(-w2, -h2, w2 * 2, h2 * 2, 5);
  ctx.fill();

  // Hazard stripe clip
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(-w2, -h2, w2 * 2, h2 * 2, 5);
  ctx.clip();
  const sc = isJitter ? "rgba(255,60,60,0.6)" : "rgba(255,220,0,0.65)";
  ctx.fillStyle = sc;
  const sw = 9;
  const totalW = w2 * 4 + h2 * 2;
  for (let sx = -w2 * 2; sx < totalW; sx += sw * 2) {
    ctx.beginPath();
    ctx.moveTo(sx, -h2);
    ctx.lineTo(sx + sw, -h2);
    ctx.lineTo(sx + sw - h2, h2);
    ctx.lineTo(sx - h2, h2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Border
  ctx.strokeStyle = isJitter ? "#ff5555" : "#666";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-w2, -h2, w2 * 2, h2 * 2, 5);
  ctx.stroke();

  // Spikes on top for real barriers
  if (!isJitter) {
    ctx.fillStyle = "#555";
    const spikePositions = [-w2 * 0.55, 0, w2 * 0.55];
    for (const sx of spikePositions) {
      ctx.beginPath();
      ctx.moveTo(sx - 5, -h2);
      ctx.lineTo(sx + 5, -h2);
      ctx.lineTo(sx, -h2 - 11);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#777";
    for (const sx of spikePositions) {
      ctx.beginPath();
      ctx.moveTo(sx - 1, -h2);
      ctx.lineTo(sx, -h2 - 9);
      ctx.closePath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#999";
      ctx.stroke();
    }
  } else {
    // Jagged edges for jitter barrier
    ctx.fillStyle = "#ff3333";
    ctx.beginPath();
    for (let jx = -w2; jx <= w2 - 6; jx += 6) {
      ctx.moveTo(jx, -h2);
      ctx.lineTo(jx + 3, -h2 - 7);
      ctx.lineTo(jx + 6, -h2);
    }
    ctx.fill();
  }

  ctx.restore();
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  private ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, glideTo?: number) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol: number, cutoff: number, delay = 0) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.8);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = cutoff;
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  // Satisfying slice whoosh + thud
  slice() {
    this.noise(0.1, 0.55, 3000);
    this.tone(200, 0.1, "sine", 0.4, 0, 70);
    this.tone(1200, 0.06, "triangle", 0.25);
  }

  // Barrier hit — harsh crash
  hit() {
    this.noise(0.5, 0.75, 9000);
    this.tone(120, 0.35, "sawtooth", 0.55);
    this.tone(200, 0.25, "square", 0.4, 0.03);
  }

  tick(urgent = false) {
    this.tone(urgent ? 900 : 650, 0.07, "square", urgent ? 0.25 : 0.14);
  }

  start() {
    [392, 523, 659].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.32, i * 0.06));
  }

  gameOver() {
    [392, 311, 261, 196].forEach((f, i) => this.tone(f, 0.3, "sawtooth", 0.28, i * 0.12));
  }

  goal() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.24, "triangle", 0.38, i * 0.07));
    this.tone(262, 0.5, "sine", 0.2);
  }

  dispose() {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.master = null;
    }
  }
}

export default function SliceGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);
  const audioRef = useRef<AudioEngine>(new AudioEngine());
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 });
  const holdingRef = useRef(false);

  const lastSecRef = useRef<number>(0);
  const timerBarRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("select");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [muted, setMuted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [balance, setBalance] = useState(START_BALANCE);
  const [lostReason, setLostReason] = useState<"barrier" | "time">("barrier");

  const target = ticket?.target ?? 0;

  useEffect(() => {
    setBest(Number(localStorage.getItem(BEST_KEY) || "0"));
    const b = localStorage.getItem(BALANCE_KEY);
    setBalance(b === null ? START_BALANCE : Number(b));
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    sizeRef.current = { w, h, dpr };
  }, []);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [resize]);

  const newGameState = useCallback((t: Ticket): GameState => ({
    items: [],
    paintDrops: [],
    particles: [],
    beltOffset: 0,
    bladeY: 40,
    bladeTarget: 40,
    score: 0,
    target: t.target,
    timeLeft: t.time,
    timeMax: t.time,
    scrollSpeed: 190,
    spawnTimer: 1.2, // first item after 1.2s
    nextId: 0,
    running: true,
    lastTime: 0,
    shakeT: 0,
    shakeMag: 0,
    flashT: 0,
    goodFlashT: 0,
  }), []);

  const spawnItem = useCallback((id: number, score: number, w: number): SliceItem => {
    const isBarrier = Math.random() < getBarrierProb(score);
    const isJitter = isBarrier && Math.random() < getJitterProb(score);
    const spawnX = w + 55;
    if (isBarrier) {
      return {
        id, kind: "barrier",
        baseX: spawnX, x: spawnX, prevX: spawnX + 1,
        size: 28 + Math.random() * 10,
        color: "#2a2a2a", shape: "rect",
        crossed: false, cutFrozen: false, cutT: 0,
        jitter: isJitter,
        jitterState: "waiting", jitterT: 0,
      };
    }
    const ci = Math.floor(Math.random() * SLICE_COLORS.length);
    const si = Math.floor(Math.random() * SHAPES.length);
    return {
      id, kind: "slice",
      baseX: spawnX, x: spawnX, prevX: spawnX + 1,
      size: 22 + Math.random() * 9,
      color: SLICE_COLORS[ci], shape: SHAPES[si],
      crossed: false, cutFrozen: false, cutT: 0,
      jitter: false, jitterState: "waiting", jitterT: 0,
    };
  }, []);

  const burstPaint = (g: GameState, x: number, y: number, color: string) => {
    // Flying particles (short-lived)
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * TWO_PI;
      const sp = 80 + Math.random() * 420;
      g.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3 + Math.random() * 5, color, life: 0.35 + Math.random() * 0.5, max: 1 });
    }
    // Persistent paint drops (long-lived screen paint)
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * TWO_PI;
      const dist = Math.random() < 0.45 ? Math.random() * 35 : Math.random() * 220;
      const px = x + Math.cos(a) * dist;
      const py = y + Math.sin(a) * dist;
      const r = 4 + Math.random() * 22;
      const lt = 6 + Math.random() * 9;
      g.paintDrops.push({ x: px, y: py, r, color, alpha: 0.68 + Math.random() * 0.18, decay: (0.68 + Math.random() * 0.18) / lt });
    }
    if (g.paintDrops.length > 220) g.paintDrops.splice(0, g.paintDrops.length - 220);
  };

  const loop = useCallback((time: number) => {
    const g = gameRef.current;
    const canvas = canvasRef.current;
    if (!g || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h, dpr } = sizeRef.current;

    // Layout constants
    const BELT_TOP = h * 0.36;
    const BELT_H = h * 0.32;
    const BELT_BOT = BELT_TOP + BELT_H;
    const BELT_CY = BELT_TOP + BELT_H * 0.5;
    const CUT_X = w * 0.28;
    const BLADE_IDLE_Y = 38;
    const BLADE_CUT_Y = BELT_TOP + BELT_H * 0.58;
    const BLADE_TOP_Y = 52; // bottom of housing

    if (!g.lastTime) g.lastTime = time;
    const dt = Math.min((time - g.lastTime) / 1000, 0.05);
    g.lastTime = time;

    // Countdown
    if (g.running) {
      g.timeLeft = Math.max(0, g.timeLeft - dt);
      const sec = Math.ceil(g.timeLeft);
      if (sec !== lastSecRef.current) {
        lastSecRef.current = sec;
        setTimeLeft(sec);
        if (sec <= 5 && sec > 0) audioRef.current.tick(sec <= 3);
      }
      const ratio = Math.max(0, Math.min(1, g.timeLeft / g.timeMax));
      const bar = timerBarRef.current;
      if (bar) {
        bar.style.width = `${ratio * 100}%`;
        bar.style.backgroundImage =
          ratio <= 0.28
            ? "linear-gradient(to right, rgb(239,68,68), rgb(251,146,60))"
            : "linear-gradient(to right, hsl(170 80% 45%), hsl(190 70% 50%))";
      }
      if (g.timeLeft <= 0) endRef.current(g.score, "time");
    }

    // Blade spring (fast, responsive)
    g.bladeTarget = holdingRef.current ? BLADE_CUT_Y : BLADE_IDLE_Y;
    g.bladeY += (g.bladeTarget - g.bladeY) * Math.min(1, dt * 24);

    // Belt offset (conveyor animation)
    g.beltOffset -= g.scrollSpeed * dt;

    // Dynamic scroll speed
    g.scrollSpeed = getScrollSpeed(g.score);

    // Spawn timer
    if (g.running) {
      g.spawnTimer -= dt;
      if (g.spawnTimer <= 0) {
        g.items.push(spawnItem(g.nextId++, g.score, w));
        const gap = 155 + Math.random() * 130;
        g.spawnTimer = gap / g.scrollSpeed;
      }
    }

    // Update items
    for (const item of g.items) {
      item.prevX = item.x;

      if (item.cutFrozen) {
        item.cutT = Math.min(1, item.cutT + dt / 0.42);
        continue;
      }

      const spd = g.scrollSpeed;

      if (item.jitter) {
        if (item.jitterState === "waiting" && item.baseX < w * 0.62 && item.baseX > CUT_X + 110) {
          item.jitterState = "reversing";
          item.jitterT = 0.28 + Math.random() * 0.12;
        }
        if (item.jitterState === "reversing") {
          item.jitterT -= dt;
          item.baseX += spd * 0.52 * dt; // move RIGHT (backward)
          if (item.jitterT <= 0) item.jitterState = "done";
        } else {
          item.baseX -= spd * (item.jitterState === "done" ? 1.28 : 1.0) * dt;
        }
      } else {
        item.baseX -= spd * dt;
      }
      item.x = item.baseX;

      // Crossing detection (once per item)
      if (!item.crossed && item.prevX >= CUT_X && item.x < CUT_X) {
        item.crossed = true;
        const bladeActive = g.bladeY >= BELT_TOP + 5;

        if (item.kind === "slice") {
          if (bladeActive) {
            item.cutFrozen = true;
            item.x = CUT_X; // freeze at cut line
            g.score += 1;
            setScore(g.score);
            burstPaint(g, CUT_X, BELT_CY, item.color);
            audioRef.current.slice();
            g.goodFlashT = 0.22;
            g.shakeT = 0.08; g.shakeMag = 3;
            if (g.score >= g.target) endRef.current(g.score, "win");
          }
        } else {
          // Barrier
          if (bladeActive) {
            audioRef.current.hit();
            burstPaint(g, CUT_X, BELT_CY, "#ff3333");
            burstPaint(g, CUT_X, BELT_CY, "#ff8800");
            g.shakeT = 0.7; g.shakeMag = 30;
            g.flashT = 0.75;
            endRef.current(g.score, "barrier");
          }
        }
      }
    }

    // Remove off-screen + fully animated items
    g.items = g.items.filter((item) => item.x > -80 && item.cutT < 1.0);

    // Particles
    for (const p of g.particles) {
      p.vx *= 0.91;
      p.vy = p.vy * 0.91 + 230 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    g.particles = g.particles.filter((p) => p.life > 0);

    // Paint drops (fade)
    for (const d of g.paintDrops) {
      d.alpha = Math.max(0, d.alpha - d.decay * dt);
    }
    g.paintDrops = g.paintDrops.filter((d) => d.alpha > 0.01);

    if (g.shakeT > 0) g.shakeT -= dt;
    if (g.flashT > 0) g.flashT -= dt;
    if (g.goodFlashT > 0) g.goodFlashT -= dt;

    // ---- Render ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, w, h);
    const bgGrad = ctx.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, w * 0.9);
    bgGrad.addColorStop(0, "rgba(20,20,60,0.5)");
    bgGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Screen shake
    let sx = 0; let sy = 0;
    if (g.shakeT > 0) {
      const m = g.shakeMag * Math.max(0, g.shakeT / 0.7);
      sx = (Math.random() * 2 - 1) * m;
      sy = (Math.random() * 2 - 1) * m;
    }
    ctx.save();
    ctx.translate(sx, sy);

    // Persistent paint drops (below belt, on background)
    for (const d of g.paintDrops) {
      ctx.save();
      ctx.globalAlpha = d.alpha * 0.85;
      ctx.fillStyle = d.color;
      ctx.shadowColor = d.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }

    // Belt shadow (depth)
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, BELT_TOP - 8, w, BELT_H + 16);

    // Belt surface — white/light gray conveyor
    ctx.fillStyle = "#ebebeb";
    ctx.fillRect(0, BELT_TOP, w, BELT_H);

    // Belt groove lines (moving)
    const GROOVE_W = 4;
    const GROOVE_SP = 38;
    const bMod = ((g.beltOffset % GROOVE_SP) + GROOVE_SP) % GROOVE_SP;
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    for (let bx = -GROOVE_SP + bMod; bx < w + GROOVE_SP; bx += GROOVE_SP) {
      ctx.fillRect(bx, BELT_TOP, GROOVE_W, BELT_H);
    }

    // Belt top/bottom rails
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0, BELT_TOP, w, 3);
    ctx.fillRect(0, BELT_BOT - 3, w, 3);
    // Top highlight
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(0, BELT_TOP, w, 2);

    // Belt right roller
    const ROLLER_R = BELT_H / 2 + 5;
    ctx.fillStyle = "#555";
    ctx.beginPath(); ctx.arc(w - 5, BELT_CY, ROLLER_R, 0, TWO_PI); ctx.fill();
    ctx.fillStyle = "#777";
    ctx.beginPath(); ctx.arc(w - 5, BELT_CY, ROLLER_R - 8, 0, TWO_PI); ctx.fill();
    ctx.fillStyle = "#999";
    ctx.beginPath(); ctx.arc(w - 5, BELT_CY, 6, 0, TWO_PI); ctx.fill();

    // Cut line indicator (vertical)
    if (g.bladeY < BELT_TOP + 5) {
      // Blade retracted — faint dashed line
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = "rgba(100,200,255,0.18)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(CUT_X, BELT_TOP - 2); ctx.lineTo(CUT_X, BELT_BOT + 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    } else {
      // Blade active — solid red glow
      ctx.save();
      ctx.shadowColor = "rgba(255,80,0,0.9)";
      ctx.shadowBlur = 16;
      ctx.strokeStyle = "rgba(255,120,0,0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(CUT_X, BELT_TOP); ctx.lineTo(CUT_X, BELT_BOT); ctx.stroke();
      ctx.restore();
    }

    // Conveyor items
    for (const item of g.items) {
      if (item.cutFrozen && item.cutT > 0) {
        // Cut animation — two halves separating
        const t = item.cutT;
        const alpha = Math.max(0, 1 - t * 1.3);
        const leftOff = { x: -t * 28, y: t * 55 };
        const rightOff = { x: t * 22, y: t * 75 };

        if (item.kind === "slice") {
          // Left half
          ctx.save();
          ctx.beginPath(); ctx.rect(-10, 0, CUT_X + 10, h); ctx.clip();
          ctx.translate(leftOff.x, leftOff.y);
          drawShape(ctx, CUT_X, BELT_CY, item.size, item.color, item.shape, alpha);
          ctx.restore();
          // Right half
          ctx.save();
          ctx.beginPath(); ctx.rect(CUT_X, 0, w, h); ctx.clip();
          ctx.translate(rightOff.x, rightOff.y);
          drawShape(ctx, CUT_X, BELT_CY, item.size, item.color, item.shape, alpha);
          ctx.restore();
        }
        continue;
      }

      if (item.cutFrozen) continue;

      if (item.kind === "slice") {
        drawShape(ctx, item.x, BELT_CY, item.size, item.color, item.shape);
      } else {
        drawBarrier(ctx, item.x, BELT_CY, item.size, item.jitter, item.jitterState, time / 1000);
      }
    }

    // Guide rails for blade (thin vertical rods)
    const RAIL_X = [CUT_X - 14, CUT_X + 14];
    for (const rx of RAIL_X) {
      const railGrad = ctx.createLinearGradient(rx - 2, 0, rx + 2, 0);
      railGrad.addColorStop(0, "#444");
      railGrad.addColorStop(0.5, "#888");
      railGrad.addColorStop(1, "#444");
      ctx.fillStyle = railGrad;
      ctx.fillRect(rx - 2, 55, 4, BELT_TOP - 60);
    }

    // Blade housing (top mount)
    const houseGrad = ctx.createLinearGradient(CUT_X - 24, 0, CUT_X + 24, 0);
    houseGrad.addColorStop(0, "#333");
    houseGrad.addColorStop(0.4, "#666");
    houseGrad.addColorStop(0.5, "#888");
    houseGrad.addColorStop(0.6, "#666");
    houseGrad.addColorStop(1, "#333");
    ctx.fillStyle = houseGrad;
    ctx.beginPath(); ctx.roundRect(CUT_X - 24, 0, 48, 56, [0, 0, 6, 6]); ctx.fill();
    // Housing bottom lip
    ctx.fillStyle = "#555";
    ctx.fillRect(CUT_X - 22, 48, 44, 8);
    // Housing screws
    [CUT_X - 16, CUT_X + 16].forEach((bx) => {
      ctx.fillStyle = "#222";
      ctx.beginPath(); ctx.arc(bx, 14, 4, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = "#666";
      ctx.beginPath(); ctx.arc(bx, 14, 2, 0, TWO_PI); ctx.fill();
    });
    // Housing label
    ctx.fillStyle = "rgba(255,220,80,0.7)";
    ctx.fillRect(CUT_X - 12, 30, 24, 3);

    // Blade body (silver rectangular blade)
    if (g.bladeY > BLADE_TOP_Y) {
      const bladeLen = g.bladeY - BLADE_TOP_Y - 25;
      if (bladeLen > 0) {
        const bladeGrad = ctx.createLinearGradient(CUT_X - 13, 0, CUT_X + 13, 0);
        bladeGrad.addColorStop(0, "#888");
        bladeGrad.addColorStop(0.25, "#ccc");
        bladeGrad.addColorStop(0.5, "#eee");
        bladeGrad.addColorStop(0.75, "#ccc");
        bladeGrad.addColorStop(1, "#888");
        ctx.fillStyle = bladeGrad;
        ctx.fillRect(CUT_X - 13, BLADE_TOP_Y, 26, bladeLen);
        // Left edge dark
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(CUT_X - 13, BLADE_TOP_Y, 2, bladeLen);
        ctx.fillRect(CUT_X + 11, BLADE_TOP_Y, 2, bladeLen);
      }

      // Blade tip (cleaver wedge shape)
      const tipY = g.bladeY;
      const active = g.bladeY >= BELT_TOP;
      ctx.save();
      if (active) {
        ctx.shadowColor = "rgba(255,100,0,0.9)";
        ctx.shadowBlur = 22;
      }
      const tipGrad = ctx.createLinearGradient(CUT_X - 13, 0, CUT_X + 13, 0);
      tipGrad.addColorStop(0, "#777");
      tipGrad.addColorStop(0.2, "#ccc");
      tipGrad.addColorStop(0.5, "#fff");
      tipGrad.addColorStop(0.8, "#ccc");
      tipGrad.addColorStop(1, "#777");
      ctx.fillStyle = tipGrad;
      ctx.beginPath();
      ctx.moveTo(CUT_X - 13, tipY - 28);
      ctx.lineTo(CUT_X + 13, tipY - 28);
      ctx.lineTo(CUT_X + 2, tipY);
      ctx.lineTo(CUT_X, tipY + 4);
      ctx.lineTo(CUT_X - 2, tipY);
      ctx.closePath();
      ctx.fill();
      // Tip edge highlight
      ctx.strokeStyle = active ? "rgba(255,200,100,0.9)" : "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(CUT_X - 13, tipY - 28);
      ctx.lineTo(CUT_X, tipY + 4);
      ctx.lineTo(CUT_X + 13, tipY - 28);
      ctx.stroke();
      ctx.restore();
    }

    // Flying paint particles
    for (const p of g.particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TWO_PI); ctx.fill();
      ctx.restore();
    }

    ctx.restore(); // end shake

    // Red flash overlay on barrier hit
    if (g.flashT > 0) {
      ctx.fillStyle = `rgba(220,20,20,${Math.max(0, g.flashT / 0.75) * 0.42})`;
      ctx.fillRect(0, 0, w, h);
    }
    // Teal/green flash on successful cut
    if (g.goodFlashT > 0) {
      ctx.fillStyle = `rgba(0,220,150,${Math.max(0, g.goodFlashT / 0.22) * 0.12})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (g.running || g.particles.length > 0 || g.items.some((i) => i.cutFrozen && i.cutT < 1)) {
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [spawnItem]);

  const startLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (gameRef.current) gameRef.current.lastTime = 0;
    rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const startingRef = useRef(false);

  const playTicket = useCallback((t: Ticket) => {
    if (startingRef.current) return;
    if (t.price > balance) return;
    startingRef.current = true;
    holdingRef.current = false;
    setBalance((prev) => {
      const next = prev - t.price;
      localStorage.setItem(BALANCE_KEY, String(next));
      return next;
    });
    audioRef.current.start();
    setTicket(t);
    gameRef.current = newGameState(t);
    lastSecRef.current = t.time;
    setScore(0);
    setTimeLeft(t.time);
    if (timerBarRef.current) timerBarRef.current.style.width = "100%";
    setPhase("playing");
    startLoop();
  }, [balance, newGameState, startLoop]);

  const finishGame = useCallback((finalScore: number, outcome: "win" | "barrier" | "time") => {
    const g = gameRef.current;
    if (!g || !g.running) return;
    g.running = false;
    startingRef.current = false;
    holdingRef.current = false;
    setBest((prev) => {
      const next = Math.max(prev, finalScore);
      localStorage.setItem(BEST_KEY, String(next));
      return next;
    });
    if (outcome === "win") {
      audioRef.current.goal();
      const t = ticketRef.current;
      if (t) {
        setBalance((prev) => {
          const next = prev + t.prize;
          localStorage.setItem(BALANCE_KEY, String(next));
          return next;
        });
      }
      setPhase("won");
    } else {
      audioRef.current.gameOver();
      setLostReason(outcome === "barrier" ? "barrier" : "time");
      setPhase("lost");
    }
  }, []);

  const ticketRef = useRef<Ticket | null>(null);
  useEffect(() => { ticketRef.current = ticket; }, [ticket]);

  const endRef = useRef(finishGame);
  useEffect(() => { endRef.current = finishGame; }, [finishGame]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (phase !== "playing") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    holdingRef.current = true;
  }, [phase]);

  const handlePointerUp = useCallback(() => {
    holdingRef.current = false;
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); holdingRef.current = true; } };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") holdingRef.current = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    return () => { cancelAnimationFrame(rafRef.current); audio.dispose(); };
  }, []);

  const refillBalance = useCallback(() => {
    setBalance(START_BALANCE);
    localStorage.setItem(BALANCE_KEY, String(START_BALANCE));
  }, []);

  const toggleMute = () => { audioRef.current.muted = !muted; setMuted(!muted); };

  const speedMultiplier = gameRef.current ? +(gameRef.current.scrollSpeed / 190).toFixed(1) : 1;

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden bg-[#0a0a1a] select-none">
      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3">
        <Link href="/games">
          <button
            data-testid="button-back-arena"
            className="w-10 h-10 rounded-full bg-white/5 backdrop-blur border border-white/10 flex items-center justify-center text-white/80 hover:text-teal-300 hover:border-teal-400/40 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
        </Link>

        <div className="flex flex-col items-center -mt-1">
          <span className="text-[10px] tracking-[0.3em] text-teal-400/70 font-display uppercase">
            {phase === "playing" ? "Sliced" : "Perfect Slice"}
          </span>
          <span
            data-testid="text-score"
            className="font-display font-black text-4xl text-white leading-none drop-shadow-[0_0_18px_rgba(0,220,180,0.55)]"
          >
            {score}
          </span>
          {phase === "playing" && (
            <span className="text-[9px] tracking-[0.25em] text-teal-300/80 font-display uppercase mt-0.5">
              GOAL {target}
            </span>
          )}
        </div>

        <button
          data-testid="button-toggle-mute"
          onClick={toggleMute}
          className="w-10 h-10 rounded-full bg-white/5 backdrop-blur border border-white/10 flex items-center justify-center text-white/80 hover:text-teal-300 hover:border-teal-400/40 transition-colors"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Progress + Timer bars */}
      {phase === "playing" && (
        <div className="absolute top-[84px] left-1/2 -translate-x-1/2 z-30 w-[68%] flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[9px] tracking-[0.25em] text-teal-400/90 font-display uppercase">Progress</span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[9px] text-yellow-400/80 font-display font-bold">
                  <Zap size={9} /> ×{speedMultiplier}
                </span>
                <span data-testid="text-progress" className="text-[11px] font-display font-bold tracking-wider tabular-nums text-white/90">
                  {score} / {target}
                </span>
              </div>
            </div>
            <div className="relative w-full h-2.5 rounded-full bg-white/10 overflow-hidden border border-teal-500/20">
              <div
                data-testid="bar-progress"
                className="h-full rounded-full bg-gradient-to-r from-teal-500 via-cyan-400 to-teal-300 shadow-[0_0_14px_rgba(0,220,200,0.6)] transition-[width] duration-300 ease-out"
                style={{ width: `${target > 0 ? Math.min(100, (score / target) * 100) : 0}%` }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[9px] tracking-[0.25em] text-white/40 font-display uppercase">Time</span>
              <span
                data-testid="text-timer"
                className={`text-[11px] font-display font-bold tracking-wider tabular-nums ${timeLeft <= 5 ? "text-red-400" : "text-white/80"}`}
              >
                {timeLeft}s
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div ref={timerBarRef} data-testid="bar-timer" className="h-full rounded-full" style={{ width: "100%" }} />
            </div>
          </div>
        </div>
      )}

      {/* Game canvas */}
      <div
        ref={wrapRef}
        className="flex-1 relative"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <canvas ref={canvasRef} data-testid="canvas-slice" className="absolute inset-0 touch-none" />
        {phase === "playing" && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 pointer-events-none">
            <span className="text-[10px] text-teal-400/45 font-display tracking-[0.25em] uppercase">HOLD to cut</span>
            <span className="text-[10px] text-red-400/45 font-display tracking-[0.25em] uppercase">RELEASE to dodge</span>
          </div>
        )}
      </div>

      {/* Select overlay */}
      <AnimatePresence>
        {phase === "select" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col bg-black/78 backdrop-blur-md px-6 pt-16 pb-6 overflow-y-auto"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05 }}
              className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto"
            >
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={14} className="text-teal-400" />
                <span className="text-[11px] tracking-[0.4em] text-white/50 font-display uppercase">Perfect Slice</span>
              </div>
              <h1 className="font-display font-black text-2xl leading-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-teal-300 to-cyan-400 mb-3">
                CHOOSE YOUR TICKET
              </h1>
              <p className="text-xs text-white/40 mb-4 max-w-[260px]">
                Hold to lower the blade and slice. Release before iron barriers pass. Watch for decoys that reverse direction!
              </p>

              <div className="flex items-center gap-2 mb-5 px-4 py-2 rounded-xl bg-teal-400/10 border border-teal-400/30">
                <Coins size={14} className="text-teal-300" />
                <span data-testid="text-balance" className="text-sm font-display font-bold text-teal-300 tracking-wide">
                  {balance.toLocaleString()} SKZ
                </span>
              </div>

              <div className="w-full flex flex-col gap-2.5">
                {TICKETS.map((t) => {
                  const affordable = t.price <= balance;
                  return (
                    <button
                      key={t.id}
                      disabled={!affordable}
                      onClick={() => affordable && playTicket(t)}
                      data-testid={`button-ticket-${t.id}`}
                      className={`w-full flex items-center justify-between rounded-2xl border p-3.5 transition-all ${
                        affordable
                          ? "bg-white/5 border-white/10 hover:border-teal-400/50 active:scale-[0.98]"
                          : "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-display font-bold text-base text-white tracking-wide">{t.name}</span>
                        <span className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">
                          Goal {t.target} · {t.time}s
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="flex items-center gap-1 text-teal-300 font-display font-bold text-sm">
                          <Coins size={12} /> {t.prize.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Entry {t.price}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 mt-5 text-[11px] text-white/40">
                <Trophy size={11} className="text-teal-400" />
                <span data-testid="text-best">Best {best}</span>
              </div>

              {balance < 30 ? (
                <button
                  onClick={refillBalance}
                  data-testid="button-refill"
                  className="mt-5 w-full py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-400 text-black font-display font-bold text-sm tracking-widest shadow-[0_0_24px_rgba(0,200,180,0.55)] active:scale-95 transition-transform"
                >
                  🎁 GET 1,000 FREE CHIPS
                </button>
              ) : (
                <button
                  onClick={refillBalance}
                  data-testid="button-refill"
                  className="mt-3 text-[10px] text-white/25 hover:text-white/50 transition-colors underline underline-offset-2"
                >
                  Low on chips? Get 1,000 free
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Won overlay */}
      <AnimatePresence>
        {phase === "won" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/78 backdrop-blur-md px-8"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0.4 }}
              className="w-full max-w-[300px] flex flex-col items-center text-center"
            >
              <span data-testid="text-result" className="text-xs tracking-[0.4em] font-display uppercase mb-2 text-teal-300">
                Master Slicer
              </span>
              <div className="font-display font-black text-5xl text-transparent bg-clip-text bg-gradient-to-br from-teal-300 via-cyan-200 to-white mb-1 drop-shadow-[0_0_24px_rgba(0,220,200,0.7)]">
                +{ticket?.prize.toLocaleString() ?? 0}
              </div>
              <span className="text-sm text-white/50 mb-6">SKZ prize claimed</span>

              <div className="w-full grid grid-cols-2 gap-3 mb-7">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1">
                    <Trophy size={11} className="text-teal-400" /> Sliced
                  </div>
                  <span data-testid="text-final-score" className="font-display font-bold text-xl text-white">{score}</span>
                </div>
                <div className="bg-teal-400/10 border border-teal-400/30 rounded-2xl p-3 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1">
                    <Coins size={11} className="text-teal-300" /> Balance
                  </div>
                  <span data-testid="text-balance-final" className="font-display font-bold text-xl text-teal-300">
                    {balance.toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setPhase("select")}
                data-testid="button-replay"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-400 text-black font-display font-bold tracking-widest shadow-[0_0_30px_rgba(0,200,180,0.5)] flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform"
              >
                <RotateCcw size={18} /> PLAY AGAIN
              </button>
              <Link href="/games"><button data-testid="button-exit" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Back to Arena</button></Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lost overlay */}
      <AnimatePresence>
        {phase === "lost" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/78 backdrop-blur-md px-8"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0.35 }}
              className="w-full max-w-[300px] flex flex-col items-center text-center"
            >
              <span data-testid="text-result" className="text-xs tracking-[0.4em] font-display uppercase mb-2 text-red-400">
                {lostReason === "time" ? "Time Up" : "You Hit"}
              </span>
              <div data-testid="text-loss-amount" className="font-display font-black text-5xl text-transparent bg-clip-text bg-gradient-to-br from-red-400 to-white/70 mb-1">
                -{ticket?.price ?? 0}
              </div>
              <span className="text-sm text-white/50 mb-6">SKZ entry lost</span>

              <div className="w-full grid grid-cols-2 gap-3 mb-7">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1">
                    <Trophy size={11} className="text-teal-400" /> Reached
                  </div>
                  <span data-testid="text-final-score" className="font-display font-bold text-xl text-white">{score} / {target}</span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1">
                    <Coins size={11} className="text-teal-300" /> Balance
                  </div>
                  <span data-testid="text-balance-final" className="font-display font-bold text-xl text-white">{balance.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => setPhase("select")}
                data-testid="button-replay"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-400 text-black font-display font-bold tracking-widest shadow-[0_0_30px_rgba(0,200,180,0.5)] flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform"
              >
                <RotateCcw size={18} /> TRY AGAIN
              </button>
              <Link href="/games"><button data-testid="button-exit" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Back to Arena</button></Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
