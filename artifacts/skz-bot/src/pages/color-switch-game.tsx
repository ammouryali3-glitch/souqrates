import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Volume2, VolumeX, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";
import { GAME_TICKETS } from "@/lib/tickets-data";

type Phase = "select" | "playing" | "won" | "lost";

interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }
interface Particle { x: number; y: number; vx: number; vy: number; r: number; color: string; life: number; max: number; }

interface Ring {
  angle: number; omega: number; segOrder: number[]; // 4 indices into NEONS
  innerAngle: number; innerOmega: number; innerSegOrder: number[];
  innerEnabled: boolean;
  pulseT: number; transitioning: boolean; transitionT: number;
}
interface Ball { y: number; vy: number; colorIdx: number; prevY: number; }

interface GameState {
  ball: Ball; ring: Ring;
  particles: Particle[];
  score: number; target: number; timeLeft: number; timeMax: number;
  running: boolean; lastTime: number;
  checkLock: boolean; // prevent re-triggering during same pass
  shakeT: number; shakeMag: number; flashT: number; goodFlashT: number;
}

const BEST_KEY = "skz_color_best";
const BALANCE_KEY = "skz_balance";
const START_BALANCE = 1000;
const TWO_PI = Math.PI * 2;
const NEONS = ["#00d4ff", "#ff0099", "#ffee00", "#39ff14"] as const;
const NEON_DARK = ["#005577", "#660040", "#665c00", "#006600"] as const;

const RAW_TICKETS: Ticket[] = GAME_TICKETS.color;

const RING_O = 76; const RING_I = 50; // outer/inner radius of ring
const INNER_O = 40; const INNER_I = 20; // inner decoy ring
const BALL_R = 16;
const GAP = 0.16; // gap arc (radians) between segments
const SEG = (TWO_PI - GAP * 4) / 4; // each segment arc ≈ 1.41 rad
const SLOT = SEG + GAP; // ≈ PI/2 (each of 4 slots)
const GRAVITY = 1120;
const JUMP_V = -755;

function shuffle4(base: number[]): number[] {
  const a = [...base];
  for (let i = 3; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function checkGate(angle: number): { inGap: boolean; segIdx: number } {
  const GATE = Math.PI / 2; // 6-o'clock in canvas (y-down)
  const rel = ((GATE - angle) % TWO_PI + TWO_PI) % TWO_PI;
  const slot = Math.floor(rel / SLOT);
  const within = rel - slot * SLOT;
  return { inGap: within > SEG, segIdx: slot % 4 };
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
  match(score: number) { const step = [0,4,7,11,12,14,16,19][Math.min(score,7)]; const f = 523.25*Math.pow(2,step/12); this.tone(f,0.22,"triangle",0.45); this.tone(f*2,0.12,"sine",0.2,0.06); }
  fail() { this.noise(0.4,0.7,9000); this.tone(140,0.3,"sawtooth",0.5); }
  tick(u=false) { this.tone(u?900:650,0.07,"square",u?0.22:0.13); }
  start() { [392,523,659].forEach((f,i)=>this.tone(f,0.18,"triangle",0.32,i*0.06)); }
  goal() { [523,659,784,1047].forEach((f,i)=>this.tone(f,0.24,"triangle",0.38,i*0.07)); this.tone(262,0.5,"sine",0.2); }
  gameOver() { [392,311,261,196].forEach((f,i)=>this.tone(f,0.3,"sawtooth",0.28,i*0.12)); }
  dispose() { if (this.ctx) { void this.ctx.close(); this.ctx=null; this.master=null; } }
}

export default function ColorSwitchGame() {
  const TICKETS = useGameTickets("color", RAW_TICKETS);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const rafRef = useRef(0);
  const audioRef = useRef(new AudioEngine());
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const lastSecRef = useRef(0);
  const timerBarRef = useRef<HTMLDivElement>(null);

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
    const b = localStorage.getItem(BALANCE_KEY); setBalance(b===null?START_BALANCE:Number(b));
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current; const wrap = wrapRef.current; if (!canvas||!wrap) return;
    const dpr = Math.min(window.devicePixelRatio||1, 2.5); const w = wrap.clientWidth; const h = wrap.clientHeight;
    canvas.width = w*dpr; canvas.height = h*dpr; canvas.style.width=`${w}px`; canvas.style.height=`${h}px`;
    sizeRef.current = {w,h,dpr};
  }, []);

  useEffect(() => { resize(); const ro = new ResizeObserver(resize); if (wrapRef.current) ro.observe(wrapRef.current); return ()=>ro.disconnect(); }, [resize]);

  const makeRing = (score: number): Ring => {
    const seg = shuffle4([0,1,2,3]);
    return {
      angle: Math.random()*TWO_PI, omega: (1.6+Math.random()*0.4)*(Math.random()<0.5?1:-1),
      segOrder: seg,
      innerAngle: Math.random()*TWO_PI, innerOmega: (2.2+Math.random()*0.6)*(Math.random()<0.5?1:-1),
      innerSegOrder: shuffle4([0,1,2,3]),
      innerEnabled: score >= 10,
      pulseT: 0, transitioning: false, transitionT: 0,
    };
  };

  const newGameState = useCallback((t: Ticket): GameState => ({
    ball: { y: 0.82, vy: 0, colorIdx: Math.floor(Math.random()*4), prevY: 0.82 },
    ring: { angle: 0, omega: 1.7, segOrder: shuffle4([0,1,2,3]), innerAngle:0, innerOmega:2.3, innerSegOrder: shuffle4([0,1,2,3]), innerEnabled: false, pulseT: 0, transitioning: false, transitionT: 0 },
    particles: [],
    score: 0, target: t.target, timeLeft: t.time, timeMax: t.time,
    running: true, lastTime: 0, checkLock: false,
    shakeT: 0, shakeMag: 0, flashT: 0, goodFlashT: 0,
  }), []);

  const burst = (g: GameState, cx: number, y: number, color: string, n = 20) => {
    for (let i=0;i<n;i++) { const a=Math.random()*TWO_PI; const sp=80+Math.random()*380; g.particles.push({x:cx,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:3+Math.random()*5,color,life:0.4+Math.random()*0.5,max:1}); }
  };

  const loop = useCallback((time: number) => {
    const g = gameRef.current; const canvas = canvasRef.current; if (!g||!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const {w,h,dpr} = sizeRef.current;
    if (!g.lastTime) g.lastTime = time;
    const dt = Math.min((time-g.lastTime)/1000, 0.05); g.lastTime = time;

    const RING_Y = h * 0.40;
    const FLOOR_Y = h * 0.82;
    const cx = w/2;

    // Timer
    if (g.running) {
      g.timeLeft = Math.max(0, g.timeLeft - dt);
      const sec = Math.ceil(g.timeLeft);
      if (sec !== lastSecRef.current) { lastSecRef.current = sec; setTimeLeft(sec); if (sec<=5&&sec>0) audioRef.current.tick(sec<=3); }
      const ratio = Math.max(0, g.timeLeft/g.timeMax);
      const bar = timerBarRef.current;
      if (bar) { bar.style.width=`${ratio*100}%`; bar.style.backgroundImage=ratio<=0.28?"linear-gradient(to right,rgb(239,68,68),rgb(251,146,60))":"linear-gradient(to right,hsl(280 80% 60%),hsl(310 70% 65%))"; }
      if (g.timeLeft<=0) endRef.current(g.score,"time");
    }

    // Ring rotation
    if (!g.ring.transitioning) {
      g.ring.angle += g.ring.omega * dt;
      g.ring.innerAngle += g.ring.innerOmega * dt;
      if (g.ring.pulseT > 0) g.ring.pulseT = Math.max(0, g.ring.pulseT - dt);
    } else {
      g.ring.transitionT -= dt;
      if (g.ring.transitionT <= 0) g.ring.transitioning = false;
    }

    // Ball physics
    g.ball.prevY = g.ball.y;
    g.ball.vy += GRAVITY * dt;
    g.ball.y += g.ball.vy * dt;
    if (g.ball.y >= FLOOR_Y) { g.ball.y = FLOOR_Y; g.ball.vy = 0; }
    if (g.ball.y < 0) { g.ball.y = 0; g.ball.vy = Math.abs(g.ball.vy) * 0.5; }
    if (g.ball.y > h+50 && g.running) endRef.current(g.score, "time");

    // Collision detection (ball approaching ring from below)
    if (g.running && !g.ring.transitioning) {
      const ballTop = g.ball.y - BALL_R;
      const prevBallTop = g.ball.prevY - BALL_R;
      const ringBottom = RING_Y + RING_O;

      // Ball is moving UP and its top crosses ring bottom
      if (prevBallTop >= ringBottom && ballTop < ringBottom && g.ball.vy < 0) {
        if (!g.checkLock) {
          g.checkLock = true;
          const outer = checkGate(g.ring.angle);
          let pass = !outer.inGap && g.ring.segOrder[outer.segIdx] === g.ball.colorIdx;

          // If inner ring enabled, must also pass inner check
          if (pass && g.ring.innerEnabled) {
            const inner = checkGate(g.ring.innerAngle);
            pass = !inner.inGap && g.ring.innerSegOrder[inner.segIdx] === g.ball.colorIdx;
          }

          if (pass) {
            burst(g, cx, RING_Y, NEONS[g.ball.colorIdx], 28);
            g.score += 1; setScore(g.score);
            g.goodFlashT = 0.25;
            audioRef.current.match(g.score);
            g.ring.pulseT = 0.3;
            // Transition: brief pause
            g.ring.transitioning = true; g.ring.transitionT = 0.28;
            // Update ring for next pass
            const newOmega = (Math.abs(g.ring.omega)*1.1)*(-Math.sign(g.ring.omega));
            const newSeg = shuffle4([0,1,2,3]);
            // New ball color (different from current)
            let newColorIdx = g.ball.colorIdx;
            while (newColorIdx === g.ball.colorIdx) newColorIdx = Math.floor(Math.random()*4);
            g.ball.colorIdx = newColorIdx;
            g.ring.omega = newOmega;
            g.ring.segOrder = newSeg;
            g.ring.innerOmega = -(Math.abs(g.ring.innerOmega)*1.08)*Math.sign(g.ring.innerOmega);
            g.ring.innerSegOrder = shuffle4([0,1,2,3]);
            g.ring.innerEnabled = g.score >= 10;
            if (g.score >= g.target) endRef.current(g.score, "win");
          } else {
            // Fail
            burst(g, cx, RING_Y, "#ff3333", 22);
            g.shakeT = 0.6; g.shakeMag = 26; g.flashT = 0.7;
            audioRef.current.fail();
            endRef.current(g.score, "barrier");
          }
        }
      } else if (ballTop >= ringBottom) {
        g.checkLock = false; // reset lock when ball is below ring again
      }
    }

    // Particles
    for (const p of g.particles) { p.vx*=0.9; p.vy=p.vy*0.9+200*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt; }
    g.particles = g.particles.filter(p=>p.life>0);
    if (g.shakeT>0) g.shakeT-=dt;
    if (g.flashT>0) g.flashT-=dt;
    if (g.goodFlashT>0) g.goodFlashT-=dt;

    // ---- Render ----
    ctx.setTransform(dpr,0,0,dpr,0,0);

    // Background
    ctx.fillStyle = "#111118";
    ctx.fillRect(0,0,w,h);
    // Subtle radial glow at ring position
    const bgGrad = ctx.createRadialGradient(cx,RING_Y,0,cx,RING_Y,w*0.7);
    bgGrad.addColorStop(0,"rgba(30,10,50,0.7)"); bgGrad.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle = bgGrad; ctx.fillRect(0,0,w,h);

    // Shake
    let sx=0,sy=0;
    if (g.shakeT>0) { const m=g.shakeMag*Math.max(0,g.shakeT/0.6); sx=(Math.random()*2-1)*m; sy=(Math.random()*2-1)*m; }
    ctx.save(); ctx.translate(sx,sy);

    // Vertical guide line (very faint)
    ctx.setLineDash([4,6]); ctx.strokeStyle="rgba(255,255,255,0.05)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(cx,0); ctx.lineTo(cx,h); ctx.stroke(); ctx.setLineDash([]);

    // Draw ring
    if (!g.ring.transitioning || g.ring.transitionT > 0.1) {
      const alpha = g.ring.transitioning ? Math.min(1, g.ring.transitionT/0.1) : 1;
      const pulse = 1 + Math.sin(Math.min(1,g.ring.pulseT/0.3)*Math.PI)*0.12;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, RING_Y);
      ctx.scale(pulse,pulse);

      // Outer ring segments
      for (let i=0;i<4;i++) {
        const sa = g.ring.angle + i*SLOT;
        const ea = sa + SEG;
        ctx.beginPath(); ctx.arc(0,0,RING_O,sa,ea); ctx.arc(0,0,RING_I,ea,sa,true); ctx.closePath();
        const color = NEONS[g.ring.segOrder[i]];
        ctx.fillStyle = color;
        ctx.shadowColor = color; ctx.shadowBlur = 18;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      // Ring gaps (dark fill)
      for (let i=0;i<4;i++) {
        const sa = g.ring.angle + i*SLOT + SEG;
        const ea = sa + GAP;
        ctx.beginPath(); ctx.arc(0,0,RING_O,sa,ea); ctx.arc(0,0,RING_I,ea,sa,true); ctx.closePath();
        ctx.fillStyle = "#111118"; ctx.fill();
      }

      // Inner decoy ring
      if (g.ring.innerEnabled) {
        for (let i=0;i<4;i++) {
          const sa = g.ring.innerAngle + i*SLOT;
          const ea = sa + SEG;
          ctx.beginPath(); ctx.arc(0,0,INNER_O,sa,ea); ctx.arc(0,0,INNER_I,ea,sa,true); ctx.closePath();
          const color = NEONS[g.ring.innerSegOrder[i]];
          ctx.fillStyle = color; ctx.globalAlpha = alpha*0.75;
          ctx.fill();
        }
        for (let i=0;i<4;i++) {
          const sa = g.ring.innerAngle + i*SLOT + SEG;
          const ea = sa + GAP;
          ctx.beginPath(); ctx.arc(0,0,INNER_O,sa,ea); ctx.arc(0,0,INNER_I,ea,sa,true); ctx.closePath();
          ctx.fillStyle = "#111118"; ctx.globalAlpha = alpha; ctx.fill();
        }
        // Center hole
        ctx.beginPath(); ctx.arc(0,0,INNER_I,0,TWO_PI); ctx.fillStyle="#111118"; ctx.fill();
      } else {
        // Center hole
        ctx.beginPath(); ctx.arc(0,0,RING_I,0,TWO_PI); ctx.fillStyle="#111118"; ctx.fill();
      }

      ctx.restore();
    }

    // Ball
    const ballScreenY = g.ball.y;
    const ballColor = NEONS[g.ball.colorIdx];
    const ballDark = NEON_DARK[g.ball.colorIdx];
    // Shadow
    ctx.save(); ctx.globalAlpha=0.35; ctx.fillStyle="#000";
    ctx.beginPath(); ctx.ellipse(cx+6,ballScreenY+10,BALL_R*1.2,BALL_R*0.55,0,0,TWO_PI); ctx.fill(); ctx.restore();
    // Glow
    ctx.save(); ctx.shadowColor=ballColor; ctx.shadowBlur=28;
    const bGrad = ctx.createRadialGradient(cx-4,ballScreenY-4,2,cx,ballScreenY,BALL_R);
    bGrad.addColorStop(0,"rgba(255,255,255,0.9)"); bGrad.addColorStop(0.3,ballColor); bGrad.addColorStop(1,ballDark);
    ctx.fillStyle=bGrad; ctx.beginPath(); ctx.arc(cx,ballScreenY,BALL_R,0,TWO_PI); ctx.fill();
    ctx.shadowBlur=0; ctx.restore();
    // Specular
    ctx.fillStyle="rgba(255,255,255,0.7)";
    ctx.beginPath(); ctx.ellipse(cx-5,ballScreenY-5,3,2.5,-0.4,0,TWO_PI); ctx.fill();

    // Particles
    for (const p of g.particles) {
      const a=Math.max(0,p.life/p.max);
      ctx.save(); ctx.globalAlpha=a; ctx.shadowColor=p.color; ctx.shadowBlur=10;
      ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,TWO_PI); ctx.fill(); ctx.restore();
    }

    ctx.restore(); // end shake

    // Flash overlays
    if (g.flashT>0) { ctx.fillStyle=`rgba(220,20,20,${(g.flashT/0.7)*0.38})`; ctx.fillRect(0,0,w,h); }
    if (g.goodFlashT>0) { const c=NEONS[g.ball.colorIdx]; ctx.fillStyle=`rgba(${parseInt(c.slice(1,3),16)},${parseInt(c.slice(3,5),16)},${parseInt(c.slice(5,7),16)},${(g.goodFlashT/0.25)*0.12})`; ctx.fillRect(0,0,w,h); }

    if (g.running || g.particles.length>0) rafRef.current = requestAnimationFrame(loop);
  }, []);

  const startLoop = useCallback(() => { cancelAnimationFrame(rafRef.current); if (gameRef.current) gameRef.current.lastTime=0; rafRef.current=requestAnimationFrame(loop); }, [loop]);

  const startingRef = useRef(false);

  const finishGame = useCallback((finalScore: number, outcome: "win"|"barrier"|"time") => {
    const g = gameRef.current; if (!g||!g.running) return; g.running=false; startingRef.current=false;
    setBest(prev=>{const n=Math.max(prev,finalScore);localStorage.setItem(BEST_KEY,String(n));return n;});
    if (outcome==="win") {
      audioRef.current.goal();
      const t = ticketRef.current;
      if (t) setBalance(prev=>{const n=prev+t.prize;localStorage.setItem(BALANCE_KEY,String(n));return n;});
      setPhase("won");
    } else { audioRef.current.gameOver(); setPhase("lost"); }
  }, []);

  const ticketRef = useRef<Ticket|null>(null);
  useEffect(()=>{ ticketRef.current=ticket; },[ticket]);
  const endRef = useRef(finishGame);
  useEffect(()=>{ endRef.current=finishGame; },[finishGame]);

  const onTap = useCallback(() => {
    if (phase!=="playing") return;
    const g = gameRef.current; if (!g||!g.running) return;
    g.ball.vy = JUMP_V;
  }, [phase]);

  const playTicket = useCallback((t: Ticket) => {
    if (startingRef.current||t.price>balance) return; startingRef.current=true;
    setBalance(prev=>{const n=prev-t.price;localStorage.setItem(BALANCE_KEY,String(n));return n;});
    audioRef.current.start(); setTicket(t);
    gameRef.current = newGameState(t);
    if (gameRef.current) { gameRef.current.ring = makeRing(0); gameRef.current.ball = {y:0.82,vy:0,colorIdx:Math.floor(Math.random()*4),prevY:0.82}; }
    lastSecRef.current=t.time; setScore(0); setTimeLeft(t.time);
    if (timerBarRef.current) timerBarRef.current.style.width="100%";
    setPhase("playing"); startLoop();
  }, [balance, newGameState, startLoop]);

  useEffect(() => { const audio=audioRef.current; return ()=>{cancelAnimationFrame(rafRef.current);audio.dispose();}; }, []);

  const toggleMute = ()=>{audioRef.current.muted=!muted;setMuted(!muted);};

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden bg-[#111118] select-none">
      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3">
        <Link href="/games"><button data-testid="button-back-arena" className="w-10 h-10 rounded-full bg-white/5 backdrop-blur border border-white/10 flex items-center justify-center text-white/80 hover:text-violet-300 transition-colors"><ArrowLeft size={18}/></button></Link>
        <div className="flex flex-col items-center -mt-1">
          <span className="text-[10px] tracking-[0.3em] text-violet-400/70 font-display uppercase">{phase==="playing"?"Passed":"Color Switch"}</span>
          <span data-testid="text-score" className="font-display font-black text-4xl text-white leading-none drop-shadow-[0_0_18px_rgba(180,100,255,0.6)]">{score}</span>
          {phase==="playing"&&<span className="text-[9px] tracking-[0.25em] text-violet-300/80 font-display uppercase mt-0.5">GOAL {target}</span>}
        </div>
        <button data-testid="button-toggle-mute" onClick={toggleMute} className="w-10 h-10 rounded-full bg-white/5 backdrop-blur border border-white/10 flex items-center justify-center text-white/80 hover:text-violet-300 transition-colors">{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button>
      </div>

      {phase==="playing"&&(
        <div className="absolute top-[84px] left-1/2 -translate-x-1/2 z-30 w-[68%] flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[9px] tracking-[0.25em] text-violet-400/90 font-display uppercase">Progress</span>
              <span data-testid="text-progress" className="text-[11px] font-display font-bold tracking-wider tabular-nums text-white/90">{score} / {target}</span>
            </div>
            <div className="relative w-full h-2.5 rounded-full bg-white/10 overflow-hidden border border-violet-500/20">
              <div data-testid="bar-progress" className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-pink-400 shadow-[0_0_14px_rgba(180,100,255,0.6)] transition-[width] duration-300 ease-out" style={{width:`${target>0?Math.min(100,(score/target)*100):0}%`}}/>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[9px] tracking-[0.25em] text-white/40 font-display uppercase">Time</span>
              <span data-testid="text-timer" className={`text-[11px] font-display font-bold tracking-wider tabular-nums ${timeLeft<=5?"text-red-400":"text-white/80"}`}>{timeLeft}s</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden"><div ref={timerBarRef} data-testid="bar-timer" className="h-full rounded-full" style={{width:"100%"}}/></div>
          </div>
        </div>
      )}

      <div ref={wrapRef} className="flex-1 relative" onPointerDown={onTap}>
        <canvas ref={canvasRef} data-testid="canvas-color" className="absolute inset-0 touch-none"/>
        {phase==="playing"&&(
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
            <span className="text-[10px] text-white/25 font-display tracking-[0.25em] uppercase">TAP to jump</span>
          </div>
        )}
      </div>

      {/* Select */}
      <AnimatePresence>{phase==="select"&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 z-40 flex flex-col bg-black/78 backdrop-blur-md px-6 pt-16 pb-6 overflow-y-auto">
          <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.05}} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-violet-400"/><span className="text-[11px] tracking-[0.4em] text-white/50 font-display uppercase">Color Switch</span></div>
            <h1 className="font-display font-black text-2xl leading-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-violet-300 to-fuchsia-400 mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/40 mb-4 max-w-[260px]">TAP to jump through the spinning ring. Match your ball color to the ring segment — don't hit a gap!</p>
            <div className="flex items-center gap-2 mb-5 px-4 py-2 rounded-xl bg-violet-400/10 border border-violet-400/30">
              <Coins size={14} className="text-violet-300"/><span data-testid="text-balance" className="text-sm font-display font-bold text-violet-300 tracking-wide">{balance.toLocaleString()} SKZ</span>
            </div>
            <div className="w-full flex flex-col gap-2.5">
              {TICKETS.map(t=>{const ok=t.price<=balance;return(
                <button key={t.id} disabled={!ok} onClick={()=>ok&&playTicket(t)} data-testid={`button-ticket-${t.id}`}
                  className={`w-full flex items-center justify-between rounded-2xl border p-3.5 transition-all ${ok?"bg-white/5 border-white/10 hover:border-violet-400/50 active:scale-[0.98]":"bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed"}`}>
                  <div className="flex flex-col items-start"><span className="font-display font-bold text-base text-white tracking-wide">{t.name}</span><span className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Goal {t.target} · {t.time}s</span></div>
                  <div className="flex flex-col items-end"><span className="flex items-center gap-1 text-violet-300 font-display font-bold text-sm"><Coins size={12}/>{t.prize.toLocaleString()}</span><span className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Entry {t.price}</span></div>
                </button>
              );})}
            </div>
            <div className="flex items-center gap-1.5 mt-5 text-[11px] text-white/40"><Trophy size={11} className="text-violet-400"/><span data-testid="text-best">Best {best}</span></div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Won */}
      <AnimatePresence>{phase==="won"&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/78 backdrop-blur-md px-8">
          <motion.div initial={{scale:0.85,opacity:0,y:20}} animate={{scale:1,opacity:1,y:0}} transition={{type:"spring",bounce:0.4}} className="w-full max-w-[300px] flex flex-col items-center text-center">
            <span data-testid="text-result" className="text-xs tracking-[0.4em] font-display uppercase mb-2 text-violet-300">Color Master</span>
            <div className="font-display font-black text-5xl text-transparent bg-clip-text bg-gradient-to-br from-violet-300 via-fuchsia-200 to-white mb-1">+{ticket?.prize.toLocaleString()??0}</div>
            <span className="text-sm text-white/50 mb-6">SKZ prize claimed</span>
            <div className="w-full grid grid-cols-2 gap-3 mb-7">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center"><div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1"><Trophy size={11} className="text-violet-400"/>Rings</div><span data-testid="text-final-score" className="font-display font-bold text-xl text-white">{score}</span></div>
              <div className="bg-violet-400/10 border border-violet-400/30 rounded-2xl p-3 flex flex-col items-center"><div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1"><Coins size={11} className="text-violet-300"/>Balance</div><span data-testid="text-balance-final" className="font-display font-bold text-xl text-violet-300">{balance.toLocaleString()}</span></div>
            </div>
            <button onClick={()=>setPhase("select")} data-testid="button-replay" className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-400 text-black font-display font-bold tracking-widest flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform"><RotateCcw size={18}/>PLAY AGAIN</button>
            <Link href="/games"><button data-testid="button-exit" className="text-sm text-white/50 hover:text-white transition-colors">Back to Arena</button></Link>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Lost */}
      <AnimatePresence>{phase==="lost"&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/78 backdrop-blur-md px-8">
          <motion.div initial={{scale:0.85,opacity:0,y:20}} animate={{scale:1,opacity:1,y:0}} transition={{type:"spring",bounce:0.35}} className="w-full max-w-[300px] flex flex-col items-center text-center">
            <span data-testid="text-result" className="text-xs tracking-[0.4em] font-display uppercase mb-2 text-red-400">Wrong Color</span>
            <div data-testid="text-loss-amount" className="font-display font-black text-5xl text-transparent bg-clip-text bg-gradient-to-br from-red-400 to-white/70 mb-1">-{ticket?.price??0}</div>
            <span className="text-sm text-white/50 mb-6">SKZ entry lost</span>
            <div className="w-full grid grid-cols-2 gap-3 mb-7">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center"><div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1"><Trophy size={11} className="text-violet-400"/>Reached</div><span data-testid="text-final-score" className="font-display font-bold text-xl text-white">{score}/{target}</span></div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center"><div className="flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1"><Coins size={11} className="text-violet-300"/>Balance</div><span data-testid="text-balance-final" className="font-display font-bold text-xl text-white">{balance.toLocaleString()}</span></div>
            </div>
            <button onClick={()=>setPhase("select")} data-testid="button-replay" className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-400 text-black font-display font-bold tracking-widest flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform"><RotateCcw size={18}/>TRY AGAIN</button>
            <Link href="/games"><button data-testid="button-exit" className="text-sm text-white/50 hover:text-white transition-colors">Back to Arena</button></Link>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}
