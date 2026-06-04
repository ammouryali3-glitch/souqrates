import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Volume2, VolumeX, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }

const BEST_KEY = "skz_dune_best";
const BALANCE_KEY = "skz_balance";
const START_BALANCE = 1000;
const GRAVITY_BASE = 1400;
const GRAVITY_HOLD = 3200;
const JUMP_BOOST = -520;
const BALL_RADIUS = 14;
const SCROLL_SPEED_BASE = 200;

const TICKETS: Ticket[] = [
  { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 8,  time: 35 },
  { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 12, time: 33 },
  { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 16, time: 31 },
  { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 20, time: 30 },
  { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 25, time: 28 },
];

interface HillPoint { x: number; y: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number; }

interface GameState {
  ballX: number; ballY: number; ballVY: number;
  scrollX: number; scrollSpeed: number;
  hill: HillPoint[];
  hillSeed: number;
  particles: Particle[];
  airTime: number; airBonus: number; prevOnGround: boolean;
  onGround: boolean;
  holdingDown: boolean;
  score: number; target: number; timeLeft: number; timeMax: number;
  running: boolean; lastTime: number;
  flashT: number; goodFlashT: number;
  crashing: boolean; crashT: number;
  combo: number;
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
    const da = buf.getChannelData(0); for (let i = 0; i < da.length; i++) da[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / da.length, 2);
    const src = ctx.createBufferSource(); src.buffer = buf; const g = ctx.createGain(); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    const flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = cf;
    src.connect(flt); flt.connect(g); g.connect(this.master); src.start(t0);
  }
  land(smooth: boolean) { if (smooth) { this.tone(300, 0.08, "sine", 0.3, 0, 450); } else { this.noise(0.3, 0.6, 800); this.tone(80, 0.3, "sawtooth", 0.4); } }
  airBonus() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.3, i * 0.05)); }
  jump() { this.tone(440, 0.1, "triangle", 0.3, 0, 880); }
  score_() { this.tone(660, 0.12, "triangle", 0.28); }
  crash() { this.noise(0.6, 0.8, 1200); this.tone(60, 0.5, "sawtooth", 0.5); }
  start_() { [392, 523, 659].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.32, i * 0.06)); }
  goal() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.24, "triangle", 0.38, i * 0.07)); }
  gameOver() { [392, 311, 261, 196].forEach((f, i) => this.tone(f, 0.3, "sawtooth", 0.28, i * 0.12)); }
  tick(u = false) { this.tone(u ? 900 : 650, 0.07, "square", u ? 0.22 : 0.13); }
  dispose() { if (this.ctx) { void this.ctx.close(); this.ctx = null; this.master = null; } }
}

// Seeded pseudo-random hill generation
function seededRand(seed: number): () => number {
  let s = seed; return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function generateHill(startX: number, seed: number, count: number, w: number, h: number): HillPoint[] {
  const rng = seededRand(seed); const pts: HillPoint[] = [];
  let x = startX; let baseY = h * 0.58;
  for (let i = 0; i < count; i++) {
    const segW = 100 + rng() * 120;
    const drop = (rng() - 0.4) * 160;
    const nextY = Math.max(h * 0.35, Math.min(h * 0.75, baseY + drop));
    const cp1x = x + segW * 0.35; const cp1y = baseY + (rng() - 0.5) * 60;
    const cp2x = x + segW * 0.65; const cp2y = nextY + (rng() - 0.5) * 60;
    // Approximate the bezier with many points
    for (let t2 = 0; t2 <= 1; t2 += 0.03) {
      const t3 = t2; const mt = 1 - t3;
      const bx = mt*mt*mt*x + 3*mt*mt*t3*cp1x + 3*mt*t3*t3*cp2x + t3*t3*t3*(x+segW);
      const by = mt*mt*mt*baseY + 3*mt*mt*t3*cp1y + 3*mt*t3*t3*cp2y + t3*t3*t3*nextY;
      pts.push({ x: bx, y: by });
    }
    x += segW; baseY = nextY;
  }
  return pts;
}

function getHillY(pts: HillPoint[], worldX: number): number {
  if (!pts.length) return 300;
  let lo = 0, hi = pts.length - 1;
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (pts[mid].x <= worldX) lo = mid; else hi = mid; }
  const a = pts[lo]; const b = pts[lo + 1] || a;
  if (!b || b.x === a.x) return a.y;
  const t2 = Math.max(0, Math.min(1, (worldX - a.x) / (b.x - a.x)));
  return a.y + (b.y - a.y) * t2;
}

function getHillAngle(pts: HillPoint[], worldX: number): number {
  const dx = 8;
  const y1 = getHillY(pts, worldX - dx); const y2 = getHillY(pts, worldX + dx);
  return Math.atan2(y2 - y1, dx * 2);
}

export default function DuneGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const rafRef = useRef(0);
  const audioRef = useRef(new AudioEngine());
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const lastSecRef = useRef(0);
  const timerBarRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef(false);
  const startingRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("select");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [muted, setMuted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [balance, setBalance] = useState(START_BALANCE);
  const [airBonusDisplay, setAirBonusDisplay] = useState(0);
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

  const loop = useCallback((time: number) => {
    const g = gameRef.current; const canvas = canvasRef.current; if (!g || !canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const { w, h, dpr } = sizeRef.current;
    if (!g.lastTime) g.lastTime = time;
    const dt = Math.min((time - g.lastTime) / 1000, 0.05); g.lastTime = time;

    // --- Update ---
    if (g.running) {
      g.timeLeft = Math.max(0, g.timeLeft - dt);
      const sec = Math.ceil(g.timeLeft);
      if (sec !== lastSecRef.current) { lastSecRef.current = sec; setTimeLeft(sec); if (sec <= 5 && sec > 0) audioRef.current.tick(sec <= 3); }
      const bar = timerBarRef.current;
      const ratio = Math.max(0, g.timeLeft / g.timeMax);
      if (bar) { bar.style.width = `${ratio * 100}%`; bar.style.backgroundImage = ratio <= 0.28 ? "linear-gradient(to right,rgb(239,68,68),rgb(251,146,60))" : "linear-gradient(to right,#F7971E,#FFD200)"; }
      if (g.timeLeft <= 0) { endRef.current(g.score, "time"); return; }
    }

    if (!g.crashing && g.running) {
      // Gravity
      const grav = g.holdingDown ? GRAVITY_HOLD : GRAVITY_BASE;
      g.ballVY += grav * dt;
      g.ballY += g.ballVY * dt;

      // Scroll
      g.scrollSpeed = Math.min(SCROLL_SPEED_BASE + g.score * 8, 420);
      g.scrollX += g.scrollSpeed * dt;
      g.ballX = w * 0.3;

      // Extend hill if needed
      if (g.hill.length > 0 && g.scrollX + w > (g.hill[g.hill.length - 1]?.x ?? 0) - 200) {
        const newPts = generateHill(g.hill[g.hill.length - 1]?.x ?? g.scrollX, g.hillSeed + g.hill.length, 8, w, h);
        g.hillSeed++;
        g.hill = g.hill.concat(newPts);
      }
      // Trim old hill points
      if (g.hill.length > 600) g.hill = g.hill.slice(200);

      // Ground detection
      const worldBallX = g.scrollX + g.ballX;
      const groundY = getHillY(g.hill, worldBallX);
      const hillAngle = getHillAngle(g.hill, worldBallX);

      const wasOnGround = g.onGround;
      if (g.ballY + BALL_RADIUS >= groundY) {
        g.ballY = groundY - BALL_RADIUS;
        const landingAngle = Math.abs(hillAngle);

        if (!wasOnGround && g.ballVY > 80) {
          // Landing
          if (landingAngle > 0.55) {
            // Crash
            g.crashing = true; g.crashT = 0.8;
            audioRef.current.crash();
            g.flashT = 0.7;
            // Spawn crash particles
            for (let i = 0; i < 18; i++) {
              const a = Math.random() * Math.PI * 2; const spd = 80 + Math.random() * 250;
              g.particles.push({ x: g.ballX, y: g.ballY, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 100, life: 0.8, max: 0.8, color: i % 2 === 0 ? "#FFD200" : "#ff7b00", r: 3 + Math.random() * 5 });
            }
            // Time penalty
            g.timeLeft = Math.max(0, g.timeLeft - 4);
          } else {
            // Smooth landing
            const smoothness = 1 - landingAngle / 0.55;
            const speedBoost = smoothness * 60;
            g.scrollSpeed += speedBoost;
            // Air time bonus
            if (g.airTime > 0.4) {
              const bonus = Math.floor(g.airTime * 3);
              g.score += bonus; setScore(g.score);
              g.airBonus = bonus;
              setAirBonusDisplay(bonus);
              setTimeout(() => setAirBonusDisplay(0), 1200);
              audioRef.current.airBonus();
            } else {
              audioRef.current.land(true);
            }
          }
          g.airTime = 0;
        }

        g.onGround = true;
        if (g.ballVY > 0) g.ballVY = 0;

        // Dust particles on ground
        if (wasOnGround && g.scrollSpeed > 220 && Math.random() < 0.4) {
          for (let i = 0; i < 2; i++) g.particles.push({ x: g.ballX - 5 + Math.random() * 10, y: g.ballY + BALL_RADIUS, vx: -g.scrollSpeed * 0.2 + (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 40, life: 0.5, max: 0.5, color: "#d4956a", r: 2 + Math.random() * 3 });
        }
      } else {
        g.onGround = false;
        g.airTime += dt;
      }

      // Score from distance
      const prevScore = g.score;
      g.score = Math.floor(g.scrollX / 400);
      if (g.score > prevScore) { setScore(g.score); audioRef.current.score_(); if (g.score >= g.target) endRef.current(g.score, "win"); }
      if (g.prevOnGround !== g.onGround && !g.onGround) { audioRef.current.jump(); }
      g.prevOnGround = g.onGround;
    } else if (g.crashing) {
      g.crashT -= dt;
      g.ballVY += GRAVITY_BASE * dt;
      g.ballY += g.ballVY * dt;
      if (g.crashT <= 0) { g.crashing = false; g.ballVY = 0; }
    }

    g.flashT = Math.max(0, (g.flashT ?? 0) - dt);
    g.goodFlashT = Math.max(0, (g.goodFlashT ?? 0) - dt);

    // Update particles
    for (const p of g.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; }
    g.particles = g.particles.filter(p => p.life > 0);

    // ---- Render ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Parallax sky – desert sunset gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, "#1a0a2e");
    skyGrad.addColorStop(0.3, "#3d1454");
    skyGrad.addColorStop(0.55, "#c84b11");
    skyGrad.addColorStop(0.75, "#f7971e");
    skyGrad.addColorStop(1, "#ffd200");
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, w, h);

    // Sun
    const sunX = w * 0.72; const sunY = h * 0.3;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 55);
    sunGrad.addColorStop(0, "#fff7d6"); sunGrad.addColorStop(0.4, "#ffd200"); sunGrad.addColorStop(1, "rgba(255,140,0,0)");
    ctx.fillStyle = sunGrad; ctx.beginPath(); ctx.arc(sunX, sunY, 55, 0, Math.PI * 2); ctx.fill();

    // Parallax dune layers (far, mid, near)
    const t2 = Date.now() * 0.0001;
    drawParallaxDunes(ctx, w, h, g.scrollX * 0.12, t2, "#2a0a3a", 0.28, 0.7);
    drawParallaxDunes(ctx, w, h, g.scrollX * 0.3, t2 + 1, "#6b2d0a", 0.42, 0.55);
    drawParallaxDunes(ctx, w, h, g.scrollX * 0.55, t2 + 2, "#c85e0a", 0.56, 0.42);

    // Hill (main terrain)
    if (g.hill.length > 1) {
      ctx.save();
      ctx.translate(-g.scrollX, 0);
      ctx.beginPath();
      ctx.moveTo(g.hill[0].x, h + 20);
      ctx.lineTo(g.hill[0].x, g.hill[0].y);
      for (let i = 1; i < g.hill.length; i++) ctx.lineTo(g.hill[i].x, g.hill[i].y);
      ctx.lineTo(g.hill[g.hill.length - 1].x, h + 20);
      ctx.closePath();
      const terrainGrad = ctx.createLinearGradient(0, h * 0.4, 0, h);
      terrainGrad.addColorStop(0, "#e8a050");
      terrainGrad.addColorStop(0.4, "#c47a2a");
      terrainGrad.addColorStop(1, "#5c2e08");
      ctx.fillStyle = terrainGrad;
      ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Terrain highlight stripe
      ctx.strokeStyle = "rgba(255,220,100,0.35)"; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < g.hill.length; i++) { if (i === 0) ctx.moveTo(g.hill[i].x, g.hill[i].y); else ctx.lineTo(g.hill[i].x, g.hill[i].y); }
      ctx.stroke();
      ctx.restore();
    }

    // Particles
    for (const p of g.particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Ball
    if (!g.crashing || Math.floor(g.crashT * 12) % 2 === 0) {
      const worldBallX = g.scrollX + g.ballX;
      const hillAngle = getHillAngle(g.hill, worldBallX);
      ctx.save();
      ctx.translate(g.ballX, g.ballY);
      if (g.onGround) ctx.rotate(hillAngle);

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(0, BALL_RADIUS + 2, 16, 5, 0, 0, Math.PI * 2); ctx.fill();

      // Ball gradient
      const ballGrad = ctx.createRadialGradient(-4, -5, 2, 0, 0, BALL_RADIUS);
      ballGrad.addColorStop(0, "#fff9e6");
      ballGrad.addColorStop(0.4, "#ffd200");
      ballGrad.addColorStop(0.8, "#f7971e");
      ballGrad.addColorStop(1, "#c84b11");
      ctx.fillStyle = ballGrad;
      ctx.shadowColor = "rgba(255,140,0,0.7)"; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Air glow when flying
      if (!g.onGround && g.airTime > 0.2) {
        ctx.strokeStyle = `rgba(255,200,0,${Math.min(0.8, g.airTime)})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, BALL_RADIUS + 5, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }

    // Flash overlays
    if ((g.flashT ?? 0) > 0) { ctx.fillStyle = `rgba(220,50,0,${(g.flashT / 0.7) * 0.38})`; ctx.fillRect(0, 0, w, h); }

    if (g.running || g.particles.length > 0) rafRef.current = requestAnimationFrame(loop);
  }, []);

  const startLoop = useCallback(() => { cancelAnimationFrame(rafRef.current); if (gameRef.current) gameRef.current.lastTime = 0; rafRef.current = requestAnimationFrame(loop); }, [loop]);

  const playTicket = useCallback((t: Ticket) => {
    if (startingRef.current || t.price > balance) return; startingRef.current = true;
    setBalance(prev => { const n = prev - t.price; localStorage.setItem(BALANCE_KEY, String(n)); return n; });
    audioRef.current.start_();
    setTicket(t);
    const { h } = sizeRef.current;
    const hillPts = generateHill(0, 42, 20, 600, h || 500);
    gameRef.current = {
      ballX: 0, ballY: (getHillY(hillPts, 0) - BALL_RADIUS - 1), ballVY: 0,
      scrollX: 0, scrollSpeed: SCROLL_SPEED_BASE,
      hill: hillPts, hillSeed: 100,
      particles: [],
      airTime: 0, airBonus: 0, prevOnGround: true,
      onGround: true, holdingDown: false,
      score: 0, target: t.target, timeLeft: t.time, timeMax: t.time,
      running: true, lastTime: 0,
      flashT: 0, goodFlashT: 0,
      crashing: false, crashT: 0, combo: 0,
    };
    lastSecRef.current = t.time; setScore(0); setTimeLeft(t.time);
    if (timerBarRef.current) timerBarRef.current.style.width = "100%";
    setPhase("playing"); startLoop();
  }, [balance, startLoop]);

  useEffect(() => { const audio = audioRef.current; return () => { cancelAnimationFrame(rafRef.current); audio.dispose(); }; }, []);

  const onPointerDown = useCallback(() => {
    holdRef.current = true; if (gameRef.current) gameRef.current.holdingDown = true;
    if (gameRef.current?.onGround && gameRef.current.running && !gameRef.current.crashing) {
      gameRef.current.ballVY = JUMP_BOOST; gameRef.current.onGround = false;
    }
  }, []);

  const onPointerUp = useCallback(() => {
    holdRef.current = false; if (gameRef.current) gameRef.current.holdingDown = false;
  }, []);

  const refillBalance = useCallback(() => { setBalance(START_BALANCE); localStorage.setItem(BALANCE_KEY, String(START_BALANCE)); }, []);
  const toggleMute = () => { audioRef.current.muted = !muted; setMuted(!muted); };

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{ background: "#1a0a2e" }}>
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3">
        <Link href="/games"><button className="w-10 h-10 rounded-full bg-black/30 backdrop-blur border border-amber-400/30 flex items-center justify-center text-amber-300 hover:text-white transition-colors"><ArrowLeft size={18} /></button></Link>
        <div className="flex flex-col items-center">
          <span className="text-[10px] tracking-[0.3em] text-amber-300/70 font-display uppercase">{phase === "playing" ? "SCORE" : "BOUNCY DUNE"}</span>
          <span data-testid="text-score" className="font-display font-black text-4xl text-amber-300 leading-none drop-shadow-[0_0_18px_rgba(255,200,0,0.7)]">{score}</span>
          {phase === "playing" && <span className="text-[9px] tracking-[0.25em] text-amber-300/60 font-display uppercase mt-0.5">GOAL {target}</span>}
        </div>
        <button onClick={toggleMute} className="w-10 h-10 rounded-full bg-black/30 backdrop-blur border border-amber-400/30 flex items-center justify-center text-amber-300">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
      </div>

      {airBonusDisplay > 0 && phase === "playing" && (
        <motion.div initial={{ opacity: 1, y: 0, scale: 1 }} animate={{ opacity: 0, y: -60, scale: 1.3 }} transition={{ duration: 1.2 }} className="absolute top-1/3 left-1/2 -translate-x-1/2 z-30 font-display font-black text-2xl text-yellow-300 drop-shadow-[0_0_14px_rgba(255,220,0,0.9)] pointer-events-none">
          ✈ AIR +{airBonusDisplay}
        </motion.div>
      )}

      {phase === "playing" && (
        <div className="absolute top-[84px] left-1/2 -translate-x-1/2 z-30 w-[72%] flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-[0.25em] text-amber-300/70 font-display uppercase">Progress</span><span data-testid="text-progress" className="text-[11px] font-mono font-bold tabular-nums text-white/90">{score} / {target}</span></div>
            <div className="relative w-full h-2.5 rounded-full bg-white/10 overflow-hidden border border-amber-400/20"><div data-testid="bar-progress" className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 shadow-[0_0_12px_rgba(255,180,0,0.6)] transition-[width] duration-300" style={{ width: `${target > 0 ? Math.min(100, (score / target) * 100) : 0}%` }} /></div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5"><span className="text-[9px] tracking-[0.25em] text-white/40 font-display uppercase">Time</span><span data-testid="text-timer" className={`text-[11px] font-mono font-bold tabular-nums ${timeLeft <= 5 ? "text-red-400" : "text-white/70"}`}>{timeLeft}s</span></div>
            <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} data-testid="bar-timer" className="h-full rounded-full" style={{ width: "100%" }} /></div>
          </div>
        </div>
      )}

      <div ref={wrapRef} className="flex-1 relative" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
        <canvas ref={canvasRef} className="absolute inset-0 touch-none" />
        {phase === "playing" && <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[11px] text-amber-300/50 font-display tracking-widest uppercase pointer-events-none">HOLD = Dive · Release = Fly</div>}
      </div>

      <AnimatePresence>{phase === "select" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col px-6 pt-16 pb-6 overflow-y-auto" style={{ background: "linear-gradient(to bottom,rgba(26,10,46,0.97),rgba(61,20,84,0.97))" }}>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <div className="text-4xl mb-2">🏜️</div>
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-amber-400" /><span className="text-[11px] tracking-[0.4em] text-amber-400/60 uppercase">Bouncy Dune</span></div>
            <h1 className="font-display font-black text-2xl text-amber-300 mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/50 mb-4 max-w-[260px]">Hold to dive down slopes, release to launch! Smooth landings gain speed. Bad angles = crash & time penalty.</p>
            <div className="flex items-center gap-2 mb-5 px-4 py-2 rounded-xl bg-amber-400/10 border border-amber-400/30"><Coins size={14} className="text-amber-400" /><span data-testid="text-balance" className="text-sm font-mono font-bold text-amber-400">{balance.toLocaleString()} SKZ</span></div>
            <div className="w-full flex flex-col gap-2.5">
              {TICKETS.map(t => { const ok = t.price <= balance; return (
                <button key={t.id} disabled={!ok} onClick={() => ok && playTicket(t)} data-testid={`button-ticket-${t.id}`}
                  className={`w-full flex items-center justify-between rounded-2xl border p-3.5 transition-all ${ok ? "bg-amber-400/8 border-amber-400/30 hover:border-amber-400 active:scale-[0.98]" : "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed"}`}>
                  <div className="flex flex-col items-start"><span className="font-mono font-bold text-base text-amber-300">{t.name}</span><span className="text-[10px] text-white/40 font-mono uppercase mt-0.5">Goal {t.target} · {t.time}s</span></div>
                  <div className="flex flex-col items-end"><span className="flex items-center gap-1 text-amber-400 font-mono font-bold text-sm"><Coins size={12} />{t.prize.toLocaleString()}</span><span className="text-[10px] text-white/40 font-mono uppercase mt-0.5">Entry {t.price}</span></div>
                </button>
              ); })}
            </div>
            <div className="flex items-center gap-1.5 mt-5 text-[11px] text-white/40"><Trophy size={11} className="text-amber-400" /><span data-testid="text-best" className="font-mono">Best {best}</span></div>
            {balance < 30 ? (<button onClick={refillBalance} data-testid="button-refill" className="mt-5 w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 text-black font-mono font-bold text-sm tracking-widest shadow-[0_0_24px_rgba(255,180,0,0.5)] active:scale-95 transition-transform">🎁 GET 1,000 FREE CHIPS</button>) : (<button onClick={refillBalance} data-testid="button-refill" className="mt-3 text-[10px] text-white/25 hover:text-white/50 transition-colors underline underline-offset-2 font-mono">Low on chips? Get 1,000 free</button>)}
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      <AnimatePresence>{phase === "won" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col items-center justify-center px-8" style={{ background: "rgba(26,10,46,0.92)" }}>
          <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.4 }} className="w-full max-w-[300px] flex flex-col items-center text-center">
            <div className="text-5xl mb-3">🏆</div>
            <span data-testid="text-result" className="text-xs tracking-[0.4em] font-display uppercase mb-2 text-amber-300">Dune Master!</span>
            <div className="font-display font-black text-5xl text-amber-300 mb-1">+{ticket?.prize.toLocaleString()}</div>
            <span className="text-sm text-white/50 mb-6 font-mono">SKZ prize claimed</span>
            <div className="w-full grid grid-cols-2 gap-3 mb-7">
              <div className="bg-amber-400/8 border border-amber-400/30 rounded-2xl p-3 flex flex-col items-center"><div className="text-white/40 text-[10px] font-mono uppercase mb-1">Score</div><span data-testid="text-final-score" className="font-mono font-bold text-xl text-amber-300">{score}</span></div>
              <div className="bg-amber-400/8 border border-amber-400/30 rounded-2xl p-3 flex flex-col items-center"><div className="text-white/40 text-[10px] font-mono uppercase mb-1">Balance</div><span data-testid="text-balance-final" className="font-mono font-bold text-xl text-amber-300">{balance.toLocaleString()}</span></div>
            </div>
            <button onClick={() => setPhase("select")} data-testid="button-replay" className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 text-black font-mono font-bold tracking-widest flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform"><RotateCcw size={18} />PLAY AGAIN</button>
            <Link href="/games"><button data-testid="button-exit" className="text-sm text-amber-300/40 hover:text-amber-300 font-mono">← Back to Arena</button></Link>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      <AnimatePresence>{phase === "lost" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col items-center justify-center px-8" style={{ background: "rgba(26,10,46,0.92)" }}>
          <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.35 }} className="w-full max-w-[300px] flex flex-col items-center text-center">
            <div className="text-5xl mb-3">⏱️</div>
            <span data-testid="text-result" className="text-xs tracking-[0.4em] font-display uppercase mb-2 text-red-400">Time's Up!</span>
            <div data-testid="text-loss-amount" className="font-display font-black text-5xl text-red-400 mb-1">-{ticket?.price ?? 0}</div>
            <span className="text-sm text-white/50 mb-6 font-mono">SKZ entry lost</span>
            <div className="w-full grid grid-cols-2 gap-3 mb-7">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center"><div className="text-white/40 text-[10px] font-mono uppercase mb-1">Score</div><span data-testid="text-final-score" className="font-mono font-bold text-xl text-white">{score}/{target}</span></div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center"><div className="text-white/40 text-[10px] font-mono uppercase mb-1">Balance</div><span data-testid="text-balance-final" className="font-mono font-bold text-xl text-white">{balance.toLocaleString()}</span></div>
            </div>
            <button onClick={() => setPhase("select")} data-testid="button-replay" className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 text-black font-mono font-bold tracking-widest flex items-center justify-center gap-2 mb-3 active:scale-95"><RotateCcw size={18} />TRY AGAIN</button>
            <Link href="/games"><button data-testid="button-exit" className="text-sm text-amber-300/40 hover:text-amber-300 font-mono">← Back to Arena</button></Link>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}

function drawParallaxDunes(ctx: CanvasRenderingContext2D, w: number, h: number, scrollX: number, seed: number, color: string, yFrac: number, alpha: number) {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(0, h);
  const count = 5; const rng = seededRand(Math.floor(seed * 100 + scrollX * 0.001) | 0);
  const offset = (scrollX % (w / count));
  for (let i = 0; i <= count + 1; i++) {
    const x0 = i * (w / count) - offset - w / count;
    const x1 = x0 + w / count;
    const cy = h * yFrac - 40 - rng() * 60;
    ctx.lineTo(x0, h * yFrac + 10);
    ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.5, cy, x1, h * yFrac + 10);
  }
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  ctx.restore();
}
