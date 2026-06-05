import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Volume2, VolumeX, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";
import { GAME_TICKETS } from "@/lib/tickets-data";

type Phase = "select" | "playing" | "won" | "lost";

interface Ticket {
  id: string;
  name: string;
  price: number;
  prize: number;
  target: number; // knives to plant successfully = the win goal
  time: number;
  preKnives: number; // knives already on disc at game start
}

interface PlantedKnife {
  relAngle: number; // angle in disc-local frame
}

interface Apple {
  relAngle: number;
  collected: boolean;
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
  discAngle: number;
  discSpeed: number; // signed rad/s (+ = clockwise)
  targetSpeed: number; // speed we ease toward
  speedChangeTimer: number;
  plantedKnives: PlantedKnife[];
  apples: Apple[];
  flyingKnife: { progress: number } | null;
  particles: Particle[];
  score: number;
  target: number;
  knifeCount: number; // remaining throws in hand
  timeLeft: number;
  timeMax: number;
  running: boolean;
  lastTime: number;
  shakeT: number;
  shakeMag: number;
  crashT: number; // red flash timer
  knockT: number; // disc wobble after knife embeds
}

const BEST_KEY = "skz_knife_best";
const BALANCE_KEY = "skz_balance";
const START_BALANCE = 1000;
const TWO_PI = Math.PI * 2;
const BLADE_LEN = 36;
const HANDLE_LEN = 48;
const THROW_DURATION = 0.22; // seconds knife takes to travel to disc
const COL_THRESH = 0.22; // radians — knife-knife collision radius
const APPLE_THRESH = 0.30; // radians — apple collection radius
const APPLE_COUNT = 2;
const APPLE_BONUS = 5; // bonus seconds on apple hit

const RAW_TICKETS: Ticket[] = GAME_TICKETS.knife;

const angDiff = (a: number, b: number) => {
  let d = (a - b) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
};

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
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
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
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
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

  // Satisfying dull wood-thud on knife embedding
  thuck() {
    this.noise(0.18, 0.5, 700);
    this.tone(90, 0.14, "sine", 0.55, 0, 40);
    this.tone(250, 0.06, "triangle", 0.18);
  }

  // Harsh metallic clash on knife-knife collision
  clash() {
    this.noise(0.55, 0.72, 6000);
    this.tone(1320, 0.06, "square", 0.4);
    this.tone(990, 0.12, "sawtooth", 0.35, 0.02);
    this.tone(660, 0.2, "sawtooth", 0.25, 0.05);
  }

  // Bright chime on apple collection
  apple() {
    this.tone(1046, 0.18, "triangle", 0.48);
    this.tone(1318, 0.16, "triangle", 0.38, 0.04);
    this.tone(1568, 0.12, "triangle", 0.28, 0.08);
  }

  tick(urgent = false) {
    this.tone(urgent ? 900 : 650, 0.07, "square", urgent ? 0.25 : 0.14);
  }

  start() {
    [392, 523, 659].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.3, i * 0.06));
  }

  gameOver() {
    [392, 311, 261, 196].forEach((f, i) => this.tone(f, 0.3, "sawtooth", 0.28, i * 0.12));
  }

  goal() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.24, "triangle", 0.38, i * 0.07));
    this.tone(262, 0.5, "sine", 0.22);
  }

  dispose() {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.master = null;
    }
  }
}

// Draw a knife at origin. +y = blade direction (into disc), -y = handle direction (outside disc).
// Call with ctx already translated to disc-edge point and rotated to relAngle.
function drawKnife(ctx: CanvasRenderingContext2D) {
  // Crossguard
  const gGrad = ctx.createLinearGradient(-5.5, -4, 5.5, 0);
  gGrad.addColorStop(0, "#777");
  gGrad.addColorStop(0.5, "#ccc");
  gGrad.addColorStop(1, "#777");
  ctx.fillStyle = gGrad;
  ctx.fillRect(-5.5, -4, 11, 4);

  // Blade (into disc: +y direction)
  const bGrad = ctx.createLinearGradient(-3, 0, 3, 0);
  bGrad.addColorStop(0, "#888");
  bGrad.addColorStop(0.3, "#eee");
  bGrad.addColorStop(0.7, "#ddd");
  bGrad.addColorStop(1, "#7a7a7a");
  ctx.fillStyle = bGrad;
  ctx.beginPath();
  ctx.moveTo(-2.8, 0);
  ctx.lineTo(2.8, 0);
  ctx.lineTo(0.7, BLADE_LEN);
  ctx.lineTo(-0.7, BLADE_LEN);
  ctx.closePath();
  ctx.fill();
  // Blade bevel highlight
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.moveTo(0.4, 2);
  ctx.lineTo(2.8, 0);
  ctx.lineTo(0.7, BLADE_LEN);
  ctx.closePath();
  ctx.fill();
  // Tip glint
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.ellipse(0, BLADE_LEN - 2, 1.2, 2.5, 0, 0, TWO_PI);
  ctx.fill();

  // Handle (outside disc: -y direction)
  const hGrad = ctx.createLinearGradient(-4, -HANDLE_LEN, 4, 0);
  hGrad.addColorStop(0, "#38180a");
  hGrad.addColorStop(0.2, "#7a3c10");
  hGrad.addColorStop(0.5, "#9c5022");
  hGrad.addColorStop(0.8, "#7a3c10");
  hGrad.addColorStop(1, "#38180a");
  ctx.fillStyle = hGrad;
  ctx.beginPath();
  ctx.roundRect(-4, -HANDLE_LEN, 8, HANDLE_LEN - 4, [3, 3, 0, 0]);
  ctx.fill();
  // Wood grain lines
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 0.5;
  for (let i = 1; i <= 4; i++) {
    const y = -HANDLE_LEN + i * (HANDLE_LEN / 5);
    ctx.beginPath();
    ctx.moveTo(-3.5, y);
    ctx.lineTo(3.5, y);
    ctx.stroke();
  }
  // Metallic grip wraps
  ctx.fillStyle = "rgba(180,155,105,0.45)";
  [-HANDLE_LEN * 0.26, -HANDLE_LEN * 0.5, -HANDLE_LEN * 0.73].forEach((y) => {
    ctx.fillRect(-4.5, y, 9, 2);
  });
  // Pommel
  const pGrad = ctx.createRadialGradient(-1.5, -HANDLE_LEN + 3, 1, 0, -HANDLE_LEN + 2, 5.5);
  pGrad.addColorStop(0, "#c8a86a");
  pGrad.addColorStop(1, "#4a2f0e");
  ctx.fillStyle = pGrad;
  ctx.beginPath();
  ctx.arc(0, -HANDLE_LEN + 2, 5, 0, TWO_PI);
  ctx.fill();
}

function drawApple(ctx: CanvasRenderingContext2D, x: number, y: number, pulse: number) {
  const R = 9 + Math.sin(pulse) * 0.7;
  ctx.save();
  ctx.shadowColor = "rgba(255,60,60,0.65)";
  ctx.shadowBlur = 14;
  const aGrad = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.1, x, y, R);
  aGrad.addColorStop(0, "#ff7e7e");
  aGrad.addColorStop(0.55, "#e02020");
  aGrad.addColorStop(1, "#880000");
  ctx.fillStyle = aGrad;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, TWO_PI);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Shine
  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.beginPath();
  ctx.ellipse(x - R * 0.25, y - R * 0.28, R * 0.26, R * 0.17, -0.5, 0, TWO_PI);
  ctx.fill();
  // Stem
  ctx.strokeStyle = "#4a2600";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - R);
  ctx.quadraticCurveTo(x + 3, y - R - 5, x + 2, y - R - 8);
  ctx.stroke();
  // Leaf
  ctx.fillStyle = "#2a7a2a";
  ctx.beginPath();
  ctx.moveTo(x + 2, y - R - 5);
  ctx.bezierCurveTo(x + 7, y - R - 9, x + 11, y - R - 4, x + 4, y - R - 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function spawnPreKnives(count: number): PlantedKnife[] {
  const knives: PlantedKnife[] = [];
  for (let i = 0; i < count; i++) {
    let angle = 0;
    let tries = 0;
    do {
      angle = Math.random() * TWO_PI;
      tries++;
    } while (tries < 40 && knives.some((k) => Math.abs(angDiff(k.relAngle, angle)) < 0.65));
    knives.push({ relAngle: angle });
  }
  return knives;
}

function spawnApples(count: number, knives: PlantedKnife[]): Apple[] {
  const apples: Apple[] = [];
  for (let i = 0; i < count; i++) {
    let angle = 0;
    let tries = 0;
    do {
      angle = Math.random() * TWO_PI;
      tries++;
    } while (
      tries < 40 &&
      (knives.some((k) => Math.abs(angDiff(k.relAngle, angle)) < 0.45) ||
        apples.some((a) => Math.abs(angDiff(a.relAngle, angle)) < 0.55))
    );
    apples.push({ relAngle: angle, collected: false });
  }
  return apples;
}

export default function KnifeGame() {
  const TICKETS = useGameTickets("knife", RAW_TICKETS);
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
  const [bonusFlash, setBonusFlash] = useState<{ key: number } | null>(null);

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

  const discR = useCallback(() => {
    const { w, h } = sizeRef.current;
    return Math.min(w * 0.38, h * 0.25);
  }, []);

  const center = useCallback(() => {
    const { w, h } = sizeRef.current;
    return { cx: w / 2, cy: h * 0.44 };
  }, []);

  const newGameState = useCallback(
    (t: Ticket): GameState => {
      const preKnives = spawnPreKnives(t.preKnives);
      const apples = spawnApples(APPLE_COUNT, preKnives);
      const initSign = Math.random() < 0.5 ? 1 : -1;
      const initSpeed = initSign * (1.4 + Math.random() * 1.0);
      return {
        discAngle: 0,
        discSpeed: initSpeed,
        targetSpeed: initSpeed,
        speedChangeTimer: 2.0 + Math.random() * 1.5,
        plantedKnives: preKnives,
        apples,
        flyingKnife: null,
        particles: [],
        score: 0,
        target: t.target,
        knifeCount: t.target,
        timeLeft: t.time,
        timeMax: t.time,
        running: true,
        lastTime: 0,
        shakeT: 0,
        shakeMag: 0,
        crashT: 0,
        knockT: 0,
      };
    },
    [],
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
        life: 0.5 + Math.random() * 0.6,
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
      const R = discR();
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
              : "linear-gradient(to right, hsl(35 80% 55%), hsl(43 65% 53%))";
        }
        if (g.timeLeft <= 0) endRef.current(g.score, "time");
      }

      // Disc rotation + variable speed pattern
      if (g.running) {
        g.discSpeed += (g.targetSpeed - g.discSpeed) * Math.min(1, dt * 2.8);
        g.discAngle += g.discSpeed * dt;
        g.speedChangeTimer -= dt;
        if (g.speedChangeTimer <= 0) {
          const r = Math.random();
          if (r < 0.28) {
            // Brake toward near-stop — next fire will pick a new direction
            g.targetSpeed *= 0.04;
            g.speedChangeTimer = 0.7 + Math.random() * 0.5;
          } else if (r < 0.55) {
            // Reverse direction and accelerate
            const sign = g.discSpeed > 0 ? -1 : 1;
            g.targetSpeed = sign * (2.0 + Math.random() * 2.5);
            g.speedChangeTimer = 1.5 + Math.random() * 2.0;
          } else if (r < 0.72) {
            // Fast burst in current direction
            const sign = Math.sign(g.discSpeed) || 1;
            g.targetSpeed = sign * (3.5 + Math.random() * 1.5);
            g.speedChangeTimer = 0.7 + Math.random() * 0.9;
          } else {
            // Gentle drift
            const sign = Math.random() < 0.4 ? -1 : 1;
            g.targetSpeed = sign * (0.5 + Math.random() * 0.8);
            g.speedChangeTimer = 2.5 + Math.random() * 1.5;
          }
        }
      }

      // Flying knife animation + resolution
      if (g.flyingKnife && g.running) {
        g.flyingKnife.progress = Math.min(1, g.flyingKnife.progress + dt / THROW_DURATION);
        if (g.flyingKnife.progress >= 1) {
          // Knife arrives at the 6 o'clock position (bottom of disc, absolute angle PI)
          // Compute where that is in the disc's rotating frame
          const landRel = (((Math.PI - g.discAngle) % TWO_PI) + TWO_PI) % TWO_PI;

          // Check collision with already-planted knives
          let collided = false;
          for (const pk of g.plantedKnives) {
            if (Math.abs(angDiff(pk.relAngle, landRel)) < COL_THRESH) {
              collided = true;
              break;
            }
          }

          const impactY = cy + R;

          if (collided) {
            // CLASH — knife hits another knife
            audioRef.current.clash();
            burst(g, cx, impactY, 18, 28, 320); // orange sparks
            burst(g, cx, impactY, 0, 18, 200); // red sparks
            g.shakeT = 0.75;
            g.shakeMag = 32;
            g.crashT = 0.75;
            g.flyingKnife = null;
            endRef.current(g.score, "crash");
          } else {
            // Check apple collection
            for (const apple of g.apples) {
              if (!apple.collected && Math.abs(angDiff(apple.relAngle, landRel)) < APPLE_THRESH) {
                apple.collected = true;
                g.timeLeft = Math.min(g.timeMax, g.timeLeft + APPLE_BONUS);
                audioRef.current.apple();
                setBonusFlash({ key: Date.now() });
                burst(g, cx, impactY, 48, 16, 220); // gold glints
                burst(g, cx, impactY, 0, 10, 150); // apple red
              }
            }

            // Plant the knife
            g.plantedKnives.push({ relAngle: landRel });
            g.score += 1;
            g.knockT = 0.28;
            g.shakeT = 0.1;
            g.shakeMag = 4;
            audioRef.current.thuck();
            setScore(g.score);
            g.flyingKnife = null;

            if (g.score >= g.target) {
              endRef.current(g.score, "win");
            }
          }
        }
      }

      // Particles (with gravity)
      for (const p of g.particles) {
        p.vx *= 0.92;
        p.vy = p.vy * 0.94 + 220 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      g.particles = g.particles.filter((p) => p.life > 0);

      if (g.shakeT > 0) g.shakeT -= dt;
      if (g.crashT > 0) g.crashT -= dt;
      if (g.knockT > 0) g.knockT = Math.max(0, g.knockT - dt * 3.5);

      // ---- Render ----
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Deep dark wood background
      ctx.fillStyle = "#110804";
      ctx.fillRect(0, 0, w, h);

      // Warm ambient glow behind disc
      const bgGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.4);
      bgGlow.addColorStop(0, "rgba(130,65,12,0.2)");
      bgGlow.addColorStop(0.5, "rgba(80,30,5,0.08)");
      bgGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, w, h);

      // Screen shake
      let sx = 0;
      let sy = 0;
      if (g.shakeT > 0) {
        const m = g.shakeMag * Math.max(0, g.shakeT / 0.75);
        sx = (Math.random() * 2 - 1) * m;
        sy = (Math.random() * 2 - 1) * m;
      }
      ctx.save();
      ctx.translate(sx, sy);

      // Disc drop shadow
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 24;
      ctx.shadowOffsetX = 6;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TWO_PI);
      ctx.fill();
      ctx.restore();

      // Disc group — everything inside rotates with the disc
      const wobble =
        g.knockT > 0 ? Math.sin((0.28 - g.knockT) * 55) * g.knockT * 0.42 : 0;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(g.discAngle + wobble);

      // Wood disc base
      const woodGrad = ctx.createRadialGradient(-R * 0.1, -R * 0.15, R * 0.04, 0, 0, R * 1.05);
      woodGrad.addColorStop(0, "#d49248");
      woodGrad.addColorStop(0.28, "#b07032");
      woodGrad.addColorStop(0.62, "#8B4513");
      woodGrad.addColorStop(0.84, "#6e3010");
      woodGrad.addColorStop(1, "#4a1e08");
      ctx.fillStyle = woodGrad;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, TWO_PI);
      ctx.fill();

      // Grain rings (annual rings of a real wood cross-section)
      for (let ri = 1; ri <= 14; ri++) {
        const rr = R * (ri / 14);
        const even = ri % 2 === 0;
        ctx.strokeStyle = `rgba(${even ? 255 : 200},${even ? 165 : 125},${even ? 55 : 35},${even ? 0.16 : 0.09})`;
        ctx.lineWidth = ri % 4 === 0 ? 1.4 : 0.6;
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, TWO_PI);
        ctx.stroke();
      }

      // Radial grain (wood fibers radiating outward)
      ctx.save();
      ctx.globalAlpha = 0.09;
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * TWO_PI;
        ctx.strokeStyle = `rgba(30,10,2,1)`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 0.06, Math.sin(a) * R * 0.06);
        ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
        ctx.stroke();
      }
      ctx.restore();

      // Outer rim (dark bevel ring)
      ctx.save();
      const rimGrad = ctx.createRadialGradient(0, 0, R - 14, 0, 0, R + 2);
      rimGrad.addColorStop(0, "rgba(50,20,5,0.55)");
      rimGrad.addColorStop(0.7, "rgba(20,8,2,0.85)");
      rimGrad.addColorStop(1, "rgba(0,0,0,0.95)");
      ctx.strokeStyle = rimGrad;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(0, 0, R - 5, 0, TWO_PI);
      ctx.stroke();
      // Rim highlight
      ctx.strokeStyle = "rgba(220,155,60,0.38)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, R - 3, 0, TWO_PI);
      ctx.stroke();
      ctx.restore();

      // Center hub
      const hubGrad = ctx.createRadialGradient(-3, -3, 1, 0, 0, 16);
      hubGrad.addColorStop(0, "#e0bc62");
      hubGrad.addColorStop(0.5, "#a07232");
      hubGrad.addColorStop(1, "#4a2010");
      ctx.fillStyle = hubGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, TWO_PI);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,205,80,0.5)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, TWO_PI);
      ctx.stroke();
      // Hub pin
      ctx.fillStyle = "#120600";
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = "rgba(255,215,90,0.6)";
      ctx.beginPath();
      ctx.arc(-1.5, -1.5, 2.2, 0, TWO_PI);
      ctx.fill();

      // All planted knives rotate with disc — draw in disc-local coords
      for (const pk of g.plantedKnives) {
        const ex = Math.sin(pk.relAngle) * R;
        const ey = -Math.cos(pk.relAngle) * R;
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(pk.relAngle);
        drawKnife(ctx);
        ctx.restore();
      }

      // Apples on disc (in disc-local coords)
      const pulse = time / 420;
      for (const apple of g.apples) {
        if (!apple.collected) {
          const ax = Math.sin(apple.relAngle) * R;
          const ay = -Math.cos(apple.relAngle) * R;
          drawApple(ctx, ax, ay, pulse + apple.relAngle * 2);
        }
      }

      ctx.restore(); // end disc group

      // Flying knife (in screen coords, travels upward toward disc)
      if (g.flyingKnife) {
        const fp = Math.min(1, g.flyingKnife.progress);
        const launchY = h - 50;
        const targetY = cy + R;
        const flyY = launchY + fp * (targetY - launchY);
        ctx.save();
        ctx.translate(cx, flyY);
        // rotate(PI) makes local +y point upward so blade goes toward disc
        ctx.rotate(Math.PI);
        drawKnife(ctx);
        ctx.restore();
      }

      // Particles (gravity-affected sparks/debris)
      for (const p of g.particles) {
        const alpha = Math.max(0, p.life / p.max);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowColor = `hsla(${p.hue}, 90%, 65%, 0.8)`;
        ctx.shadowBlur = 8;
        ctx.fillStyle = `hsl(${p.hue}, 90%, 68%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
      }

      // Remaining knife icons at the bottom
      const rem = g.knifeCount;
      if (rem > 0 && rem <= g.target) {
        const iconSpacing = Math.min(20, (w * 0.72) / Math.max(rem, 1));
        const totalW = (rem - 1) * iconSpacing;
        const ix0 = cx - totalW / 2;
        for (let i = 0; i < rem; i++) {
          const ix = ix0 + i * iconSpacing;
          const iy = h - 44;
          // Blade silhouette
          ctx.fillStyle = "rgba(210,210,210,0.7)";
          ctx.fillRect(ix - 1.5, iy - 20, 3, 20);
          // Crossguard
          ctx.fillStyle = "rgba(165,145,105,0.7)";
          ctx.fillRect(ix - 4.5, iy - 2.5, 9, 2.5);
          // Handle
          ctx.fillStyle = "rgba(115,60,18,0.8)";
          ctx.fillRect(ix - 2.8, iy, 5.6, 15);
        }
      }

      ctx.restore(); // end shake group

      // Red crash flash overlay
      if (g.crashT > 0) {
        ctx.fillStyle = `rgba(215,25,25,${Math.max(0, g.crashT / 0.75) * 0.4})`;
        ctx.fillRect(0, 0, w, h);
      }

      // Keep rAF alive while anything needs animating
      if (g.running || g.particles.length > 0 || g.flyingKnife) {
        rafRef.current = requestAnimationFrame(loop);
      }
    },
    [center, discR],
  );

  const startLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (gameRef.current) gameRef.current.lastTime = 0;
    rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const startingRef = useRef(false);

  const playTicket = useCallback(
    (t: Ticket) => {
      if (startingRef.current) return;
      if (t.price > balance) return;
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
      setBonusFlash(null);
      setTimeLeft(t.time);
      if (timerBarRef.current) timerBarRef.current.style.width = "100%";
      setPhase("playing");
      startLoop();
    },
    [balance, newGameState, startLoop],
  );

  const finishGame = useCallback((finalScore: number, outcome: "win" | "crash" | "time") => {
    const g = gameRef.current;
    if (!g || !g.running) return; // idempotent guard
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

  const ticketRef = useRef<Ticket | null>(null);
  useEffect(() => {
    ticketRef.current = ticket;
  }, [ticket]);

  const endRef = useRef(finishGame);
  useEffect(() => {
    endRef.current = finishGame;
  }, [finishGame]);

  const throwKnife = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.running || g.flyingKnife || g.knifeCount <= 0) return;
    g.flyingKnife = { progress: 0 };
    g.knifeCount -= 1; // knife leaves the pool immediately on throw
  }, []);

  const handleTap = useCallback(() => {
    if (phase === "playing") throwKnife();
  }, [phase, throwKnife]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
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
    <div className="flex-1 relative flex flex-col h-full overflow-hidden bg-[#110804] select-none">
      {/* HUD top bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3">
        <Link href="/games">
          <button
            data-testid="button-back-arena"
            className="w-10 h-10 rounded-full bg-white/5 backdrop-blur border border-white/10 flex items-center justify-center text-white/80 hover:text-amber-300 hover:border-amber-400/40 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
        </Link>

        <div className="flex flex-col items-center -mt-1">
          <span className="text-[10px] tracking-[0.3em] text-amber-400/70 font-display uppercase">
            {phase === "playing" ? "Knives Planted" : "Knife Master"}
          </span>
          <span
            data-testid="text-score"
            className="font-display font-black text-4xl text-white leading-none drop-shadow-[0_0_18px_rgba(212,175,55,0.55)]"
          >
            {score}
          </span>
          {phase === "playing" && (
            <span className="text-[9px] tracking-[0.25em] text-amber-300/80 font-display uppercase mt-0.5">
              GOAL {target}
            </span>
          )}
        </div>

        <button
          data-testid="button-toggle-mute"
          onClick={toggleMute}
          className="w-10 h-10 rounded-full bg-white/5 backdrop-blur border border-white/10 flex items-center justify-center text-white/80 hover:text-amber-300 hover:border-amber-400/40 transition-colors"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Progress bar + countdown timer */}
      {phase === "playing" && (
        <div className="absolute top-[84px] left-1/2 -translate-x-1/2 z-30 w-[68%] flex flex-col gap-2.5">
          {/* Progress: knives planted vs target */}
          <div className="flex flex-col gap-1">
            <div className="w-full flex items-center justify-between px-0.5">
              <span className="text-[9px] tracking-[0.25em] text-amber-400/90 font-display uppercase">Knives</span>
              <span data-testid="text-progress" className="text-[11px] font-display font-bold tracking-wider tabular-nums text-white/90">
                {score} / {target}
              </span>
            </div>
            <div className="relative w-full h-2.5 rounded-full bg-white/10 overflow-hidden border border-amber-500/20">
              <div
                data-testid="bar-progress"
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 shadow-[0_0_14px_rgba(212,175,55,0.6)] transition-[width] duration-300 ease-out"
                style={{ width: `${target > 0 ? Math.min(100, (score / target) * 100) : 0}%` }}
              />
            </div>
          </div>
          {/* Countdown timer */}
          <div className="flex flex-col gap-1">
            <div className="w-full flex items-center justify-between px-0.5">
              <span className="text-[9px] tracking-[0.25em] text-white/40 font-display uppercase">Time</span>
              <span
                data-testid="text-timer"
                className={`text-[11px] font-display font-bold tracking-wider tabular-nums ${timeLeft <= 5 ? "text-red-400" : "text-white/80"}`}
              >
                {timeLeft}s
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                ref={timerBarRef}
                data-testid="bar-timer"
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400"
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bonus time flash */}
      <AnimatePresence>
        {bonusFlash && (
          <motion.div
            key={bonusFlash.key}
            initial={{ opacity: 0, scale: 0.6, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.3, y: -20 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => setBonusFlash((f) => (f && f.key === bonusFlash.key ? null : f))}
            className="absolute top-[42%] left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <span className="font-display font-black text-3xl text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-red-300 drop-shadow-[0_0_24px_rgba(255,160,30,0.9)]">
              +5s
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas game area */}
      <div ref={wrapRef} className="flex-1 relative" onPointerDown={handleTap}>
        <canvas ref={canvasRef} data-testid="canvas-knife" className="absolute inset-0 touch-none" />
        {phase === "playing" && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[11px] text-amber-400/40 font-display tracking-[0.3em] uppercase pointer-events-none">
            Tap to throw
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
            className="absolute inset-0 z-40 flex flex-col bg-black/75 backdrop-blur-md px-6 pt-16 pb-6 overflow-y-auto"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05 }}
              className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto"
            >
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={14} className="text-amber-400" />
                <span className="text-[11px] tracking-[0.4em] text-white/50 font-display uppercase">Knife Master</span>
              </div>
              <h1 className="font-display font-black text-2xl leading-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-amber-300 to-yellow-500 mb-3">
                CHOOSE YOUR TICKET
              </h1>
              <p className="text-xs text-white/40 mb-4 max-w-[260px]">
                Hit the spinning disc — every knife must land clean. Catch red apples for bonus time.
              </p>

              {/* Balance */}
              <div className="flex items-center gap-2 mb-5 px-4 py-2 rounded-xl bg-amber-400/10 border border-amber-400/30">
                <Coins size={14} className="text-amber-300" />
                <span data-testid="text-balance" className="text-sm font-display font-bold text-amber-300 tracking-wide">
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
                          ? "bg-white/5 border-white/10 hover:border-amber-400/50 active:scale-[0.98]"
                          : "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-display font-bold text-base text-white tracking-wide">{t.name}</span>
                        <span className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">
                          Goal {t.target} · {t.time}s · {t.preKnives} pre-placed
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="flex items-center gap-1 text-amber-300 font-display font-bold text-sm">
                          <Coins size={12} /> {t.prize.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Entry {t.price}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 mt-5 text-[11px] text-white/40">
                <Trophy size={11} className="text-amber-400" />
                <span data-testid="text-best">Best {best}</span>
              </div>

              {balance < 30 ? (
                <button
                  onClick={refillBalance}
                  data-testid="button-refill"
                  className="mt-5 w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-display font-bold text-sm tracking-widest shadow-[0_0_24px_rgba(212,175,55,0.55)] active:scale-95 transition-transform"
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
            className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/78 backdrop-blur-md px-8"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0.4 }}
              className="w-full max-w-[300px] flex flex-col items-center text-center"
            >
              <span data-testid="text-result" className="text-xs tracking-[0.4em] font-display uppercase mb-2 text-amber-300">
                Perfect Strike
              </span>
              <div className="font-display font-black text-5xl text-transparent bg-clip-text bg-gradient-to-br from-amber-300 via-yellow-200 to-white mb-1 drop-shadow-[0_0_24px_rgba(212,175,55,0.7)]">
                +{ticket?.prize.toLocaleString() ?? 0}
              </div>
              <span className="text-sm text-white/50 mb-6">SKZ prize claimed</span>

              <div className="w-full grid grid-cols-2 gap-3 mb-7">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1">
                    <Trophy size={11} className="text-amber-400" /> Planted
                  </div>
                  <span data-testid="text-final-score" className="font-display font-bold text-xl text-white">{score}</span>
                </div>
                <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-3 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1">
                    <Coins size={11} className="text-amber-300" /> Balance
                  </div>
                  <span data-testid="text-balance-final" className="font-display font-bold text-xl text-amber-300">
                    {balance.toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setPhase("select")}
                data-testid="button-replay"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-display font-bold tracking-widest shadow-[0_0_30px_rgba(212,175,55,0.5)] flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform"
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
                {lostReason === "time" ? "Time Up" : "Knife Clash"}
              </span>
              <div data-testid="text-loss-amount" className="font-display font-black text-5xl text-transparent bg-clip-text bg-gradient-to-br from-red-400 to-white/70 mb-1">
                -{ticket?.price ?? 0}
              </div>
              <span className="text-sm text-white/50 mb-6">SKZ entry lost</span>

              <div className="w-full grid grid-cols-2 gap-3 mb-7">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1">
                    <Trophy size={11} className="text-amber-400" /> Reached
                  </div>
                  <span data-testid="text-final-score" className="font-display font-bold text-xl text-white">
                    {score} / {target}
                  </span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1">
                    <Coins size={11} className="text-amber-300" /> Balance
                  </div>
                  <span data-testid="text-balance-final" className="font-display font-bold text-xl text-white">
                    {balance.toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setPhase("select")}
                data-testid="button-replay"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-display font-bold tracking-widest shadow-[0_0_30px_rgba(212,175,55,0.5)] flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform"
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
