import { useRef, useState, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }
const BEST_KEY = "skz_speedmath_best";
const BALANCE_KEY = "skz_balance";
const RAW_TICKETS: Ticket[] = [
  { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 100, time: 60 },
  { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 180, time: 55 },
  { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 280, time: 50 },
  { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 420, time: 45 },
  { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 600, time: 40 },
];

interface Question { eq: string; answer: number; choices: [number,number,number,number]; }

function genQuestion(level: number): Question {
  const ops = level < 2 ? [0, 1] : level < 3 ? [0,1,2] : [0,1,2,3];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number, b: number, answer: number, eq: string;
  if (op === 0) { a = 3 + Math.floor(Math.random() * (7 + level * 4)); b = 3 + Math.floor(Math.random() * (7 + level * 4)); answer = a + b; eq = `${a} + ${b}`; }
  else if (op === 1) { a = 8 + Math.floor(Math.random() * (10 + level * 3)); b = 1 + Math.floor(Math.random() * 7); answer = a - b; eq = `${a} − ${b}`; }
  else if (op === 2) { a = 2 + Math.floor(Math.random() * 8); b = 2 + Math.floor(Math.random() * 8); answer = a * b; eq = `${a} × ${b}`; }
  else { b = 2 + Math.floor(Math.random() * 9); answer = 2 + Math.floor(Math.random() * 9); a = b * answer; eq = `${a} ÷ ${b}`; }
  const wrongs = new Set<number>();
  while (wrongs.size < 3) {
    const d = (Math.random() < 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 7));
    const w = Math.max(0, answer + d);
    if (w !== answer) wrongs.add(w);
  }
  const arr: number[] = [answer, ...Array.from(wrongs)];
  for (let i = 3; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return { eq, answer, choices: [arr[0], arr[1], arr[2], arr[3]] };
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number; }

export default function SpeedMathGame() {
  const TICKETS = useGameTickets("speedmath", RAW_TICKETS);
  const [phase, setPhase] = useState<Phase>("select");
  const [scoreDisp, setScoreDisp] = useState(0);
  const [hpDisp, setHpDisp] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [comboDisp, setComboDisp] = useState(0);
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
    q: null as Question | null,
    qPhase: "show" as "show" | "choose",
    showT: 0, answerT: 0,
    score: 0, hp: 3, combo: 0,
    time: 60, maxTime: 60, target: 100,
    particles: [] as Particle[],
    resultFlash: null as null | { correct: boolean; points: number; t: number },
    level: 1,
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
    g.score = 0; g.hp = 3; g.combo = 0; g.level = 1;
    g.time = t.time; g.maxTime = t.time; g.target = t.target;
    g.particles = []; g.resultFlash = null;
    g.q = genQuestion(1); g.qPhase = "show"; g.showT = 0.9; g.answerT = 0;
    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    lastSecRef.current = Date.now();
    setHpDisp(3); setScoreDisp(0); setComboDisp(0); setTimeLeft(t.time);
    startingRef.current = false;
    let last = performance.now();
    const TWO_PI = Math.PI * 2;
    const CHOICE_COLS = ["#1a2f5e","#1a3a1a","#3a1a00","#2a001a"];
    const CHOICE_BRD = ["#4488ff","#44ff88","#ffaa44","#ff44aa"];

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const g = gsRef.current;
      const tLeft = Math.max(0, g.time - (Date.now() - lastSecRef.current) / 1000);
      if (timerBarRef.current) timerBarRef.current.style.width = `${(tLeft / g.maxTime) * 100}%`;
      setTimeLeft(Math.ceil(tLeft));

      if (g.qPhase === "show") {
        g.showT -= dt;
        if (g.showT <= 0) { g.qPhase = "choose"; g.answerT = 0; }
      } else {
        g.answerT += dt;
      }

      if (g.resultFlash) { g.resultFlash.t -= dt; if (g.resultFlash.t <= 0) { g.resultFlash = null; g.q = genQuestion(g.level); g.qPhase = "show"; g.showT = Math.max(0.5, 0.9 - g.level * 0.04); } }
      g.particles = g.particles.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 180 * dt; p.life -= dt; return p.life > 0; });
      if (tLeft <= 0) { finishGame(g.score >= g.target, g.score); return; }

      const ctx = canvas.getContext("2d")!;
      const cw = canvas.width, ch = canvas.height;
      ctx.fillStyle = "#100800"; ctx.fillRect(0, 0, cw, ch);

      // Lightning bg lines
      if (g.qPhase === "show") {
        const alpha = Math.sin((0.9 - g.showT) / 0.9 * Math.PI) * 0.15;
        ctx.strokeStyle = `rgba(255,220,0,${alpha})`; ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const x = (i / 5) * cw;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (Math.random() * 40 - 20), ch); ctx.stroke();
        }
      }

      // Result flash
      if (g.resultFlash) {
        const a = g.resultFlash.t / 0.4;
        ctx.fillStyle = g.resultFlash.correct ? `rgba(80,255,150,${a*0.25})` : `rgba(255,60,60,${a*0.25})`;
        ctx.fillRect(0, 0, cw, ch);
      }

      // HP / combo / score header
      for (let i = 0; i < 3; i++) { ctx.font = "16px sans-serif"; ctx.textAlign = "left"; ctx.fillText(i < g.hp ? "❤️" : "🖤", 10 + i * 26, 38); }
      ctx.font = "bold 13px 'Orbitron', monospace"; ctx.textAlign = "right"; ctx.fillStyle = "#ffd700";
      ctx.fillText(`${g.score} / ${g.target}`, cw - 10, 38);
      if (g.combo > 1) {
        ctx.textAlign = "center"; ctx.fillStyle = "#ff8800";
        ctx.shadowColor = "#ff8800"; ctx.shadowBlur = 12;
        ctx.fillText(`×${g.combo} COMBO`, cw / 2, 38); ctx.shadowBlur = 0;
      }

      // Equation display area
      const eqY = ch * 0.35;
      if (g.qPhase === "show" && g.q) {
        // Flash: big centered equation
        const pulse = 1 + Math.sin((0.9 - g.showT) * 8) * 0.03;
        ctx.save(); ctx.translate(cw / 2, eqY); ctx.scale(pulse, pulse);
        ctx.font = "bold 52px 'Orbitron', monospace"; ctx.textAlign = "center";
        const gr = ctx.createLinearGradient(-100, -30, 100, 30);
        gr.addColorStop(0, "#ffd700"); gr.addColorStop(1, "#ffaa00");
        ctx.fillStyle = gr; ctx.shadowColor = "#ffcc00"; ctx.shadowBlur = 30;
        ctx.fillText(g.q.eq, 0, 0); ctx.shadowBlur = 0;
        ctx.restore();
        // "= ?" below
        ctx.font = "bold 28px 'Orbitron', monospace"; ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,200,0,0.6)"; ctx.fillText("= ?", cw / 2, eqY + 50);
        // Countdown bar
        const prog = g.showT / 0.9;
        ctx.fillStyle = "rgba(255,200,0,0.15)"; ctx.beginPath(); ctx.roundRect(cw*0.15, eqY+70, cw*0.7, 6, 3); ctx.fill();
        ctx.fillStyle = "#ffd700"; ctx.shadowColor = "#ffd700"; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.roundRect(cw*0.15, eqY+70, cw*0.7*prog, 6, 3); ctx.fill(); ctx.shadowBlur = 0;
      } else if (g.qPhase === "choose" && g.q && !g.resultFlash) {
        // Blurred equation hint
        ctx.font = "bold 32px 'Orbitron', monospace"; ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,200,0,0.15)"; ctx.fillText(g.q.eq + " = ?", cw / 2, eqY - 20);
        ctx.font = "bold 16px 'Orbitron', monospace"; ctx.fillStyle = "#ffffff30";
        ctx.fillText("TAP THE ANSWER!", cw / 2, eqY + 18);
        // Speed indicator (fades)
        const speed = Math.max(0, 1 - g.answerT / 3);
        if (speed > 0) {
          ctx.font = "bold 12px 'Orbitron', monospace"; ctx.fillStyle = `rgba(255,${Math.floor(200*speed)},0,${speed})`;
          ctx.fillText(`SPEED BONUS: ×${Math.max(1, Math.ceil(3 - g.answerT)).toFixed(0)}`, cw / 2, eqY + 40);
        }
      }
      if (g.resultFlash && g.q) {
        ctx.font = "bold 24px 'Orbitron', monospace"; ctx.textAlign = "center";
        ctx.fillStyle = g.resultFlash.correct ? "#50ff96" : "#ff5050";
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 18;
        ctx.fillText(g.resultFlash.correct ? `+${g.resultFlash.points} pts!` : "WRONG!", cw / 2, eqY); ctx.shadowBlur = 0;
      }

      // Choice buttons (2×2 grid)
      if (g.q && g.qPhase === "choose" && !g.resultFlash) {
        const BW = (cw - 30) / 2, BH = 64, gapY = 10;
        const startBY = ch - (BH * 2 + gapY + 20);
        for (let i = 0; i < 4; i++) {
          const col = i % 2, row = Math.floor(i / 2);
          const bx = 10 + col * (BW + 10), by = startBY + row * (BH + gapY);
          ctx.fillStyle = CHOICE_COLS[i]; ctx.strokeStyle = CHOICE_BRD[i]; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(bx, by, BW, BH, 14); ctx.fill(); ctx.stroke();
          ctx.font = "bold 26px 'Orbitron', monospace"; ctx.textAlign = "center";
          ctx.fillStyle = CHOICE_BRD[i]; ctx.shadowColor = CHOICE_BRD[i]; ctx.shadowBlur = 10;
          ctx.fillText(String(g.q.choices[i]), bx + BW / 2, by + BH / 2 + 9); ctx.shadowBlur = 0;
        }
      }

      // Particles
      for (const p of g.particles) { ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TWO_PI); ctx.fill(); }
      ctx.globalAlpha = 1;
      setScoreDisp(g.score); setComboDisp(g.combo);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const handlePointer = (e: PointerEvent) => {
      if (finishedRef.current) return;
      const g = gsRef.current;
      if (!g.q || g.qPhase !== "choose" || g.resultFlash) return;
      const canvas2 = canvasRef.current!;
      const rect = canvas2.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (canvas2.width / rect.width);
      const py = (e.clientY - rect.top) * (canvas2.height / rect.height);
      const BW = (canvas2.width - 30) / 2, BH = 64, gapY = 10;
      const startBY = canvas2.height - (BH * 2 + gapY + 20);
      let chosen = -1;
      for (let i = 0; i < 4; i++) {
        const col = i % 2, row = Math.floor(i / 2);
        const bx = 10 + col * (BW + 10), by = startBY + row * (BH + gapY);
        if (px >= bx && px <= bx + BW && py >= by && py <= by + BH) { chosen = i; break; }
      }
      if (chosen < 0) return;
      const val = g.q.choices[chosen];
      const correct = val === g.q.answer;
      if (correct) {
        const speedMult = Math.max(1, Math.ceil(3 - g.answerT));
        const comboMult = Math.min(5, 1 + Math.floor(g.combo / 3));
        const pts = 10 * speedMult * comboMult;
        g.score += pts; g.combo++;
        g.level = Math.floor(g.score / 100) + 1;
        g.resultFlash = { correct: true, points: pts, t: 0.4 };
        const CHOICE_BRD = ["#4488ff","#44ff88","#ffaa44","#ff44aa"];
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2, spd = 100 + Math.random() * 200;
          g.particles.push({ x: canvas2.width / 2, y: canvas2.height * 0.5, vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd - 80, life: 0.6, max: 0.6, color: CHOICE_BRD[chosen], r: 3 + Math.random() * 4 });
        }
        if (g.score >= g.target) { setTimeout(() => finishGame(true, g.score), 450); return; }
      } else {
        g.combo = 0; g.hp = Math.max(0, g.hp - 1); setHpDisp(g.hp);
        g.resultFlash = { correct: false, points: 0, t: 0.4 };
        if (g.hp <= 0) { setTimeout(() => finishGame(false, g.score), 450); return; }
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
    <div className="h-screen w-full bg-[#100800] flex flex-col overflow-hidden">
      <AnimatePresence mode="wait">
        {phase === "select" && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full overflow-y-auto pb-8">
            <div className="flex items-center gap-3 px-4 pt-4 pb-2">
              <Link href="/games"><button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-white/70" /></button></Link>
              <span className="text-xs font-display tracking-widest text-yellow-400/70 uppercase">Speed Math</span>
            </div>
            <div className="flex flex-col items-center gap-2 px-4 pt-4 pb-6">
              <div className="text-6xl mb-1">⚡</div>
              <div className="flex items-center gap-2 text-xs tracking-widest font-display text-yellow-400/70 uppercase"><Trophy size={12} />SPEED MATH</div>
              <h1 className="font-display font-black text-3xl text-white text-center uppercase tracking-wider">CHOOSE YOUR TICKET</h1>
              <p className="text-xs text-white/50 text-center max-w-[260px]">Equation flashes briefly — then 4 answers appear. Tap fast for speed bonus! Build combos for multiplier!</p>
              <div className="mt-1 flex items-center gap-2 px-4 py-2 rounded-full bg-white/8 border border-white/10">
                <Coins size={14} className="text-yellow-400" /><span className="font-display font-bold text-white text-sm">{balance.toLocaleString()} SKZ</span>
              </div>
              {balance < 30 && <button onClick={refillBalance} className="text-xs text-yellow-400 underline mt-1">Refill Balance (+1000 SKZ)</button>}
            </div>
            <div className="flex flex-col gap-3 px-4">
              {TICKETS.map(t => {
                const canAfford = balance >= t.price;
                return (
                  <motion.button key={t.id} whileTap={{ scale: 0.97 }} disabled={!canAfford}
                    onClick={() => { if (!canAfford) return; pendingTicketRef.current = t; setTicket(t); setPhase("playing"); }}
                    className={`flex items-center justify-between px-5 py-4 rounded-2xl border transition-all ${canAfford ? "bg-white/5 border-yellow-500/30 hover:border-yellow-400/60 cursor-pointer" : "opacity-40 border-white/10 cursor-not-allowed"}`}>
                    <div className="text-left">
                      <div className="font-display font-bold text-white text-base">{t.name}</div>
                      <div className="text-[10px] text-white/40 tracking-widest uppercase mt-0.5">SCORE {t.target} · {t.time}S</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-bold text-yellow-400 text-lg flex items-center gap-1"><Coins size={13} />{t.prize}</div>
                      <div className="text-[10px] text-white/40 uppercase tracking-wide">ENTRY {t.price}</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
            <div className="flex justify-center mt-5 text-xs text-white/30 font-display"><Trophy size={12} className="mr-1 mt-0.5 text-yellow-400/50" />Best: {best}</div>
          </motion.div>
        )}
        {phase === "playing" && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex-1 flex flex-col h-full">
            <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
              <div className="flex items-center gap-3 mb-2">
                <Link href="/games"><button className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-yellow-500/30 flex items-center justify-center text-yellow-300"><ArrowLeft size={15} /></button></Link>
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-yellow-500/20"><div className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-orange-400 shadow-[0_0_8px_rgba(255,190,0,0.5)] transition-[width] duration-300" style={{width:`${ticket?Math.min(100,(scoreDisp/ticket.target)*100):0}%`}}/></div>
                  <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-none" style={{width:"100%"}}/></div>
                </div>
              </div>
            </div>
            <canvas ref={canvasRef} className="flex-1 w-full h-full touch-none" />
          </motion.div>
        )}
        {(phase === "won" || phase === "lost") && ticket && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full px-6 gap-5">
            <div className="text-7xl">{phase === "won" ? "⚡" : "💀"}</div>
            <div className="text-center">
              <div className={`font-display font-black text-4xl uppercase ${phase === "won" ? "text-yellow-400" : "text-red-400"}`}>{phase === "won" ? "LIGHTNING!" : "TOO SLOW!"}</div>
              <div className="text-white/60 text-sm mt-1">Score: {scoreDisp} / {ticket.target}</div>
            </div>
            {phase === "won" ? (
              <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-yellow-500/20 border border-yellow-500/40">
                <Coins size={16} className="text-yellow-400" /><span className="font-display font-bold text-yellow-300 text-lg">+{ticket.prize} SKZ</span>
              </div>
            ) : <div className="text-white/40 text-sm">Lost {ticket.price} SKZ entry fee</div>}
            <div className="text-xs text-white/30 font-display">Balance: {balance.toLocaleString()} SKZ</div>
            {best > 0 && <div className="text-xs text-yellow-400/50 font-display flex items-center gap-1"><Trophy size={11} />Best: {best}</div>}
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button onClick={() => setPhase("select")} className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-yellow-500/20 border border-yellow-500/40 font-display font-bold text-yellow-300 hover:bg-yellow-500/30"><RotateCcw size={16} />Play Again</button>
              <Link href="/games"><button className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/10 font-display text-white/60 text-sm">← All Games</button></Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
