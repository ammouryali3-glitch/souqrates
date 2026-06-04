import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Volume2, VolumeX, RotateCcw, Trophy, Zap, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "select" | "playing" | "won" | "lost";

interface Ticket {
  id: string;
  name: string;
  price: number; // entry cost in SKZ
  prize: number; // payout on win
  target: number; // gems required to win
  time: number; // seconds allowed
}

interface Gem {
  ring: number;
  angle: number;
  hue: number;
  born: number;
}

interface Obstacle {
  ring: number;
  angle: number;
  arc: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  hue: number;
  size: number;
}

interface GameState {
  playerRing: number;
  playerAngle: number;
  playerSpeed: number;
  playerDisplayR: number;
  gems: Gem[];
  obstacles: Obstacle[];
  obstacleDir: number;
  obstacleSpeed: number;
  baseSpeed: number;
  particles: Particle[];
  trail: { x: number; y: number }[];
  score: number;
  target: number;
  timeLeft: number;
  timeMax: number;
  running: boolean;
  lastTime: number;
  shakeT: number;
  shakeMag: number;
  hitT: number;
  flipT: number;
  nextFlipScore: number;
  jumpGrace: number;
  jumpCooldown: number;
}

const BEST_KEY = "skz_orbit_best";
const BALANCE_KEY = "skz_balance";
const START_BALANCE = 1000;

const RINGS = 3;
const GEM_COUNT = 2;
const OBSTACLE_CAP = 7;
const TWO_PI = Math.PI * 2;
const GEM_HUES = [280, 320, 48];

// ---- Ticket tiers: pick one to play. Collect the target number of gems (the
// interactive progress line) before the timer runs out to win the prize; crash
// into an obstacle or run out of time and you lose the entry. (UI-only mock economy.)
const TICKETS: Ticket[] = [
  { id: "rookie", name: "Rookie", price: 25, prize: 45, target: 6, time: 30 },
  { id: "bronze", name: "Bronze", price: 50, prize: 95, target: 9, time: 32 },
  { id: "silver", name: "Silver", price: 120, prize: 255, target: 12, time: 34 },
  { id: "gold", name: "Gold", price: 300, prize: 680, target: 16, time: 36 },
  { id: "diamond", name: "Diamond", price: 750, prize: 1850, target: 20, time: 40 },
];

// smallest signed angular difference in [-PI, PI]
const angDiff = (a: number, b: number) => {
  let d = (a - b) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
};

// ---- Audio engine (Web Audio API, no asset files) ----
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

  private noise(dur: number, vol: number, cutoff: number) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  // ring jump — quick electric blip
  jump() {
    this.tone(420, 0.14, "square", 0.18, 0, 760);
    this.tone(210, 0.1, "sine", 0.12);
  }

  // gem pickup — bright chime, pitch climbs with the run
  collect(score: number) {
    const semis = [0, 4, 7, 11, 12, 14, 16, 19, 21, 24];
    const step = semis[Math.min(score, semis.length - 1)];
    const freq = 587.33 * Math.pow(2, step / 12);
    this.tone(freq, 0.22, "triangle", 0.42);
    this.tone(freq * 2, 0.18, "sine", 0.2);
  }

  // direction reversal warning — two-tone alarm
  warn() {
    this.tone(880, 0.12, "square", 0.22);
    this.tone(660, 0.16, "square", 0.2, 0.12);
  }

  hit() {
    this.noise(0.4, 0.5, 900);
    this.tone(140, 0.5, "sawtooth", 0.3, 0, 60);
  }

  gameOver() {
    [392, 311, 261, 196].forEach((f, i) => this.tone(f, 0.3, "sawtooth", 0.25, i * 0.12));
  }

  tick(urgent = false) {
    this.tone(urgent ? 920 : 660, 0.07, "square", urgent ? 0.22 : 0.13);
  }

  goal() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.24, "triangle", 0.34, i * 0.07));
    this.tone(261.6, 0.5, "sine", 0.2);
  }

  start() {
    [392, 523, 659].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.3, i * 0.06));
  }

  dispose() {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.master = null;
    }
  }
}

const makeGem = (obstacles: Obstacle[]): Gem => {
  for (let tries = 0; tries < 24; tries++) {
    const ring = Math.floor(Math.random() * RINGS);
    const angle = Math.random() * TWO_PI;
    const bad = obstacles.some((o) => o.ring === ring && Math.abs(angDiff(angle, o.angle)) < o.arc / 2 + 0.28);
    if (bad) continue;
    return { ring, angle, hue: GEM_HUES[Math.floor(Math.random() * GEM_HUES.length)], born: 0 };
  }
  return { ring: Math.floor(Math.random() * RINGS), angle: Math.random() * TWO_PI, hue: 48, born: 0 };
};

// Spawn an obstacle while keeping a safe gap around the player's current
// ring+angle so it can never materialise directly on top of the player.
const makeObstacle = (avoidRing: number, avoidAngle: number): Obstacle => {
  for (let tries = 0; tries < 24; tries++) {
    const ring = Math.floor(Math.random() * RINGS);
    const angle = Math.random() * TWO_PI;
    if (ring === avoidRing && Math.abs(angDiff(angle, avoidAngle)) < 0.9) continue;
    return { ring, angle, arc: 0.26 + Math.random() * 0.12 };
  }
  return { ring: (avoidRing + 1) % RINGS, angle: Math.random() * TWO_PI, arc: 0.3 };
};

export default function OrbitGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);
  const audioRef = useRef<AudioEngine>(new AudioEngine());
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 });

  const lastSecRef = useRef<number>(0);
  const timerBarRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("select");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [muted, setMuted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [balance, setBalance] = useState(START_BALANCE);
  const [lostReason, setLostReason] = useState<"crash" | "time">("crash");
  const [flipFlash, setFlipFlash] = useState<{ key: number } | null>(null);

  const target = ticket?.target ?? 0;

  useEffect(() => {
    const stored = Number(localStorage.getItem(BEST_KEY) || "0");
    setBest(stored);
    const storedBal = localStorage.getItem(BALANCE_KEY);
    setBalance(storedBal === null ? START_BALANCE : Number(storedBal));
  }, []);

  // Canvas sizing with DPR
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

  const center = useCallback(() => {
    const { w, h } = sizeRef.current;
    return { cx: w / 2, cy: h * 0.56 };
  }, []);

  const ringRadius = useCallback((i: number) => {
    const { w, h } = sizeRef.current;
    const outer = Math.min(w * 0.42, h * 0.3);
    const facts = [0.5, 0.75, 1.0];
    return outer * facts[i];
  }, []);

  const newGameState = useCallback(
    (t: Ticket): GameState => {
      const startAngle = -Math.PI / 2;
      const idx = Math.max(0, TICKETS.findIndex((x) => x.id === t.id));
      const obstacleCount = 2 + Math.min(2, idx);
      const obstacles: Obstacle[] = [];
      for (let i = 0; i < obstacleCount; i++) obstacles.push(makeObstacle(0, startAngle));
      const gems: Gem[] = [];
      for (let i = 0; i < GEM_COUNT; i++) gems.push(makeGem(obstacles));
      return {
        playerRing: 0,
        playerAngle: startAngle,
        playerSpeed: 1.4,
        playerDisplayR: ringRadius(0),
        gems,
        obstacles,
        obstacleDir: -1,
        obstacleSpeed: 0.95 + idx * 0.1,
        baseSpeed: 0.95 + idx * 0.1,
        particles: [],
        trail: [],
        score: 0,
        target: t.target,
        timeLeft: t.time,
        timeMax: t.time,
        running: true,
        lastTime: 0,
        shakeT: 0,
        shakeMag: 0,
        hitT: 0,
        flipT: 0,
        nextFlipScore: 4,
        jumpGrace: 0,
        jumpCooldown: 0,
      };
    },
    [ringRadius],
  );

  const burst = (g: GameState, x: number, y: number, hue: number, n: number, power: number) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TWO_PI;
      const sp = power * (0.4 + Math.random() * 0.9);
      g.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.6 + Math.random() * 0.5,
        max: 1,
        hue,
        size: 1.5 + Math.random() * 2.5,
      });
    }
  };

  const loop = useCallback(
    (time: number) => {
      const g = gameRef.current;
      const canvas = canvasRef.current;
      if (!g || !canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { w, h, dpr } = sizeRef.current;
      const { cx, cy } = center();

      if (!g.lastTime) g.lastTime = time;
      const dt = Math.min((time - g.lastTime) / 1000, 0.05);
      g.lastTime = time;

      // Countdown timer
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
              : "linear-gradient(to right, hsl(190 95% 55%), hsl(262 83% 58%))";
        }
        if (g.timeLeft <= 0) endRef.current(g.score, "time");
      }

      // ---- Update motion ----
      if (g.running) {
        g.playerAngle = (g.playerAngle + g.playerSpeed * dt) % TWO_PI;
        g.obstacleSpeed = Math.min(3.5, g.baseSpeed + g.score * 0.07);
        for (const o of g.obstacles) o.angle = (o.angle + g.obstacleDir * g.obstacleSpeed * dt + TWO_PI) % TWO_PI;
        if (g.jumpGrace > 0) g.jumpGrace = Math.max(0, g.jumpGrace - dt);
        if (g.jumpCooldown > 0) g.jumpCooldown = Math.max(0, g.jumpCooldown - dt);
      }

      // player display radius eases toward the active ring
      g.playerDisplayR += (ringRadius(g.playerRing) - g.playerDisplayR) * Math.min(1, dt * 16);

      // trail
      const pr = ringRadius(g.playerRing);
      const px = cx + Math.cos(g.playerAngle) * g.playerDisplayR;
      const py = cy + Math.sin(g.playerAngle) * g.playerDisplayR;
      g.trail.push({ x: px, y: py });
      if (g.trail.length > 16) g.trail.shift();

      // ---- Collisions ----
      if (g.running) {
        const playerHalf = 12 / pr;
        // obstacles — a short landing grace lets the player slip through the arc
        // they jumped onto; grace is shorter than the jump cooldown so it can
        // never be chained into permanent invulnerability by spamming taps.
        if (g.jumpGrace <= 0) {
          for (const o of g.obstacles) {
            if (o.ring !== g.playerRing) continue;
            if (Math.abs(angDiff(g.playerAngle, o.angle)) < o.arc / 2 + playerHalf) {
              audioRef.current.hit();
              burst(g, px, py, 0, 26, 320);
              g.shakeT = 0.5;
              g.shakeMag = 22;
              g.hitT = 0.5;
              endRef.current(g.score, "crash");
              break;
            }
          }
        }
        // gems
        if (g.running) {
          for (let i = 0; i < g.gems.length; i++) {
            const gem = g.gems[i];
            if (gem.ring !== g.playerRing) continue;
            if (Math.abs(angDiff(g.playerAngle, gem.angle)) < 0.16 + playerHalf) {
              const gr = ringRadius(gem.ring);
              const gx = cx + Math.cos(gem.angle) * gr;
              const gy = cy + Math.sin(gem.angle) * gr;
              burst(g, gx, gy, gem.hue, 18, 240);
              g.score += 1;
              audioRef.current.collect(g.score);
              setScore(g.score);

              // direction-flip trap at score milestones
              if (g.score >= g.nextFlipScore && g.score < g.target) {
                g.obstacleDir *= -1;
                g.flipT = 1.1;
                g.nextFlipScore += 4;
                if (g.obstacles.length < OBSTACLE_CAP) g.obstacles.push(makeObstacle(g.playerRing, g.playerAngle));
                audioRef.current.warn();
                setFlipFlash({ key: Date.now() });
              }

              if (g.score >= g.target) {
                endRef.current(g.score, "win");
                break;
              }
              g.gems[i] = makeGem(g.obstacles);
            }
          }
        }
      }

      // ---- Particles ----
      for (const p of g.particles) {
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      g.particles = g.particles.filter((p) => p.life > 0);

      if (g.shakeT > 0) g.shakeT -= dt;
      if (g.hitT > 0) g.hitT -= dt;
      if (g.flipT > 0) g.flipT -= dt;

      // ---- Render ----
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, w, h);

      // faint center glow
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, ringRadius(2) * 1.4);
      glow.addColorStop(0, "rgba(34,211,238,0.10)");
      glow.addColorStop(0.5, "rgba(124,58,237,0.05)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      let sx = 0;
      let sy = 0;
      if (g.shakeT > 0) {
        const m = g.shakeMag * Math.max(0, g.shakeT / 0.5);
        sx = (Math.random() * 2 - 1) * m;
        sy = (Math.random() * 2 - 1) * m;
      }

      ctx.save();
      ctx.translate(sx, sy);
      ctx.lineCap = "round";

      // rings
      for (let i = 0; i < RINGS; i++) {
        const r = ringRadius(i);
        const active = i === g.playerRing;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TWO_PI);
        ctx.strokeStyle = active ? "rgba(34,211,238,0.55)" : "rgba(80,120,160,0.22)";
        ctx.lineWidth = active ? 2.5 : 1.5;
        ctx.shadowColor = active ? "rgba(34,211,238,0.9)" : "rgba(34,211,238,0.3)";
        ctx.shadowBlur = active ? 16 : 6;
        ctx.stroke();
        ctx.restore();
      }

      // center core
      const corePulse = 1 + Math.sin(time / 320) * 0.12;
      ctx.save();
      ctx.shadowColor = "rgba(34,211,238,0.9)";
      ctx.shadowBlur = 24;
      ctx.fillStyle = "rgba(190,250,255,0.95)";
      ctx.beginPath();
      ctx.arc(cx, cy, 5 * corePulse, 0, TWO_PI);
      ctx.fill();
      ctx.restore();

      // obstacles (neon arcs)
      ctx.globalCompositeOperation = "lighter";
      for (const o of g.obstacles) {
        const r = ringRadius(o.ring);
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, o.angle - o.arc / 2, o.angle + o.arc / 2);
        ctx.strokeStyle = "rgba(255,60,80,0.85)";
        ctx.lineWidth = 11;
        ctx.shadowColor = "rgba(255,40,70,0.95)";
        ctx.shadowBlur = 18;
        ctx.stroke();
        // bright inner core
        ctx.beginPath();
        ctx.arc(cx, cy, r, o.angle - o.arc / 2, o.angle + o.arc / 2);
        ctx.strokeStyle = "rgba(255,210,210,0.9)";
        ctx.lineWidth = 3;
        ctx.shadowBlur = 0;
        ctx.stroke();
        ctx.restore();
      }

      // gems (rotating diamonds)
      for (const gem of g.gems) {
        const r = ringRadius(gem.ring);
        const gx = cx + Math.cos(gem.angle) * r;
        const gy = cy + Math.sin(gem.angle) * r;
        const pulse = 1 + Math.sin(time / 200 + gem.angle * 4) * 0.18;
        const s = 8 * pulse;
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(time / 600 + gem.angle);
        ctx.shadowColor = `hsla(${gem.hue}, 100%, 65%, 0.95)`;
        ctx.shadowBlur = 20;
        ctx.fillStyle = `hsl(${gem.hue}, 100%, 68%)`;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.72, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.72, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.22, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
      }

      // particles
      for (const p of g.particles) {
        const a = Math.max(0, p.life / p.max);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.shadowColor = `hsla(${p.hue}, 100%, 65%, 0.9)`;
        ctx.shadowBlur = 12;
        ctx.fillStyle = `hsl(${p.hue}, 100%, ${p.hue === 0 ? 60 : 70}%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
      }

      // player trail
      for (let i = 0; i < g.trail.length; i++) {
        const t2 = g.trail[i];
        const a = (i / g.trail.length) * 0.5;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = "rgba(34,211,238,0.8)";
        ctx.shadowColor = "rgba(34,211,238,0.9)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(t2.x, t2.y, 3 + (i / g.trail.length) * 4, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
      }

      // player dot
      if (g.running || g.particles.length > 0) {
        ctx.save();
        ctx.shadowColor = "rgba(34,211,238,1)";
        ctx.shadowBlur = 22;
        ctx.fillStyle = "#e6fbff";
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, TWO_PI);
        ctx.fill();
        ctx.strokeStyle = "rgba(34,211,238,0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.restore();

      // hit flash overlay
      if (g.hitT > 0) {
        ctx.fillStyle = `rgba(255,30,60,${Math.max(0, g.hitT / 0.5) * 0.4})`;
        ctx.fillRect(0, 0, w, h);
      }
      // flip flash overlay (cyan sweep)
      if (g.flipT > 0) {
        ctx.fillStyle = `rgba(124,58,237,${Math.max(0, g.flipT / 1.1) * 0.18})`;
        ctx.fillRect(0, 0, w, h);
      }

      // Keep animating while playing or while particles settle, then stop.
      if (g.running || g.particles.length > 0) {
        rafRef.current = requestAnimationFrame(loop);
      }
    },
    [center, ringRadius],
  );

  const startLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (gameRef.current) gameRef.current.lastTime = 0;
    rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const startingRef = useRef(false);

  const playTicket = useCallback(
    (t: Ticket) => {
      if (startingRef.current) return; // guard against rapid double-tap
      if (t.price > balance) return; // can't afford
      startingRef.current = true;
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
      setFlipFlash(null);
      setTimeLeft(t.time);
      if (timerBarRef.current) timerBarRef.current.style.width = "100%";
      setPhase("playing");
      startLoop();
    },
    [balance, newGameState, startLoop],
  );

  const finishGame = useCallback((finalScore: number, outcome: "win" | "crash" | "time") => {
    const g = gameRef.current;
    if (!g || !g.running) return; // idempotent: ignore duplicate settlement
    g.running = false;
    startingRef.current = false;
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
      setLostReason(outcome);
      setPhase("lost");
    }
  }, []);

  // Active ticket mirrored in a ref so finishGame can read it without a dependency.
  const ticketRef = useRef<Ticket | null>(null);
  useEffect(() => {
    ticketRef.current = ticket;
  }, [ticket]);

  // Keep a stable ref so the rAF loop can end the game without re-creating the loop.
  const endRef = useRef(finishGame);
  useEffect(() => {
    endRef.current = finishGame;
  }, [finishGame]);

  const jump = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.running) return;
    if (g.jumpCooldown > 0) return; // rate-limit taps so grace can't be chained
    g.playerRing = (g.playerRing + 1) % RINGS;
    g.jumpGrace = 0.18; // brief slip-through on landing
    g.jumpCooldown = 0.32; // must exceed jumpGrace to bound max invulnerability
    audioRef.current.jump();
  }, []);

  const handleTap = useCallback(() => {
    if (phase === "playing") jump();
  }, [phase, jump]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowUp") {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleTap]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      cancelAnimationFrame(rafRef.current);
      audio.dispose();
    };
  }, []);

  const refillBalance = useCallback(() => {
    setBalance(START_BALANCE);
    localStorage.setItem(BALANCE_KEY, String(START_BALANCE));
  }, []);

  const toggleMute = () => {
    audioRef.current.muted = !muted;
    setMuted(!muted);
  };

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden bg-black select-none">
      {/* HUD top bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3">
        <Link href="/games">
          <button
            data-testid="button-back-arena"
            className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:border-cyan-400/50 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
        </Link>

        <div className="flex flex-col items-center -mt-1">
          <span className="text-[10px] tracking-[0.3em] text-white/40 font-display uppercase">Gems</span>
          <span data-testid="text-score" className="font-display font-black text-4xl text-white leading-none drop-shadow-[0_0_18px_rgba(34,211,238,0.5)]">
            {score}
          </span>
          {phase === "playing" && (
            <span className="text-[9px] tracking-[0.25em] text-cyan-300/80 font-display uppercase mt-0.5">GOAL {target}</span>
          )}
        </div>

        <button
          data-testid="button-toggle-mute"
          onClick={toggleMute}
          className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:border-cyan-400/50 transition-colors"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Interactive progress line + countdown timer */}
      {phase === "playing" && (
        <div className="absolute top-[84px] left-1/2 -translate-x-1/2 z-30 w-[68%] flex flex-col gap-2.5">
          {/* Progress line: advances with every gem collected toward the goal */}
          <div className="flex flex-col gap-1">
            <div className="w-full flex items-center justify-between px-0.5">
              <span className="text-[9px] tracking-[0.25em] text-cyan-300/90 font-display uppercase">Progress</span>
              <span data-testid="text-progress" className="text-[11px] font-display font-bold tracking-wider tabular-nums text-white/90">
                {score} / {target}
              </span>
            </div>
            <div className="relative w-full h-2.5 rounded-full bg-white/10 overflow-hidden border border-cyan-400/20">
              <div
                data-testid="bar-progress"
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-300 to-violet-500 shadow-[0_0_14px_rgba(34,211,238,0.6)] transition-[width] duration-300 ease-out"
                style={{ width: `${target > 0 ? Math.min(100, (score / target) * 100) : 0}%` }}
              />
            </div>
          </div>
          {/* Countdown timer (collect the goal before it empties) */}
          <div className="flex flex-col gap-1">
            <div className="w-full flex items-center justify-between px-0.5">
              <span className="text-[9px] tracking-[0.25em] text-white/40 font-display uppercase">Time</span>
              <span
                data-testid="text-timer"
                className={`text-[11px] font-display font-bold tracking-wider tabular-nums ${
                  timeLeft <= 5 ? "text-red-400" : "text-white/80"
                }`}
              >
                {timeLeft}s
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                ref={timerBarRef}
                data-testid="bar-timer"
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500"
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Direction-flip warning flash */}
      <AnimatePresence>
        {flipFlash && (
          <motion.div
            key={flipFlash.key}
            initial={{ opacity: 0, scale: 0.6, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.25, y: -24 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => setFlipFlash((f) => (f && f.key === flipFlash.key ? null : f))}
            className="absolute top-[42%] left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <span className="font-display font-black text-3xl text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300 drop-shadow-[0_0_24px_rgba(124,58,237,0.9)]">
              REVERSE!
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas play area */}
      <div ref={wrapRef} className="flex-1 relative" onPointerDown={handleTap}>
        <canvas ref={canvasRef} data-testid="canvas-orbit" className="absolute inset-0 touch-none" />
        {phase === "playing" && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[11px] text-white/30 font-display tracking-[0.3em] uppercase pointer-events-none">
            Tap to switch orbit
          </div>
        )}
      </div>

      {/* Ticket selection overlay */}
      <AnimatePresence>
        {phase === "select" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col bg-black/80 backdrop-blur-md px-6 pt-16 pb-6 overflow-y-auto"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05 }}
              className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto"
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap size={15} className="text-cyan-300" />
                <span className="text-[11px] tracking-[0.4em] text-white/50 font-display uppercase">Orbit Dash</span>
              </div>
              <h1 className="font-display font-black text-2xl leading-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-cyan-300 to-violet-400 mb-3">
                CHOOSE YOUR TICKET
              </h1>

              {/* Balance */}
              <div className="flex items-center gap-2 mb-5 px-4 py-2 rounded-xl bg-cyan-400/10 border border-cyan-400/30">
                <Coins size={14} className="text-cyan-300" />
                <span className="text-sm font-display font-bold text-cyan-300 tracking-wide" data-testid="text-balance">
                  {balance.toLocaleString()} SKZ
                </span>
              </div>

              {/* Tickets */}
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
                          ? "bg-white/5 border-white/10 hover:border-cyan-400/50 active:scale-[0.98]"
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
                        <span className="flex items-center gap-1 text-cyan-300 font-display font-bold text-sm">
                          <Coins size={12} /> {t.prize.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Entry {t.price}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 mt-5 text-[11px] text-white/40">
                <Trophy size={11} className="text-cyan-300" />
                <span data-testid="text-best">Best {best}</span>
              </div>

              {balance < 30 ? (
                <button
                  onClick={refillBalance}
                  data-testid="button-refill"
                  className="mt-5 w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-display font-bold text-sm tracking-widest shadow-[0_0_24px_rgba(34,211,238,0.5)] active:scale-95 transition-transform"
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

      {/* Win overlay */}
      <AnimatePresence>
        {phase === "won" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md px-8"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0.4 }}
              className="w-full max-w-[300px] flex flex-col items-center text-center"
            >
              <span className="text-xs tracking-[0.4em] font-display uppercase mb-2 text-cyan-300" data-testid="text-result">
                You Win
              </span>
              <div className="font-display font-black text-5xl text-transparent bg-clip-text bg-gradient-to-br from-cyan-300 via-sky-200 to-violet-400 mb-1 drop-shadow-[0_0_24px_rgba(34,211,238,0.6)]">
                +{ticket?.prize.toLocaleString() ?? 0}
              </div>
              <span className="text-sm text-white/50 mb-6">SKZ prize claimed</span>

              <div className="w-full grid grid-cols-2 gap-3 mb-7">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1">
                    <Zap size={11} className="text-cyan-300" /> Gems
                  </div>
                  <span className="font-display font-bold text-xl text-white" data-testid="text-final-score">{score}</span>
                </div>
                <div className="bg-cyan-400/10 border border-cyan-400/30 rounded-2xl p-3 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1">
                    <Coins size={11} className="text-cyan-300" /> Balance
                  </div>
                  <span className="font-display font-bold text-xl text-cyan-300" data-testid="text-balance-final">{balance.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => setPhase("select")}
                data-testid="button-replay"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-display font-bold tracking-widest shadow-[0_0_30px_rgba(34,211,238,0.4)] flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform"
              >
                <RotateCcw size={18} /> PLAY AGAIN
              </button>
              <Link href="/games">
                <button data-testid="button-exit" className="text-sm text-white/50 hover:text-white transition-colors font-medium">
                  Back to Arena
                </button>
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lose overlay */}
      <AnimatePresence>
        {phase === "lost" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md px-8"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0.35 }}
              className="w-full max-w-[300px] flex flex-col items-center text-center"
            >
              <span data-testid="text-result" className="text-xs tracking-[0.4em] font-display uppercase mb-2 text-red-400">
                {lostReason === "time" ? "Time Up" : "You Lost"}
              </span>
              <div className="font-display font-black text-5xl text-transparent bg-clip-text bg-gradient-to-br from-red-400 to-white/70 mb-1" data-testid="text-loss-amount">
                -{ticket?.price ?? 0}
              </div>
              <span className="text-sm text-white/50 mb-6">SKZ entry lost</span>

              <div className="w-full grid grid-cols-2 gap-3 mb-7">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1">
                    <Zap size={11} className="text-cyan-300" /> Reached
                  </div>
                  <span className="font-display font-bold text-xl text-white" data-testid="text-final-score">{score} / {target}</span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1">
                    <Coins size={11} className="text-cyan-300" /> Balance
                  </div>
                  <span className="font-display font-bold text-xl text-white" data-testid="text-balance-final">{balance.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => setPhase("select")}
                data-testid="button-replay"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-display font-bold tracking-widest shadow-[0_0_30px_rgba(34,211,238,0.4)] flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform"
              >
                <RotateCcw size={18} /> TRY AGAIN
              </button>
              <Link href="/games">
                <button data-testid="button-exit" className="text-sm text-white/50 hover:text-white transition-colors font-medium">
                  Back to Arena
                </button>
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
