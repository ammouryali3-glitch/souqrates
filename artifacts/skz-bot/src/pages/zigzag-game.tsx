import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Volume2, VolumeX, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";
import { GAME_TICKETS } from "@/lib/tickets-data";
import { GameOverOverlay, GameWonOverlay } from "@/components/game-end-overlay";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }
interface Particle { x: number; y: number; vx: number; vy: number; r: number; color: string; life: number; max: number; }

interface PathTile {
  wx: number; // world x
  wy: number; // world y (decreases going forward)
  isTurn: boolean;
  hasCoin: boolean;
  coinCollected: boolean;
}

interface GameState {
  path: PathTile[];
  ballX: number; ballY: number; // world coords
  ballDir: 1 | -1; // +1 = NE (x+,y-), -1 = NW (x-,y-)
  offTimer: number; // time spent off path → LOSE when > 0.12
  speed: number; // pixels per second total diagonal speed
  particles: Particle[];
  score: number; target: number; timeLeft: number; timeMax: number;
  running: boolean; lastTime: number;
  shakeT: number; shakeMag: number; flashT: number; goodFlashT: number;
}

const BEST_KEY = "skz_zigzag_best";
const BALANCE_KEY = "skz_balance";
const START_BALANCE = 1000;
const TWO_PI = Math.PI * 2;
const TILE_D = 32; // world units per diagonal tile step
const DIAG = 0.7071; // cos(45°) = sin(45°)
const HALF_W = 30; // half-width of path in X (world units)
const BASE_SPEED = 220;
const BALL_R = 13;

const RAW_TICKETS: Ticket[] = GAME_TICKETS.zigzag;

function generatePath(cx: number): PathTile[] {
  const tiles: PathTile[] = [];
  let wx = cx; let wy = 0;
  let dir: 1 | -1 = 1; // +1 = NE
  let runLen = 5 + Math.floor(Math.random() * 3);
  let ran = runLen;
  for (let i = 0; i < 400; i++) {
    const isTurn = ran === 0;
    const hasCoin = isTurn && Math.random() < 0.35;
    tiles.push({ wx, wy, isTurn, hasCoin, coinCollected: false });
    wx += dir * TILE_D;
    wy -= TILE_D; // always moves forward
    ran--;
    if (ran < 0) {
      dir = (dir * -1) as 1|-1;
      runLen = 4 + Math.floor(Math.random() * 4);
      ran = runLen;
    }
  }
  return tiles;
}

function isOnPath(bx: number, by: number, path: PathTile[]): boolean {
  for (const tile of path) {
    const dy = Math.abs(by - tile.wy);
    if (dy > TILE_D * 0.7) continue;
    const dx = Math.abs(bx - tile.wx);
    if (dx <= HALF_W + 4) return true;
  }
  return false;
}

class AudioEngine {
  private ctx: AudioContext | null = null; private master: GainNode | null = null; muted = false;
  private ensure() {
    if (!this.ctx) { const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination); }
    if (this.ctx.state === "suspended") void this.ctx.resume(); return this.ctx;
  }
  private tone(f: number, d: number, t: OscillatorType, v: number, delay = 0, gTo?: number) {
    if (this.muted) return; const ctx = this.ensure(); if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay; const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = t; osc.frequency.setValueAtTime(f, t0); if (gTo) osc.frequency.exponentialRampToValueAtTime(gTo, t0 + d);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    osc.connect(g); g.connect(this.master); osc.start(t0); osc.stop(t0 + d + 0.02);
  }
  private noise(d: number, v: number, cf: number) {
    if (this.muted) return; const ctx = this.ensure(); if (!ctx || !this.master) return;
    const t0 = ctx.currentTime; const buf = ctx.createBuffer(1, ctx.sampleRate * d, ctx.sampleRate);
    const da = buf.getChannelData(0); for (let i = 0; i < da.length; i++) da[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / da.length, 2);
    const src = ctx.createBufferSource(); src.buffer = buf; const g = ctx.createGain(); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    const flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = cf;
    src.connect(flt); flt.connect(g); g.connect(this.master); src.start(t0);
  }
  coin() { this.tone(880,0.15,"triangle",0.35,0,1320); this.tone(1320,0.1,"sine",0.2,0.06); }
  turn() { this.noise(0.12,0.3,4000); this.tone(300,0.08,"square",0.2,0,220); }
  crash() { this.noise(0.5,0.75,9000); this.tone(120,0.3,"sawtooth",0.5); }
  tick(u=false) { this.tone(u?900:650,0.07,"square",u?0.22:0.13); }
  start() { [392,523,659].forEach((f,i)=>this.tone(f,0.18,"triangle",0.32,i*0.06)); }
  goal() { [523,659,784,1047].forEach((f,i)=>this.tone(f,0.24,"triangle",0.38,i*0.07)); this.tone(262,0.5,"sine",0.2); }
  gameOver() { [392,311,261,196].forEach((f,i)=>this.tone(f,0.3,"sawtooth",0.28,i*0.12)); }
  dispose() { if (this.ctx) { void this.ctx.close(); this.ctx=null; this.master=null; } }
}

// Color helpers
function tileColor(screenY: number, h: number): string {
  const t = Math.max(0, Math.min(1, screenY / h));
  // Far ahead (low y) = dark purple, near = teal, behind = dark
  const r = Math.round(20 + t * 10);
  const gb = Math.round(t < 0.5 ? 60 + t * 100 : 160 - (t - 0.5) * 80);
  const b = Math.round(t < 0.5 ? 140 + t * 60 : 200 - (t - 0.5) * 120);
  return `rgb(${r},${gb},${b})`;
}

function drawTile(ctx: CanvasRenderingContext2D, sx: number, sy: number, h: number) {
  const TW = 28; // half width of top face
  const TH = 16; // half height (foreshortened)
  const DEP = 12; // 3D depth

  const tc = tileColor(sy, h);
  // Compute darker/medium for faces
  const darken = (hex: string, f: number) => {
    const [, r, g, b] = /rgb\((\d+),(\d+),(\d+)\)/.exec(hex) ?? ["", "0", "0", "0"];
    return `rgb(${Math.round(+r * f)},${Math.round(+g * f)},${Math.round(+b * f)})`;
  };

  // Top face (parallelogram — skewed for isometric feel)
  ctx.beginPath();
  ctx.moveTo(sx - TW, sy - TH + 5); // top-left (skewed)
  ctx.lineTo(sx + TW, sy - TH - 5); // top-right
  ctx.lineTo(sx + TW, sy + TH - 5); // bottom-right
  ctx.lineTo(sx - TW, sy + TH + 5); // bottom-left
  ctx.closePath();
  ctx.fillStyle = tc;
  ctx.fill();
  // Top highlight edge
  ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx - TW, sy - TH + 5); ctx.lineTo(sx + TW, sy - TH - 5); ctx.stroke();

  // Left (depth) face
  ctx.beginPath();
  ctx.moveTo(sx - TW, sy + TH + 5);
  ctx.lineTo(sx - TW, sy + TH + 5 + DEP);
  ctx.lineTo(sx + TW, sy + TH - 5 + DEP);
  ctx.lineTo(sx + TW, sy + TH - 5);
  ctx.closePath();
  ctx.fillStyle = darken(tc, 0.52);
  ctx.fill();
}

function drawBall(ctx: CanvasRenderingContext2D, sx: number, sy: number) {
  // Shadow
  ctx.save(); ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.ellipse(sx + 7, sy + 14, BALL_R * 1.1, BALL_R * 0.5, 0, 0, TWO_PI); ctx.fill();
  ctx.restore();
  // Body
  const g = ctx.createRadialGradient(sx - 4, sy - 4, 2, sx, sy, BALL_R);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.3, "#4CC9F0"); g.addColorStop(1, "#0a0a80");
  ctx.save(); ctx.shadowColor = "#4CC9F0"; ctx.shadowBlur = 22;
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, BALL_R, 0, TWO_PI); ctx.fill(); ctx.restore();
  // Spec
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath(); ctx.ellipse(sx - 4, sy - 4, 3, 2.5, -0.4, 0, TWO_PI); ctx.fill();
}

function drawCoin(ctx: CanvasRenderingContext2D, sx: number, sy: number) {
  ctx.save();
  ctx.shadowColor = "#FFD166"; ctx.shadowBlur = 15;
  ctx.fillStyle = "#FFD166";
  ctx.beginPath();
  ctx.moveTo(sx, sy - 10); ctx.lineTo(sx + 7, sy); ctx.lineTo(sx, sy + 10); ctx.lineTo(sx - 7, sy);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#FFA500"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}

export default function ZigZagGame() {
  const TICKETS = useGameTickets("zigzag", RAW_TICKETS);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const rafRef = useRef(0);
  const audioRef = useRef(new AudioEngine());
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const lastSecRef = useRef(0);
  const timerBarRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("select");
  const [lostReason, setLostReason] = useState<string | null>(null);
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

  const newGameState = useCallback((t: Ticket): GameState => {
    const { w } = sizeRef.current;
    return {
      path: generatePath(w / 2),
      ballX: w / 2, ballY: 0,
      ballDir: 1,
      offTimer: 0, speed: BASE_SPEED,
      particles: [],
      score: 0, target: t.target, timeLeft: t.time, timeMax: t.time,
      running: true, lastTime: 0,
      shakeT: 0, shakeMag: 0, flashT: 0, goodFlashT: 0,
    };
  }, []);

  const loop = useCallback((time: number) => {
    const g = gameRef.current; const canvas = canvasRef.current; if (!g || !canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const { w, h, dpr } = sizeRef.current;
    if (!g.lastTime) g.lastTime = time;
    const dt = Math.min((time - g.lastTime) / 1000, 0.05); g.lastTime = time;

    const BALL_SCREEN_Y = h * 0.62; // ball stays here vertically

    // Timer
    if (g.running) {
      g.timeLeft = Math.max(0, g.timeLeft - dt);
      const sec = Math.ceil(g.timeLeft);
      if (sec !== lastSecRef.current) { lastSecRef.current = sec; setTimeLeft(sec); if (sec <= 5 && sec > 0) audioRef.current.tick(sec <= 3); }
      const ratio = Math.max(0, g.timeLeft / g.timeMax);
      const bar = timerBarRef.current;
      if (bar) { bar.style.width = `${ratio * 100}%`; bar.style.backgroundImage = ratio <= 0.28 ? "linear-gradient(to right,rgb(239,68,68),rgb(251,146,60))" : "linear-gradient(to right,hsl(180 70% 45%),hsl(210 80% 55%))"; }
      if (g.timeLeft <= 0) endRef.current(g.score, "time");
    }

    // Ball movement
    const speed = g.speed;
    g.ballX += g.ballDir * DIAG * speed * dt;
    g.ballY -= DIAG * speed * dt; // always moves forward (y decreases)

    // Speed up with score
    g.speed = Math.min(480, BASE_SPEED + g.score * 18);

    // Check if ball is on path
    if (g.running) {
      const onPath = isOnPath(g.ballX, g.ballY, g.path);
      if (!onPath) {
        g.offTimer += dt;
        if (g.offTimer > 0.1) {
          audioRef.current.crash();
          g.shakeT = 0.7; g.shakeMag = 28; g.flashT = 0.7;
          endRef.current(g.score, "barrier");
        }
      } else {
        g.offTimer = 0;
      }

      // Coin collection
      for (const tile of g.path) {
        if (!tile.hasCoin || tile.coinCollected) continue;
        const dx = Math.abs(g.ballX - tile.wx);
        const dy = Math.abs(g.ballY - tile.wy);
        if (dx < 20 && dy < 20) {
          tile.coinCollected = true;
          g.score += 1; setScore(g.score);
          audioRef.current.coin();
          g.goodFlashT = 0.2;
          // Coin particles
          for (let i = 0; i < 12; i++) { const a = Math.random() * TWO_PI; const sp = 60 + Math.random() * 200; g.particles.push({ x: tile.wx, y: BALL_SCREEN_Y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3 + Math.random() * 4, color: "#FFD166", life: 0.4 + Math.random() * 0.4, max: 1 }); }
          if (g.score >= g.target) endRef.current(g.score, "win");
        }
      }
    }

    // Particles update
    for (const p of g.particles) { p.vx *= 0.88; p.vy = p.vy * 0.88 + 200 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    g.particles = g.particles.filter(p => p.life > 0);
    if (g.shakeT > 0) g.shakeT -= dt;
    if (g.flashT > 0) g.flashT -= dt;
    if (g.goodFlashT > 0) g.goodFlashT -= dt;

    // ---- Render ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0d1117"; ctx.fillRect(0, 0, w, h);
    // Subtle grid bg
    ctx.strokeStyle = "rgba(100,200,255,0.04)"; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    // Shake
    let sx = 0, sy = 0;
    if (g.shakeT > 0) { const m = g.shakeMag * Math.max(0, g.shakeT / 0.7); sx = (Math.random() * 2 - 1) * m; sy = (Math.random() * 2 - 1) * m; }
    ctx.save(); ctx.translate(sx, sy);

    // Draw tiles (world → screen mapping)
    // Ball is at world (g.ballX, g.ballY), screen (w/2, BALL_SCREEN_Y)
    // World dx,dy → screen dx = 1:1 for X, screen dy = 1:1 for Y
    const worldToScreen = (wx: number, wy: number) => ({
      x: w / 2 + (wx - g.ballX),
      y: BALL_SCREEN_Y + (wy - g.ballY),
    });

    // Sort tiles by screen y (back-to-front for 3D effect)
    const visibleTiles = g.path.filter(tile => {
      const sp = worldToScreen(tile.wx, tile.wy);
      return sp.y > -60 && sp.y < h + 60;
    }).sort((a, b) => worldToScreen(a.wx, a.wy).y - worldToScreen(b.wx, b.wy).y);

    for (const tile of visibleTiles) {
      const sp = worldToScreen(tile.wx, tile.wy);
      // Fade tiles far ahead (very top of screen) — emerging effect
      const alpha = Math.min(1, (sp.y + 50) / 150);
      ctx.globalAlpha = Math.max(0, alpha);
      drawTile(ctx, sp.x, sp.y, h);

      // Coin
      if (tile.hasCoin && !tile.coinCollected) {
        drawCoin(ctx, sp.x, sp.y - 28);
      }
    }
    ctx.globalAlpha = 1;

    // Edge warning lines (path boundaries)
    // Draw path edges
    for (const tile of visibleTiles) {
      const sp = worldToScreen(tile.wx, tile.wy);
      // Left edge indicator
      ctx.save(); ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "#4CC9F0"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sp.x - HALF_W - 2, sp.y - 12); ctx.lineTo(sp.x - HALF_W - 2, sp.y + 14); ctx.stroke();
      // Right edge
      ctx.beginPath(); ctx.moveTo(sp.x + HALF_W + 2, sp.y - 12); ctx.lineTo(sp.x + HALF_W + 2, sp.y + 14); ctx.stroke();
      ctx.restore();
    }

    // Ball (always at center)
    drawBall(ctx, w / 2, BALL_SCREEN_Y);

    // Drift particles (from previous turns)
    for (const p of g.particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TWO_PI); ctx.fill(); ctx.restore();
    }

    ctx.restore(); // end shake

    // Overlays
    if (g.flashT > 0) { ctx.fillStyle = `rgba(220,20,20,${(g.flashT / 0.7) * 0.38})`; ctx.fillRect(0, 0, w, h); }
    if (g.goodFlashT > 0) { ctx.fillStyle = `rgba(255,209,102,${(g.goodFlashT / 0.2) * 0.15})`; ctx.fillRect(0, 0, w, h); }

    if (g.running || g.particles.length > 0) rafRef.current = requestAnimationFrame(loop);
  }, []);

  const startLoop = useCallback(() => { cancelAnimationFrame(rafRef.current); if (gameRef.current) gameRef.current.lastTime = 0; rafRef.current = requestAnimationFrame(loop); }, [loop]);
  const startingRef = useRef(false);

  const finishGame = useCallback((finalScore: number, outcome: "win" | "barrier" | "time") => {
    const g = gameRef.current; if (!g || !g.running) return; g.running = false; startingRef.current = false;
    setBest(prev => { const n = Math.max(prev, finalScore); localStorage.setItem(BEST_KEY, String(n)); return n; });
    if (outcome === "win") { audioRef.current.goal(); const t = ticketRef.current; if (t) setBalance(prev => { const n = prev + t.prize; localStorage.setItem(BALANCE_KEY, String(n)); return n; }); setPhase("won"); }
    else { audioRef.current.gameOver(); setLostReason(outcome); setPhase("lost"); }
  }, []);

  const ticketRef = useRef<Ticket | null>(null);
  useEffect(() => { ticketRef.current = ticket; }, [ticket]);
  const endRef = useRef(finishGame);
  useEffect(() => { endRef.current = finishGame; }, [finishGame]);

  const onTap = useCallback(() => {
    if (phase !== "playing") return;
    const g = gameRef.current; if (!g || !g.running) return;
    const prevDir = g.ballDir;
    g.ballDir = (g.ballDir * -1) as 1 | -1;
    audioRef.current.turn();
    // Drift smoke at ball position
    const { w, h } = sizeRef.current;
    for (let i = 0; i < 8; i++) { const a = Math.random() * TWO_PI; const sp = 30 + Math.random() * 80; g.particles.push({ x: w / 2, y: h * 0.62, vx: Math.cos(a) * sp * prevDir * (-1), vy: Math.sin(a) * sp, r: 4 + Math.random() * 5, color: "rgba(180,220,255,0.8)", life: 0.35 + Math.random() * 0.25, max: 1 }); }
  }, [phase]);

  const playTicket = useCallback((t: Ticket) => {
    if (startingRef.current || t.price > balance) return; startingRef.current = true;
    setBalance(prev => { const n = prev - t.price; localStorage.setItem(BALANCE_KEY, String(n)); return n; });
    audioRef.current.start(); setTicket(t); gameRef.current = newGameState(t);
    lastSecRef.current = t.time; setScore(0); setTimeLeft(t.time);
    if (timerBarRef.current) timerBarRef.current.style.width = "100%";
    setPhase("playing"); startLoop();
  }, [balance, newGameState, startLoop]);

  useEffect(() => { const audio = audioRef.current; return () => { cancelAnimationFrame(rafRef.current); audio.dispose(); }; }, []);

  const toggleMute = () => { audioRef.current.muted = !muted; setMuted(!muted); };

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden bg-[#0d1117] select-none">
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3">
        <Link href="/games"><button data-testid="button-back-arena" className="w-10 h-10 rounded-full bg-white/5 backdrop-blur border border-white/10 flex items-center justify-center text-white/80 hover:text-cyan-300 transition-colors"><ArrowLeft size={18} /></button></Link>
        <div className="flex flex-col items-center -mt-1">
          <span className="text-[10px] tracking-[0.3em] text-cyan-400/70 font-display uppercase">{phase === "playing" ? "Coins" : "ZigZag Driver"}</span>
          <span data-testid="text-score" className="font-display font-black text-4xl text-white leading-none drop-shadow-[0_0_18px_rgba(76,201,240,0.55)]">{score}</span>
          {phase === "playing" && <span className="text-[9px] tracking-[0.25em] text-cyan-300/80 font-display uppercase mt-0.5">GOAL {target}</span>}
        </div>
        <button data-testid="button-toggle-mute" onClick={toggleMute} className="w-10 h-10 rounded-full bg-white/5 backdrop-blur border border-white/10 flex items-center justify-center text-white/80 hover:text-cyan-300 transition-colors">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
      </div>

      {phase === "playing" && (
        <div className="absolute top-[84px] left-1/2 -translate-x-1/2 z-30 w-[68%] flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-[0.25em] text-cyan-400/90 font-display uppercase">Coins</span><span data-testid="text-progress" className="text-[11px] font-display font-bold tracking-wider tabular-nums text-white/90">{score} / {target}</span></div>
            <div className="relative w-full h-2.5 rounded-full bg-white/10 overflow-hidden border border-cyan-500/20"><div data-testid="bar-progress" className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-400 shadow-[0_0_14px_rgba(76,201,240,0.6)] transition-[width] duration-300 ease-out" style={{ width: `${target > 0 ? Math.min(100, (score / target) * 100) : 0}%` }} /></div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-[0.25em] text-white/40 font-display uppercase">Time</span><span data-testid="text-timer" className={`text-[11px] font-display font-bold tracking-wider tabular-nums ${timeLeft <= 5 ? "text-red-400" : "text-white/80"}`}>{timeLeft}s</span></div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden"><div ref={timerBarRef} data-testid="bar-timer" className="h-full rounded-full" style={{ width: "100%" }} /></div>
          </div>
        </div>
      )}

      <div ref={wrapRef} className="flex-1 relative" onPointerDown={onTap}>
        <canvas ref={canvasRef} data-testid="canvas-zigzag" className="absolute inset-0 touch-none" />
        {phase === "playing" && <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none"><span className="text-[10px] text-white/25 font-display tracking-[0.25em] uppercase">TAP to change direction</span></div>}
      </div>

      <AnimatePresence>{phase === "select" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col bg-black/78 backdrop-blur-md px-6 pt-16 pb-6 overflow-y-auto">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-cyan-400" /><span className="text-[11px] tracking-[0.4em] text-white/50 font-display uppercase">ZigZag Driver</span></div>
            <h1 className="font-display font-black text-2xl leading-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-cyan-300 to-blue-400 mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/40 mb-4 max-w-[260px]">TAP to flip direction. Collect gold coins on dangerous corners. Don't fall off the edge!</p>
            <div className="flex items-center gap-2 mb-5 px-4 py-2 rounded-xl bg-cyan-400/10 border border-cyan-400/30"><Coins size={14} className="text-cyan-300" /><span data-testid="text-balance" className="text-sm font-display font-bold text-cyan-300 tracking-wide">{balance.toLocaleString()} SKZ</span></div>
            <div className="w-full flex flex-col gap-2.5">
              {TICKETS.map(t => { const ok = t.price <= balance; return (
                <button key={t.id} disabled={!ok} onClick={() => ok && playTicket(t)} data-testid={`button-ticket-${t.id}`}
                  className={`w-full flex items-center justify-between rounded-2xl border p-3.5 transition-all ${ok ? "bg-white/5 border-white/10 hover:border-cyan-400/50 active:scale-[0.98]" : "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed"}`}>
                  <div className="flex flex-col items-start"><span className="font-display font-bold text-base text-white tracking-wide">{t.name}</span><span className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Goal {t.target} coins · {t.time}s</span></div>
                  <div className="flex flex-col items-end"><span className="flex items-center gap-1 text-cyan-300 font-display font-bold text-sm"><Coins size={12} />{t.prize.toLocaleString()}</span><span className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Entry {t.price}</span></div>
                </button>
              ); })}
            </div>
            <div className="flex items-center gap-1.5 mt-5 text-[11px] text-white/40"><Trophy size={11} className="text-cyan-400" /><span data-testid="text-best">Best {best}</span></div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
      <GameOverOverlay show={phase === "lost"} entryFee={ticket?.price ?? 0} score={score} target={target} balance={balance} lostReason={lostReason} onRetry={() => { setLostReason(null); setPhase("select"); }} />
      <GameWonOverlay show={phase === "won"} prize={ticket?.prize ?? 0} score={score} target={target} balance={balance} onRetry={() => setPhase("select")} />
    </div>
  );
}