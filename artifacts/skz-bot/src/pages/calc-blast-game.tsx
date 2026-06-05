import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw, Trophy, Coins, Crosshair } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";
import { GAME_TICKETS } from "@/lib/tickets-data";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }
const BEST_KEY = "skz_calcblast_best";
const BALANCE_KEY = "skz_balance";
const RAW_TICKETS: Ticket[] = GAME_TICKETS.calcblast;

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number; }
interface Star { x: number; y: number; r: number; a: number; }
interface Eq { text: string; answer: number; choices: [number, number, number]; y: number; vy: number; id: number; popping: boolean; popT: number; popY: number; }

function genEq(level: number, id: number): Eq {
  const ops = level < 2 ? [0, 1] : level < 4 ? [0, 1, 2] : [0, 1, 2, 3];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number, b: number, answer: number, text: string;
  if (op === 0) { a = 5 + Math.floor(Math.random() * (8 + level * 3)); b = 5 + Math.floor(Math.random() * (8 + level * 3)); answer = a + b; text = `${a} + ${b} = ?`; }
  else if (op === 1) { a = 10 + Math.floor(Math.random() * (12 + level * 2)); b = 2 + Math.floor(Math.random() * 8); answer = a - b; text = `${a} − ${b} = ?`; }
  else if (op === 2) { a = 2 + Math.floor(Math.random() * 9); b = 2 + Math.floor(Math.random() * 9); answer = a * b; text = `${a} × ${b} = ?`; }
  else { b = 2 + Math.floor(Math.random() * 9); answer = 2 + Math.floor(Math.random() * 9); a = b * answer; text = `${a} ÷ ${b} = ?`; }
  const wrongs = new Set<number>();
  while (wrongs.size < 2) {
    const d = (Math.random() < 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 6));
    const w = Math.max(0, answer + d);
    if (w !== answer) wrongs.add(w);
  }
  const arr: number[] = [answer, ...Array.from(wrongs)];
  for (let i = 2; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return { text, answer, choices: [arr[0], arr[1], arr[2]], y: -50, vy: 55 + level * 12, id, popping: false, popT: 0, popY: 0 };
}

export default function CalcBlastGame() {
  const TICKETS = useGameTickets("calcblast", RAW_TICKETS);
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

  const gsRef = useRef({ eq: null as Eq | null, score: 0, hp: 3, level: 1, nextId: 0, time: 60, maxTime: 60, target: 12, particles: [] as Particle[], stars: [] as Star[], wrongFlash: 0, correctFlash: 0 });

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
    setScoreDisp(finalScore);
    setPhase(won ? "won" : "lost");
  }, [ticket, balance, best]);

  const startGame = useCallback((t: Ticket) => {
    if (startingRef.current) return;
    if (!canvasRef.current) { rafRef.current = requestAnimationFrame(() => startGame(t)); return; }
    startingRef.current = true;
    finishedRef.current = false;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const g = gsRef.current;
    g.score = 0; g.hp = 3; g.level = 1; g.nextId = 0;
    g.time = t.time; g.maxTime = t.time; g.target = t.target;
    g.particles = []; g.wrongFlash = 0; g.correctFlash = 0;
    g.eq = genEq(1, g.nextId++);
    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const w = canvas.width, h = canvas.height;
    g.stars = Array.from({ length: 80 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 0.5 + Math.random() * 2, a: 0.3 + Math.random() * 0.7 }));
    lastSecRef.current = Date.now();
    setHpDisp(3); setScoreDisp(0); setTimeLeft(t.time);
    startingRef.current = false;
    let last = performance.now();
    const TWO_PI = Math.PI * 2;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const g = gsRef.current;
      const tLeft = Math.max(0, g.time - (Date.now() - lastSecRef.current) / 1000);
      if (timerBarRef.current) timerBarRef.current.style.width = `${(tLeft / g.maxTime) * 100}%`;
      setTimeLeft(Math.ceil(tLeft));
      if (g.eq && !g.eq.popping) {
        g.eq.y += g.eq.vy * dt;
        if (g.eq.y > canvas.height - 80) {
          g.hp = Math.max(0, g.hp - 1); setHpDisp(g.hp); g.wrongFlash = 0.5;
          if (g.hp <= 0) { finishGame(false, g.score); return; }
          g.eq = genEq(g.level, g.nextId++);
        }
      }
      if (g.eq?.popping) { g.eq.popT -= dt; if (g.eq.popT <= 0) g.eq = genEq(g.level, g.nextId++); }
      g.particles = g.particles.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; p.life -= dt; return p.life > 0; });
      g.wrongFlash = Math.max(0, g.wrongFlash - dt * 3);
      g.correctFlash = Math.max(0, g.correctFlash - dt * 3);
      if (tLeft <= 0) { finishGame(g.score >= g.target, g.score); return; }
      const ctx = canvas.getContext("2d")!;
      const cw = canvas.width, ch = canvas.height;
      ctx.fillStyle = "#030b1a"; ctx.fillRect(0, 0, cw, ch);
      for (const s of g.stars) { ctx.globalAlpha = s.a; ctx.fillStyle = "#aaddff"; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TWO_PI); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (g.wrongFlash > 0) { ctx.fillStyle = `rgba(255,50,50,${g.wrongFlash * 0.28})`; ctx.fillRect(0, 0, cw, ch); }
      if (g.correctFlash > 0) { ctx.fillStyle = `rgba(50,255,120,${g.correctFlash * 0.22})`; ctx.fillRect(0, 0, cw, ch); }
      if (g.eq && !g.eq.popping) {
        ctx.font = "bold 30px 'Orbitron', monospace"; ctx.textAlign = "center";
        const gr = ctx.createLinearGradient(cw/2-90, 0, cw/2+90, 0);
        gr.addColorStop(0, "#00eeff"); gr.addColorStop(1, "#0088ff");
        ctx.fillStyle = gr; ctx.shadowColor = "#00ccff"; ctx.shadowBlur = 22;
        ctx.fillText(g.eq.text, cw / 2, g.eq.y); ctx.shadowBlur = 0;
      }
      if (g.eq?.popping) {
        const alpha = g.eq.popT / 0.3;
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${Math.floor(30 + (1 - alpha) * 50)}px 'Orbitron', monospace`;
        ctx.textAlign = "center"; ctx.fillStyle = "#ffff44";
        ctx.shadowColor = "#ffff00"; ctx.shadowBlur = 25;
        ctx.fillText("✓ BLASTED!", cw / 2, g.eq.popY); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
      const PH = 68, PY = ch - PH - 10, PW = (cw - 25) / 3;
      const PCOLS = ["rgba(0,60,100,0.85)", "rgba(0,80,30,0.85)", "rgba(60,0,100,0.85)"];
      const PBRD = ["#00aaff", "#00ff88", "#cc44ff"];
      if (g.eq && !g.eq.popping) {
        for (let i = 0; i < 3; i++) {
          const px = 10 + i * (PW + 2.5);
          ctx.fillStyle = PCOLS[i]; ctx.strokeStyle = PBRD[i]; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(px, PY, PW, PH, 12); ctx.fill(); ctx.stroke();
          ctx.font = "bold 26px 'Orbitron', monospace"; ctx.textAlign = "center";
          ctx.fillStyle = PBRD[i]; ctx.shadowColor = PBRD[i]; ctx.shadowBlur = 12;
          ctx.fillText(String(g.eq.choices[i]), px + PW / 2, PY + PH / 2 + 9); ctx.shadowBlur = 0;
        }
      }
      for (const p of g.particles) { ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TWO_PI); ctx.fill(); }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 3; i++) { ctx.font = "18px sans-serif"; ctx.textAlign = "left"; ctx.fillText(i < g.hp ? "❤️" : "🖤", 12 + i * 28, 38); }
      ctx.font = "bold 16px 'Orbitron', monospace"; ctx.textAlign = "right"; ctx.fillStyle = "#00eeff";
      ctx.fillText(`${g.score} / ${g.target}`, cw - 12, 38);
      setScoreDisp(g.score);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const handlePointer = (e: PointerEvent) => {
      if (finishedRef.current) return;
      const g = gsRef.current;
      if (!g.eq || g.eq.popping) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      const PH = 68, PY = canvas.height - PH - 10, PW = (canvas.width - 25) / 3;
      if (y < PY) return;
      let idx = -1;
      if (x >= 10 && x <= 10 + PW) idx = 0;
      else if (x >= 10 + PW + 2.5 && x <= 10 + PW * 2 + 2.5) idx = 1;
      else if (x >= 10 + PW * 2 + 5) idx = 2;
      if (idx < 0) return;
      const chosen = g.eq.choices[idx];
      if (chosen === g.eq.answer) {
        g.score++; g.correctFlash = 0.5; g.level = Math.floor(g.score / 8) + 1;
        const ey = g.eq.y;
        for (let p = 0; p < 22; p++) {
          const angle = Math.random() * Math.PI * 2, spd = 100 + Math.random() * 220;
          g.particles.push({ x: canvas.width / 2, y: ey, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 80, life: 0.7, max: 0.7, color: ["#00ffff","#ffff00","#00ff88","#ff44ff"][Math.floor(Math.random()*4)], r: 3 + Math.random() * 4 });
        }
        g.eq.popping = true; g.eq.popT = 0.4; g.eq.popY = ey;
        if (g.score >= g.target) { finishGame(true, g.score); return; }
      } else {
        g.hp = Math.max(0, g.hp - 1); setHpDisp(g.hp); g.wrongFlash = 0.6;
        if (g.hp <= 0) { finishGame(false, g.score); return; }
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
    <div className="h-screen w-full bg-[#030b1a] flex flex-col overflow-hidden">
      <AnimatePresence mode="wait">
        {phase === "select" && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full overflow-y-auto pb-8">
            <div className="flex items-center gap-3 px-4 pt-4 pb-2">
              <Link href="/games"><button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-white/70" /></button></Link>
              <span className="text-xs font-display tracking-widest text-cyan-400/70 uppercase">Calc Blaster</span>
            </div>
            <div className="flex flex-col items-center gap-2 px-4 pt-4 pb-6">
              <div className="text-6xl mb-1">🎯</div>
              <div className="flex items-center gap-2 text-xs tracking-widest font-display text-cyan-400/70 uppercase"><Trophy size={12} />CALC BLASTER</div>
              <h1 className="font-display font-black text-3xl text-white text-center uppercase tracking-wider">CHOOSE YOUR TICKET</h1>
              <p className="text-xs text-white/50 text-center max-w-[260px]">Equations rain from the top. Tap the correct answer panel to blast them! Wrong tap or miss = −HP.</p>
              <div className="mt-1 flex items-center gap-2 px-4 py-2 rounded-full bg-white/8 border border-white/10">
                <Coins size={14} className="text-cyan-400" /><span className="font-display font-bold text-white text-sm">{balance.toLocaleString()} SKZ</span>
              </div>
              {balance < 30 && <button onClick={refillBalance} className="text-xs text-cyan-400 underline mt-1">Refill Balance (+1000 SKZ)</button>}
            </div>
            <div className="flex flex-col gap-3 px-4">
              {TICKETS.map(t => {
                const canAfford = balance >= t.price;
                return (
                  <motion.button key={t.id} whileTap={{ scale: 0.97 }} disabled={!canAfford}
                    onClick={() => { if (!canAfford) return; pendingTicketRef.current = t; setTicket(t); setPhase("playing"); }}
                    className={`flex items-center justify-between px-5 py-4 rounded-2xl border transition-all ${canAfford ? "bg-white/5 border-cyan-500/30 hover:border-cyan-400/60 cursor-pointer" : "opacity-40 border-white/10 cursor-not-allowed"}`}>
                    <div className="text-left">
                      <div className="font-display font-bold text-white text-base">{t.name}</div>
                      <div className="text-[10px] text-white/40 tracking-widest uppercase mt-0.5">SCORE {t.target} · {t.time}S</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-bold text-cyan-400 text-lg flex items-center gap-1"><Coins size={13} />{t.prize}</div>
                      <div className="text-[10px] text-white/40 uppercase tracking-wide">ENTRY {t.price}</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
            <div className="flex justify-center mt-5 text-xs text-white/30 font-display">
              <Trophy size={12} className="mr-1 mt-0.5 text-cyan-400/50" />Best: {best}
            </div>
          </motion.div>
        )}

        {phase === "playing" && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex-1 flex flex-col h-full">
            <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
              <div className="flex items-center gap-3 mb-2">
                <Link href="/games"><button className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-cyan-500/30 flex items-center justify-center text-cyan-300"><ArrowLeft size={15} /></button></Link>
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-cyan-500/20"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-400 shadow-[0_0_8px_rgba(0,220,255,0.5)] transition-[width] duration-300" style={{width:`${ticket?Math.min(100,(scoreDisp/ticket.target)*100):0}%`}}/></div>
                  <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 transition-none" style={{width:"100%"}}/></div>
                </div>
              </div>
            </div>
            <canvas ref={canvasRef} className="flex-1 w-full h-full touch-none" />
          </motion.div>
        )}

        {(phase === "won" || phase === "lost") && ticket && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full px-6 gap-5">
            <div className={`text-7xl ${phase === "won" ? "drop-shadow-[0_0_30px_rgba(0,255,255,0.8)]" : "drop-shadow-[0_0_20px_rgba(255,80,80,0.6)]"}`}>{phase === "won" ? "🎯" : "💥"}</div>
            <div className="text-center">
              <div className={`font-display font-black text-4xl uppercase ${phase === "won" ? "text-cyan-400" : "text-red-400"}`}>{phase === "won" ? "BLASTED!" : "MISS!"}</div>
              <div className="text-white/60 text-sm mt-1">Score: {scoreDisp} / {ticket.target}</div>
            </div>
            {phase === "won" ? (
              <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-cyan-500/20 border border-cyan-500/40">
                <Coins size={16} className="text-cyan-400" /><span className="font-display font-bold text-cyan-300 text-lg">+{ticket.prize} SKZ</span>
              </div>
            ) : (
              <div className="text-white/40 text-sm">Lost {ticket.price} SKZ entry fee</div>
            )}
            <div className="text-xs text-white/30 font-display">Balance: {balance.toLocaleString()} SKZ</div>
            {best > 0 && <div className="text-xs text-cyan-400/50 font-display flex items-center gap-1"><Trophy size={11} />Best: {best}</div>}
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button onClick={() => { setPhase("select"); }} className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 font-display font-bold text-cyan-300 hover:bg-cyan-500/30">
                <RotateCcw size={16} />Play Again
              </button>
              <Link href="/games"><button className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/10 font-display text-white/60 text-sm">← All Games</button></Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
