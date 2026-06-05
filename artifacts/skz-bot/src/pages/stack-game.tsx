import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Volume2, VolumeX, RotateCcw, Trophy, Zap, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";

type Phase = "select" | "playing" | "won" | "lost";

interface Ticket {
  id: string;
  name: string;
  price: number; // entry cost in SKZ
  prize: number; // payout on win
  target: number; // correct hits required to win
  time: number; // seconds allowed
}

interface Block {
  x: number;
  w: number;
  index: number;
}

interface Debris {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  alpha: number;
  hue: number;
}

interface GameState {
  blocks: Block[];
  moving: { x: number; w: number; dir: number; index: number } | null;
  baseWidth: number;
  blockH: number;
  cameraY: number;
  cameraTarget: number;
  shakeT: number;
  shakeMag: number;
  debris: Debris[];
  lastTime: number;
  running: boolean;
  score: number;
  combo: number;
  timeLeft: number;
  timeMax: number;
  target: number;
}

const BEST_KEY = "skz_stack_best";
const BALANCE_KEY = "skz_balance";
const START_BALANCE = 1000;

// ---- Ticket tiers: pick one to play. Reach the target score (the interactive
// progress line) before the timer runs out to win the prize; otherwise you lose
// the entry price. (UI-only mock economy.)
const RAW_TICKETS: Ticket[] = [
  { id: "rookie", name: "Rookie", price: 25, prize: 45, target: 8, time: 24 },
  { id: "bronze", name: "Bronze", price: 50, prize: 95, target: 12, time: 26 },
  { id: "silver", name: "Silver", price: 120, prize: 255, target: 16, time: 28 },
  { id: "gold", name: "Gold", price: 300, prize: 680, target: 22, time: 30 },
  { id: "diamond", name: "Diamond", price: 750, prize: 1850, target: 30, time: 32 },
];

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

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  place() {
    this.tone(150, 0.16, "sine", 0.45);
    this.tone(90, 0.2, "triangle", 0.3);
  }

  // Ascending musical pitch driven by combo length
  perfect(combo: number) {
    const semis = [0, 4, 7, 11, 12, 16, 19, 23, 24];
    const step = semis[Math.min(combo, semis.length - 1)];
    const freq = 523.25 * Math.pow(2, step / 12);
    this.tone(freq, 0.22, "triangle", 0.4);
    this.tone(freq * 2, 0.18, "sine", 0.18);
  }

  comboMilestone(combo: number) {
    const root = 392 * Math.pow(2, Math.floor(combo / 3) / 12);
    [0, 4, 7].forEach((s, i) => this.tone(root * Math.pow(2, s / 12), 0.18, "triangle", 0.3, i * 0.05));
  }

  cut(intensity: number) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.5, 0.18 + intensity * 0.35), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1400;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  gameOver() {
    [392, 311, 261, 196].forEach((f, i) => this.tone(f, 0.3, "sawtooth", 0.25, i * 0.12));
  }

  // countdown tick when time is running low
  tick(urgent = false) {
    this.tone(urgent ? 920 : 660, 0.07, "square", urgent ? 0.22 : 0.13);
  }

  // target line reached
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

const hueOf = (i: number) => (205 + i * 7 + Math.floor(i / 10) * 38) % 360;

export default function StackGame() {
  const TICKETS = useGameTickets("stack", RAW_TICKETS);
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
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [muted, setMuted] = useState(false);
  const [comboFlash, setComboFlash] = useState<{ n: number; perfect: boolean; key: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [balance, setBalance] = useState(START_BALANCE);
  const [lostReason, setLostReason] = useState<"crash" | "time">("crash");

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

  const anchorY = useCallback(() => sizeRef.current.h * 0.34, []);

  const newGameState = useCallback((t: Ticket): GameState => {
    const { w } = sizeRef.current;
    const baseWidth = Math.min(w * 0.62, 260);
    const blockH = 42;
    const base: Block = { x: (w - baseWidth) / 2, w: baseWidth, index: 0 };
    return {
      blocks: [base],
      moving: { x: 0, w: baseWidth, dir: 1, index: 1 },
      baseWidth,
      blockH,
      cameraY: 0,
      cameraTarget: 0,
      shakeT: 0,
      shakeMag: 0,
      debris: [],
      lastTime: 0,
      running: true,
      score: 0,
      combo: 0,
      timeLeft: t.time,
      timeMax: t.time,
      target: t.target,
    };
  }, []);

  const drawRoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    if (w <= 0 || h <= 0) return;
    const rad = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  };

  const paintBlock = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, index: number, glow: boolean) => {
    const hue = hueOf(index);
    if (glow) {
      ctx.save();
      ctx.shadowColor = `hsla(${hue}, 90%, 60%, 0.9)`;
      ctx.shadowBlur = 28;
    }
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, `hsl(${hue}, 78%, 62%)`);
    grad.addColorStop(1, `hsl(${(hue + 24) % 360}, 80%, 44%)`);
    ctx.fillStyle = grad;
    drawRoundRect(ctx, x, y, w, h, 7);
    ctx.fill();
    if (glow) ctx.restore();
    // top highlight
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    drawRoundRect(ctx, x + 3, y + 3, w - 6, h * 0.28, 5);
    ctx.fill();
    // bottom inner shadow
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    drawRoundRect(ctx, x + 3, y + h * 0.72, w - 6, h * 0.22, 5);
    ctx.fill();
  };

  const loop = useCallback((time: number) => {
    const g = gameRef.current;
    const canvas = canvasRef.current;
    if (!g || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h, dpr } = sizeRef.current;

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
            : "linear-gradient(to right, hsl(43 65% 53%), hsl(262 83% 58%))";
      }
      if (g.timeLeft <= 0) {
        endRef.current(g.score, "time");
      }
    }

    // Move active block
    if (g.moving && g.running) {
      const spd = Math.min(560, 150 + g.score * 8);
      g.moving.x += g.moving.dir * spd * dt;
      const maxX = w - g.moving.w;
      if (g.moving.x <= 0) {
        g.moving.x = 0;
        g.moving.dir = 1;
      } else if (g.moving.x >= maxX) {
        g.moving.x = maxX;
        g.moving.dir = -1;
      }
    }

    // Camera easing
    g.cameraY += (g.cameraTarget - g.cameraY) * Math.min(1, dt * 8);

    // Shake decay
    let sx = 0;
    let sy = 0;
    if (g.shakeT > 0) {
      g.shakeT -= dt;
      const m = g.shakeMag * Math.max(0, g.shakeT / 0.35);
      sx = (Math.random() * 2 - 1) * m;
      sy = (Math.random() * 2 - 1) * m;
    }

    // Debris physics
    for (const d of g.debris) {
      d.vy += 1400 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rot += d.vr * dt;
      d.alpha -= dt * 0.9;
    }
    g.debris = g.debris.filter((d) => d.alpha > 0 && d.y < h + 120);

    // ---- Render ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Background ambience tinted by current palette
    const bgHue = hueOf(g.score + 1);
    const bg = ctx.createRadialGradient(w / 2, h * 0.32, 40, w / 2, h * 0.5, h * 0.9);
    bg.addColorStop(0, `hsla(${bgHue}, 45%, 14%, 0.55)`);
    bg.addColorStop(1, "rgba(5,6,12,0)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(sx, sy);

    const anchor = anchorY();
    const screenY = (worldY: number) => anchor - (worldY - g.cameraY);

    // placed blocks
    for (const b of g.blocks) {
      const worldY = b.index * g.blockH;
      const y = screenY(worldY);
      if (y > h + g.blockH || y < -g.blockH) continue;
      paintBlock(ctx, b.x, y, b.w, g.blockH - 4, b.index, false);
    }

    // moving block
    if (g.moving && g.running) {
      const worldY = g.moving.index * g.blockH;
      const y = screenY(worldY);
      paintBlock(ctx, g.moving.x, y, g.moving.w, g.blockH - 4, g.moving.index, true);
      // guide line to show drop target
      const prev = g.blocks[g.blocks.length - 1];
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(prev.x, y + g.blockH);
      ctx.lineTo(prev.x, h);
      ctx.moveTo(prev.x + prev.w, y + g.blockH);
      ctx.lineTo(prev.x + prev.w, h);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // debris
    for (const d of g.debris) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, d.alpha);
      ctx.translate(d.x + d.w / 2, d.y + d.h / 2);
      ctx.rotate(d.rot);
      const grad = ctx.createLinearGradient(0, -d.h / 2, 0, d.h / 2);
      grad.addColorStop(0, `hsl(${d.hue}, 78%, 60%)`);
      grad.addColorStop(1, `hsl(${(d.hue + 24) % 360}, 80%, 42%)`);
      ctx.fillStyle = grad;
      drawRoundRect(ctx, -d.w / 2, -d.h / 2, d.w, d.h, 6);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // Keep animating while playing or while death debris is still settling, then stop.
    if (g.running || g.debris.length > 0) {
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [anchorY]);

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
      // Deduct the entry price up front (mock economy)
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
      setCombo(0);
      setComboFlash(null);
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
    startingRef.current = false; // release the start lock for the next round
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

  const dropBlock = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.moving || !g.running) return;
    const { h } = sizeRef.current;
    const anchor = anchorY();
    const prev = g.blocks[g.blocks.length - 1];
    const mv = g.moving;
    const delta = mv.x - prev.x;
    const overlap = prev.w - Math.abs(delta);

    if (overlap <= 0) {
      // missed entirely -> falling block, game over
      const worldY = mv.index * g.blockH;
      const y = anchor - (worldY - g.cameraY);
      g.debris.push({
        x: mv.x,
        y,
        w: mv.w,
        h: g.blockH - 4,
        vx: delta > 0 ? 120 : -120,
        vy: -40,
        rot: 0,
        vr: (delta > 0 ? 1 : -1) * 3,
        alpha: 1.4,
        hue: hueOf(mv.index),
      });
      finishGame(g.score, "crash");
      return;
    }

    const perfectPx = Math.max(5, sizeRef.current.w * 0.013);
    const worldY = mv.index * g.blockH;
    const blockScreenY = anchor - (worldY - g.cameraY);
    let newX: number;
    let newW: number;

    if (Math.abs(delta) <= perfectPx) {
      // PERFECT
      newX = prev.x;
      newW = prev.w;
      g.combo += 1;
      audioRef.current.perfect(g.combo);
      // every 3 perfects, widen the platform a touch
      if (g.combo % 3 === 0) {
        const grow = Math.min(g.baseWidth - newW, sizeRef.current.w * 0.05);
        if (grow > 0) {
          newW += grow;
          newX = prev.x + prev.w / 2 - newW / 2;
          newX = Math.max(0, Math.min(newX, sizeRef.current.w - newW));
        }
        audioRef.current.comboMilestone(g.combo);
      }
      setComboFlash({ n: g.combo, perfect: true, key: Date.now() });
    } else {
      // CUT
      newX = delta > 0 ? prev.x + delta : prev.x;
      newW = overlap;
      const cutW = Math.abs(delta);
      // spawn falling debris from the cut overhang
      const debrisX = delta > 0 ? newX + newW : mv.x;
      g.debris.push({
        x: debrisX,
        y: blockScreenY,
        w: cutW,
        h: g.blockH - 4,
        vx: delta > 0 ? 90 : -90,
        vy: -30,
        rot: 0,
        vr: (delta > 0 ? 1 : -1) * 4,
        alpha: 1.3,
        hue: hueOf(mv.index),
      });
      g.combo = 0;
      const intensity = Math.min(1, cutW / prev.w);
      g.shakeT = 0.35;
      g.shakeMag = 6 + intensity * 14;
      audioRef.current.cut(intensity);
      audioRef.current.place();
      setComboFlash(null);
    }

    g.blocks.push({ x: newX, w: newW, index: mv.index });
    g.score += 1;
    g.cameraTarget = (mv.index + 1) * g.blockH;
    setScore(g.score);
    setCombo(g.combo);

    // TARGET SCORE reached -> the interactive progress line is full: WIN.
    if (g.score >= g.target) {
      finishGame(g.score, "win");
      return;
    }

    // spawn next moving block from alternating side
    const spawnLeft = mv.index % 2 === 0;
    g.moving = {
      x: spawnLeft ? 0 : sizeRef.current.w - newW,
      w: newW,
      dir: spawnLeft ? 1 : -1,
      index: mv.index + 1,
    };
    void h;
  }, [anchorY, finishGame]);

  // Input handling
  const handleTap = useCallback(() => {
    if (phase === "playing") dropBlock();
  }, [phase, dropBlock]);

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
    <div className="flex-1 relative flex flex-col h-full overflow-hidden bg-[#06070d] select-none">
      {/* HUD top bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3">
        <Link href="/games">
          <button
            data-testid="button-back-arena"
            className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:border-primary/50 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
        </Link>

        <div className="flex flex-col items-center -mt-1">
          <span className="text-[10px] tracking-[0.3em] text-white/40 font-display uppercase">Score</span>
          <span data-testid="text-score" className="font-display font-black text-4xl text-white leading-none drop-shadow-[0_0_18px_rgba(212,175,55,0.4)]">
            {score}
          </span>
          {phase === "playing" && (
            <span className="text-[9px] tracking-[0.25em] text-primary/80 font-display uppercase mt-0.5">
              GOAL {target}
            </span>
          )}
        </div>

        <button
          data-testid="button-toggle-mute"
          onClick={toggleMute}
          className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:border-primary/50 transition-colors"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Interactive progress line + countdown timer */}
      {phase === "playing" && (
        <div className="absolute top-[84px] left-1/2 -translate-x-1/2 z-30 w-[68%] flex flex-col gap-2.5">
          {/* Progress line: advances with every correct hit toward the goal */}
          <div className="flex flex-col gap-1">
            <div className="w-full flex items-center justify-between px-0.5">
              <span className="text-[9px] tracking-[0.25em] text-primary/90 font-display uppercase">Progress</span>
              <span data-testid="text-progress" className="text-[11px] font-display font-bold tracking-wider tabular-nums text-white/90">
                {score} / {target}
              </span>
            </div>
            <div className="relative w-full h-2.5 rounded-full bg-white/10 overflow-hidden border border-primary/20">
              <div
                data-testid="bar-progress"
                className="h-full rounded-full bg-gradient-to-r from-primary via-yellow-300 to-accent shadow-[0_0_14px_rgba(212,175,55,0.6)] transition-[width] duration-300 ease-out"
                style={{ width: `${target > 0 ? Math.min(100, (score / target) * 100) : 0}%` }}
              />
            </div>
          </div>
          {/* Countdown timer (must reach the goal before it empties) */}
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
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Combo flash */}
      <AnimatePresence>
        {comboFlash && comboFlash.n >= 2 && (
          <motion.div
            key={comboFlash.key}
            initial={{ opacity: 0, scale: 0.5, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.3, y: -20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-[24%] left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <div className="flex flex-col items-center">
              <span className="font-display font-black text-2xl text-transparent bg-clip-text bg-gradient-to-r from-primary via-yellow-200 to-accent drop-shadow-[0_0_20px_rgba(212,175,55,0.7)]">
                PERFECT
              </span>
              <span className="font-display font-bold text-sm text-primary tracking-widest">COMBO x{comboFlash.n}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas */}
      <div ref={wrapRef} className="flex-1 relative" onPointerDown={handleTap}>
        <canvas ref={canvasRef} data-testid="canvas-stack" className="absolute inset-0 touch-none" />
      </div>

      {/* Ticket selection overlay */}
      <AnimatePresence>
        {phase === "select" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col bg-black/70 backdrop-blur-md px-6 pt-16 pb-6 overflow-y-auto"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05 }}
              className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto"
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap size={15} className="text-accent" />
                <span className="text-[11px] tracking-[0.4em] text-white/50 font-display uppercase">Stack & Match</span>
              </div>
              <h1 className="font-display font-black text-2xl leading-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-primary to-accent mb-3">
                CHOOSE YOUR TICKET
              </h1>

              {/* Balance */}
              <div className="flex items-center gap-2 mb-5 px-4 py-2 rounded-xl bg-primary/10 border border-primary/30">
                <Coins size={14} className="text-primary" />
                <span className="text-sm font-display font-bold text-primary tracking-wide" data-testid="text-balance">
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
                          ? "bg-white/5 border-white/10 hover:border-primary/50 active:scale-[0.98]"
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
                        <span className="flex items-center gap-1 text-primary font-display font-bold text-sm">
                          <Coins size={12} /> {t.prize.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">
                          Entry {t.price}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 mt-5 text-[11px] text-white/40">
                <Trophy size={11} className="text-primary" />
                <span data-testid="text-best">Best {best}</span>
              </div>

              {balance < 30 ? (
                <button
                  onClick={refillBalance}
                  data-testid="button-refill"
                  className="mt-5 w-full py-3 rounded-2xl bg-gradient-to-r from-accent to-primary text-black font-display font-bold text-sm tracking-widest shadow-[0_0_24px_rgba(212,175,55,0.55)] active:scale-95 transition-transform"
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
            className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md px-8"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0.4 }}
              className="w-full max-w-[300px] flex flex-col items-center text-center"
            >
              <span className="text-xs tracking-[0.4em] font-display uppercase mb-2 text-primary" data-testid="text-result">
                You Win
              </span>
              <div className="font-display font-black text-5xl text-transparent bg-clip-text bg-gradient-to-br from-primary via-yellow-200 to-accent mb-1 drop-shadow-[0_0_24px_rgba(212,175,55,0.6)]">
                +{ticket?.prize.toLocaleString() ?? 0}
              </div>
              <span className="text-sm text-white/50 mb-6">SKZ prize claimed</span>

              <div className="w-full grid grid-cols-2 gap-3 mb-7">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1">
                    <Zap size={11} className="text-primary" /> Score
                  </div>
                  <span className="font-display font-bold text-xl text-white" data-testid="text-final-score">{score}</span>
                </div>
                <div className="bg-primary/10 border border-primary/30 rounded-2xl p-3 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1">
                    <Coins size={11} className="text-primary" /> Balance
                  </div>
                  <span className="font-display font-bold text-xl text-primary" data-testid="text-balance-final">{balance.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => setPhase("select")}
                data-testid="button-replay"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-black font-display font-bold tracking-widest shadow-[0_0_30px_rgba(212,175,55,0.4)] flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform"
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
            className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md px-8"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0.35 }}
              className="w-full max-w-[300px] flex flex-col items-center text-center"
            >
              <span
                data-testid="text-result"
                className="text-xs tracking-[0.4em] font-display uppercase mb-2 text-red-400"
              >
                {lostReason === "time" ? "Time Up" : "You Lost"}
              </span>
              <div className="font-display font-black text-5xl text-transparent bg-clip-text bg-gradient-to-br from-red-400 to-white/70 mb-1" data-testid="text-loss-amount">
                -{ticket?.price ?? 0}
              </div>
              <span className="text-sm text-white/50 mb-6">SKZ entry lost</span>

              <div className="w-full grid grid-cols-2 gap-3 mb-7">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1">
                    <Zap size={11} className="text-primary" /> Reached
                  </div>
                  <span className="font-display font-bold text-xl text-white" data-testid="text-final-score">{score} / {target}</span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1">
                    <Coins size={11} className="text-primary" /> Balance
                  </div>
                  <span className="font-display font-bold text-xl text-white" data-testid="text-balance-final">{balance.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => setPhase("select")}
                data-testid="button-replay"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-black font-display font-bold tracking-widest shadow-[0_0_30px_rgba(212,175,55,0.4)] flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform"
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
