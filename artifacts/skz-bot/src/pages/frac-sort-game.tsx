import { useRef, useState, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }
const BEST_KEY = "skz_fracsort_best";
const BALANCE_KEY = "skz_balance";
const TICKETS: Ticket[] = [
  { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 12, time: 60 },
  { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 20, time: 55 },
  { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 30, time: 50 },
  { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 45, time: 45 },
  { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 65, time: 40 },
];

interface Frac { num: number; den: number; val: number; }
// Pool of fractions (avoid exactly 1/2)
const FRAC_POOL: Frac[] = [
  {num:1,den:3,val:1/3},{num:1,den:4,val:0.25},{num:2,den:5,val:0.4},{num:3,den:7,val:3/7},
  {num:1,den:6,val:1/6},{num:2,den:7,val:2/7},{num:1,den:8,val:0.125},{num:3,den:8,val:0.375},
  {num:2,den:3,val:2/3},{num:3,den:4,val:0.75},{num:3,den:5,val:0.6},{num:4,den:7,val:4/7},
  {num:5,den:6,val:5/6},{num:5,den:7,val:5/7},{num:5,den:8,val:0.625},{num:7,den:8,val:0.875},
  {num:1,den:5,val:0.2},{num:4,den:5,val:0.8},{num:5,den:9,val:5/9},{num:4,den:9,val:4/9},
];

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number; }

export default function FracSortGame() {
  const [phase, setPhase] = useState<Phase>("select");
  const [scoreDisp, setScoreDisp] = useState(0);
  const [hpDisp, setHpDisp] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [balance, setBalance] = useState(() => parseInt(localStorage.getItem(BALANCE_KEY) || "1000"));
  const [best, setBest] = useState(() => parseInt(localStorage.getItem(BEST_KEY) || "0"));
  const [ticket, setTicket] = useState<Ticket | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const finishedRef = useRef(false);
  const startingRef = useRef(false);
  const timerBarRef = useRef<HTMLDivElement>(null);
  const lastSecRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const pendingTicketRef = useRef<Ticket | null>(null);

  const gsRef = useRef({
    frac: null as Frac | null, score: 0, hp: 3,
    time: 60, maxTime: 60, target: 12,
    particles: [] as Particle[],
    answerFlash: null as null | { correct: boolean; t: number },
    fracY: 0, fracT: 0,
  });

  const finishGame = useCallback((won: boolean, finalScore: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    abortRef.current?.abort();
    if (!ticket) return;
    if (won) {
      const nb = balance - ticket.price + ticket.prize;
      setBalance(nb); localStorage.setItem(BALANCE_KEY, String(nb));
      if (finalScore > best) { setBest(finalScore); localStorage.setItem(BEST_KEY, String(finalScore)); }
    } else {
      const nb = Math.max(0, balance - ticket.price);
      setBalance(nb); localStorage.setItem(BALANCE_KEY, String(nb));
    }
    setScoreDisp(finalScore); setPhase(won ? "won" : "lost");
  }, [ticket, balance, best]);

  const startGame = useCallback((t: Ticket) => {
    if (startingRef.current) return;
    if (!canvasRef.current) { rafRef.current = requestAnimationFrame(() => startGame(t)); return; }
    startingRef.current = true;
    finishedRef.current = false;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const g = gsRef.current;
    g.score = 0; g.hp = 3; g.time = t.time; g.maxTime = t.time; g.target = t.target;
    g.particles = []; g.answerFlash = null;
    g.frac = FRAC_POOL[Math.floor(Math.random() * FRAC_POOL.length)];
    g.fracY = 0; g.fracT = 0;

    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    lastSecRef.current = Date.now();
    setHpDisp(3); setScoreDisp(0); setTimeLeft(t.time);
    startingRef.current = false;
    let last = performance.now();
    const TWO_PI = Math.PI * 2;

    const nextFrac = () => {
      const g2 = gsRef.current;
      let f = g2.frac;
      while (f === g2.frac) f = FRAC_POOL[Math.floor(Math.random() * FRAC_POOL.length)];
      g2.frac = f; g2.fracY = 0; g2.fracT = 0;
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const g = gsRef.current;
      const tLeft = Math.max(0, g.time - (Date.now() - lastSecRef.current) / 1000);
      if (timerBarRef.current) timerBarRef.current.style.width = `${(tLeft / g.maxTime) * 100}%`;
      setTimeLeft(Math.ceil(tLeft));

      g.fracT += dt;
      // Animate fraction bouncing in
      const targetY = canvas.height * 0.42;
      g.fracY += (targetY - g.fracY) * Math.min(1, dt * 8);

      if (g.answerFlash) { g.answerFlash.t -= dt; if (g.answerFlash.t <= 0) { g.answerFlash = null; nextFrac(); } }
      g.particles = g.particles.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 150 * dt; p.life -= dt; return p.life > 0; });
      if (tLeft <= 0) { finishGame(g.score >= g.target, g.score); return; }

      const ctx = canvas.getContext("2d")!;
      const cw = canvas.width, ch = canvas.height;
      ctx.fillStyle = "#0e0020"; ctx.fillRect(0, 0, cw, ch);

      // Flash overlay
      if (g.answerFlash) {
        const a = g.answerFlash.t / 0.45;
        ctx.fillStyle = g.answerFlash.correct ? `rgba(80,255,150,${a*0.3})` : `rgba(255,60,60,${a*0.3})`;
        ctx.fillRect(0, 0, cw, ch);
      }

      // Compare to 1/2 line
      ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1;
      ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.moveTo(cw / 2, 100); ctx.lineTo(cw / 2, ch - 60); ctx.stroke();
      ctx.setLineDash([]);

      // Left zone label
      ctx.font = "bold 18px 'Orbitron', monospace"; ctx.textAlign = "center";
      ctx.fillStyle = "#8866ff"; ctx.shadowColor = "#8866ff"; ctx.shadowBlur = 14;
      ctx.fillText("< ½", cw * 0.25, ch - 22); ctx.shadowBlur = 0;
      // Right zone label
      ctx.fillStyle = "#ff8844"; ctx.shadowColor = "#ff8844"; ctx.shadowBlur = 14;
      ctx.fillText("> ½", cw * 0.75, ch - 22); ctx.shadowBlur = 0;

      // Zone backgrounds
      if (!g.answerFlash) {
        ctx.fillStyle = "rgba(136,102,255,0.06)";
        ctx.fillRect(0, ch - 90, cw / 2 - 2, 90);
        ctx.fillStyle = "rgba(255,136,68,0.06)";
        ctx.fillRect(cw / 2 + 2, ch - 90, cw / 2 - 2, 90);
      }

      // Left bucket
      ctx.strokeStyle = "rgba(136,102,255,0.35)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(8, ch - 85, cw / 2 - 16, 78, 16); ctx.stroke();
      // Right bucket
      ctx.strokeStyle = "rgba(255,136,68,0.35)";
      ctx.beginPath(); ctx.roundRect(cw / 2 + 8, ch - 85, cw / 2 - 16, 78, 16); ctx.stroke();

      // Fraction display
      if (g.frac && !g.answerFlash) {
        const fx = cw / 2, fy = g.fracY;
        const pulseScale = 1 + Math.sin(g.fracT * 3) * 0.02;
        ctx.save(); ctx.translate(fx, fy); ctx.scale(pulseScale, pulseScale);
        // Card bg
        ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(-70, -60, 140, 120, 20); ctx.fill(); ctx.stroke();
        // Numerator
        ctx.font = "bold 40px 'Orbitron', monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#aa88ff"; ctx.shadowBlur = 18;
        ctx.fillText(String(g.frac.num), 0, -4); ctx.shadowBlur = 0;
        // Line
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillRect(-40, 4, 80, 3);
        // Denominator
        ctx.font = "bold 40px 'Orbitron', monospace"; ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#ffaa44"; ctx.shadowBlur = 18;
        ctx.fillText(String(g.frac.den), 0, 48); ctx.shadowBlur = 0;
        ctx.restore();
      }
      if (g.answerFlash && g.frac) {
        const text = g.answerFlash.correct ? "✓ CORRECT!" : "✗ WRONG!";
        ctx.font = "bold 26px 'Orbitron', monospace"; ctx.textAlign = "center";
        ctx.fillStyle = g.answerFlash.correct ? "#50ff96" : "#ff5050";
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 20;
        ctx.fillText(text, cw / 2, ch * 0.42); ctx.shadowBlur = 0;
      }

      // HP
      for (let i = 0; i < 3; i++) { ctx.font = "16px sans-serif"; ctx.textAlign = "left"; ctx.fillText(i < g.hp ? "❤️" : "🖤", 10 + i * 26, 38); }
      // Score
      ctx.font = "bold 14px 'Orbitron', monospace"; ctx.textAlign = "right"; ctx.fillStyle = "#aa88ff";
      ctx.fillText(`${g.score} / ${g.target}`, cw - 10, 38);

      // Particles
      for (const p of g.particles) { ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TWO_PI); ctx.fill(); }
      ctx.globalAlpha = 1;
      setScoreDisp(g.score);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const handlePointer = (e: PointerEvent) => {
      if (finishedRef.current) return;
      const g = gsRef.current;
      if (!g.frac || g.answerFlash) return;
      const rect = canvas.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (canvas.width / rect.width);
      const py = (e.clientY - rect.top) * (canvas.height / rect.height);
      if (py < canvas.height - 90) return; // Only bucket area
      const choseLeft = px < canvas.width / 2;
      const correctLeft = g.frac.val < 0.5;
      const correct = choseLeft === correctLeft;
      g.answerFlash = { correct, t: 0.45 };
      if (correct) {
        g.score++;
        const color = choseLeft ? "#8866ff" : "#ff8844";
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2, spd = 100 + Math.random() * 200;
          g.particles.push({ x: choseLeft ? canvas.width * 0.25 : canvas.width * 0.75, y: canvas.height - 50, vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd - 80, life: 0.6, max: 0.6, color, r: 3 + Math.random() * 4 });
        }
        if (g.score >= g.target) { setTimeout(() => finishGame(true, g.score), 500); return; }
      } else {
        g.hp = Math.max(0, g.hp - 1); setHpDisp(g.hp);
        if (g.hp <= 0) { setTimeout(() => finishGame(false, g.score), 500); return; }
      }
    };
    canvas.addEventListener("pointerdown", handlePointer, { signal: abortRef.current!.signal });
  }, [finishGame]);

  useEffect(() => { return () => { cancelAnimationFrame(rafRef.current); abortRef.current?.abort(); }; }, []);
  useEffect(() => {
    if (phase !== "playing" || !pendingTicketRef.current) return;
    const t = pendingTicketRef.current;
    pendingTicketRef.current = null;
    startGame(t);
  }, [phase, startGame]);
  const refillBalance = () => { setBalance(1000); localStorage.setItem(BALANCE_KEY, "1000"); };

  return (
    <div className="h-screen w-full bg-[#0e0020] flex flex-col overflow-hidden">
      <AnimatePresence mode="wait">
        {phase === "select" && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full overflow-y-auto pb-8">
            <div className="flex items-center gap-3 px-4 pt-4 pb-2">
              <Link href="/games"><button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-white/70" /></button></Link>
              <span className="text-xs font-display tracking-widest text-violet-400/70 uppercase">Fraction Sort</span>
            </div>
            <div className="flex flex-col items-center gap-2 px-4 pt-4 pb-6">
              <div className="text-6xl mb-1">⚖️</div>
              <div className="flex items-center gap-2 text-xs tracking-widest font-display text-violet-400/70 uppercase"><Trophy size={12} />FRACTION SORT</div>
              <h1 className="font-display font-black text-3xl text-white text-center uppercase tracking-wider">CHOOSE YOUR TICKET</h1>
              <p className="text-xs text-white/50 text-center max-w-[260px]">A fraction appears. Is it less than ½ or greater than ½? Tap the correct side. 3 HP — don't miss!</p>
              <div className="mt-1 flex items-center gap-2 px-4 py-2 rounded-full bg-white/8 border border-white/10">
                <Coins size={14} className="text-violet-400" /><span className="font-display font-bold text-white text-sm">{balance.toLocaleString()} SKZ</span>
              </div>
              {balance < 30 && <button onClick={refillBalance} className="text-xs text-violet-400 underline mt-1">Refill Balance (+1000 SKZ)</button>}
            </div>
            <div className="flex flex-col gap-3 px-4">
              {TICKETS.map(t => {
                const canAfford = balance >= t.price;
                return (
                  <motion.button key={t.id} whileTap={{ scale: 0.97 }} disabled={!canAfford}
                    onClick={() => { if (!canAfford) return; pendingTicketRef.current = t; setTicket(t); setPhase("playing"); }}
                    className={`flex items-center justify-between px-5 py-4 rounded-2xl border transition-all ${canAfford ? "bg-white/5 border-violet-500/30 hover:border-violet-400/60 cursor-pointer" : "opacity-40 border-white/10 cursor-not-allowed"}`}>
                    <div className="text-left">
                      <div className="font-display font-bold text-white text-base">{t.name}</div>
                      <div className="text-[10px] text-white/40 tracking-widest uppercase mt-0.5">SORT {t.target} · {t.time}S</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-bold text-violet-400 text-lg flex items-center gap-1"><Coins size={13} />{t.prize}</div>
                      <div className="text-[10px] text-white/40 uppercase tracking-wide">ENTRY {t.price}</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
            <div className="flex justify-center mt-5 text-xs text-white/30 font-display"><Trophy size={12} className="mr-1 mt-0.5 text-violet-400/50" />Best: {best}</div>
          </motion.div>
        )}
        {phase === "playing" && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex-1 flex flex-col h-full">
            <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-10">
              <div ref={timerBarRef} className="h-full bg-gradient-to-r from-violet-400 to-purple-400 transition-none" style={{ width: "100%" }} />
            </div>
            <div className="absolute top-3 right-3 z-10 bg-black/40 rounded-full px-3 py-1">
              <span className="font-display text-xs text-violet-300">{timeLeft}s</span>
            </div>
            <canvas ref={canvasRef} className="flex-1 w-full h-full touch-none" />
          </motion.div>
        )}
        {(phase === "won" || phase === "lost") && ticket && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full px-6 gap-5">
            <div className="text-7xl">{phase === "won" ? "⚖️" : "💔"}</div>
            <div className="text-center">
              <div className={`font-display font-black text-4xl uppercase ${phase === "won" ? "text-violet-400" : "text-red-400"}`}>{phase === "won" ? "SORTED!" : "UNBALANCED!"}</div>
              <div className="text-white/60 text-sm mt-1">Score: {scoreDisp} / {ticket.target}</div>
            </div>
            {phase === "won" ? (
              <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-violet-500/20 border border-violet-500/40">
                <Coins size={16} className="text-violet-400" /><span className="font-display font-bold text-violet-300 text-lg">+{ticket.prize} SKZ</span>
              </div>
            ) : <div className="text-white/40 text-sm">Lost {ticket.price} SKZ entry fee</div>}
            <div className="text-xs text-white/30 font-display">Balance: {balance.toLocaleString()} SKZ</div>
            {best > 0 && <div className="text-xs text-violet-400/50 font-display flex items-center gap-1"><Trophy size={11} />Best: {best}</div>}
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button onClick={() => setPhase("select")} className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-violet-500/20 border border-violet-500/40 font-display font-bold text-violet-300 hover:bg-violet-500/30"><RotateCcw size={16} />Play Again</button>
              <Link href="/games"><button className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/10 font-display text-white/60 text-sm">← All Games</button></Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
