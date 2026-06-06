import { useRef, useState, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";
import { getLang, t as gt } from "@/lib/i18n";
import { GAME_TICKETS } from "@/lib/tickets-data";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; targetSum: number; }
const BEST_KEY = "skz_chainsum_best";
const BALANCE_KEY = "skz_balance";
const RAW_TICKETS: Ticket[] = GAME_TICKETS.chainsum;
const COLS = 5, ROWS = 5;
interface Cell { val: number; x: number; y: number; r: number; inChain: boolean; clearing: boolean; clearT: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; }

function isAdjacent(a: number, b: number): boolean {
  const ar = Math.floor(a / COLS), ac = a % COLS;
  const br = Math.floor(b / COLS), bc = b % COLS;
  return Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1 && !(ar === br && ac === bc);
}

export default function ChainSumGame() {
  const TICKETS = useGameTickets("chainsum", RAW_TICKETS);
  const [phase, setPhase] = useState<Phase>("select");
  const [scoreDisp, setScoreDisp] = useState(0);
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
    cells: [] as Cell[], chain: [] as number[], score: 0,
    time: 60, maxTime: 60, target: 6, targetSum: 10,
    particles: [] as Particle[], dragging: false,
    wrongFlash: 0, correctFlash: 0,
    cellR: 30, startX: 0, startY: 0,
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
    g.score = 0; g.time = t.time; g.maxTime = t.time; g.target = t.target; g.targetSum = t.targetSum;
    g.chain = []; g.dragging = false; g.particles = []; g.wrongFlash = 0; g.correctFlash = 0;
    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const cw = canvas.width, ch = canvas.height;
    const PAD = 16, HEADER = 110;
    const gridW = cw - PAD * 2, gridH = ch - HEADER - PAD;
    const cellR = Math.min(gridW / COLS, gridH / ROWS) * 0.4;
    g.cellR = cellR;
    g.startX = PAD + (gridW - (COLS - 1) * gridW / COLS) / 2 + gridW / COLS / 2;
    g.startY = HEADER + cellR;

    g.cells = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      const col = i % COLS, row = Math.floor(i / COLS);
      const x = PAD + (col + 0.5) * (gridW / COLS);
      const y = HEADER + (row + 0.5) * (gridH / ROWS);
      g.cells.push({ val: 1 + Math.floor(Math.random() * 9), x, y, r: cellR, inChain: false, clearing: false, clearT: 0 });
    }

    lastSecRef.current = Date.now();
    setScoreDisp(0); setTimeLeft(t.time);
    startingRef.current = false;
    let last = performance.now();
    const TWO_PI = Math.PI * 2;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const g = gsRef.current;
      const tLeft = Math.max(0, g.time - (Date.now() - lastSecRef.current) / 1000);
      if (timerBarRef.current) timerBarRef.current.style.width = `${(tLeft / g.maxTime) * 100}%`;
      setTimeLeft(Math.ceil(tLeft));
      for (const c of g.cells) { if (c.clearing) { c.clearT -= dt; if (c.clearT <= 0) { c.clearing = false; c.val = 1 + Math.floor(Math.random() * 9); } } }
      g.particles = g.particles.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 180 * dt; p.life -= dt; return p.life > 0; });
      g.wrongFlash = Math.max(0, g.wrongFlash - dt * 4);
      g.correctFlash = Math.max(0, g.correctFlash - dt * 3);
      if (tLeft <= 0) { finishGame(g.score >= g.target, g.score); return; }

      const ctx = canvas.getContext("2d")!;
      const cw2 = canvas.width, ch2 = canvas.height;
      ctx.fillStyle = "#020f08"; ctx.fillRect(0, 0, cw2, ch2);
      if (g.wrongFlash > 0) { ctx.fillStyle = `rgba(255,60,60,${g.wrongFlash * 0.25})`; ctx.fillRect(0, 0, cw2, ch2); }
      if (g.correctFlash > 0) { ctx.fillStyle = `rgba(60,255,120,${g.correctFlash * 0.22})`; ctx.fillRect(0, 0, cw2, ch2); }

      // Header
      ctx.font = "bold 15px 'Orbitron', monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#33ff88";
      ctx.shadowColor = "#33ff88"; ctx.shadowBlur = 14;
      ctx.fillText(`TARGET SUM: ${g.targetSum}`, cw2 / 2, 44); ctx.shadowBlur = 0;
      ctx.font = "bold 13px 'Orbitron', monospace"; ctx.fillStyle = "#ffffff50";
      ctx.fillText(`CHAINS ${g.score} / ${g.target}`, cw2 / 2, 65);

      // Chain sum display
      const chainSum = g.chain.reduce((s, i) => s + g.cells[i].val, 0);
      if (g.chain.length > 0) {
        const color = chainSum === g.targetSum ? "#33ff88" : chainSum > g.targetSum ? "#ff4444" : "#ffcc44";
        ctx.font = "bold 20px 'Orbitron', monospace"; ctx.fillStyle = color;
        ctx.shadowColor = color; ctx.shadowBlur = 12;
        ctx.fillText(`SUM: ${chainSum}`, cw2 / 2, 90); ctx.shadowBlur = 0;
      } else {
        ctx.font = "13px 'Orbitron', monospace"; ctx.fillStyle = "#ffffff25";
        ctx.fillText("Draw a path to sum to target", cw2 / 2, 90);
      }

      // Connection lines
      if (g.chain.length > 1) {
        ctx.strokeStyle = "#33ff8888"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath();
        ctx.moveTo(g.cells[g.chain[0]].x, g.cells[g.chain[0]].y);
        for (let i = 1; i < g.chain.length; i++) ctx.lineTo(g.cells[g.chain[i]].x, g.cells[g.chain[i]].y);
        ctx.stroke();
      }

      // Cells
      for (let i = 0; i < g.cells.length; i++) {
        const c = g.cells[i];
        if (c.clearing) {
          ctx.globalAlpha = Math.max(0, c.clearT / 0.4);
          ctx.fillStyle = "#33ff88"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * (1 + (0.4 - c.clearT) * 2), 0, TWO_PI); ctx.fill();
          ctx.globalAlpha = 1; continue;
        }
        const inChain = g.chain.includes(i);
        const isLast = g.chain[g.chain.length - 1] === i;
        ctx.fillStyle = inChain ? "rgba(51,255,136,0.25)" : "rgba(255,255,255,0.05)";
        ctx.strokeStyle = isLast ? "#88ffbb" : inChain ? "#33ff88" : "rgba(51,255,136,0.2)";
        ctx.lineWidth = inChain ? 2.5 : 1.5;
        ctx.shadowColor = inChain ? "#33ff88" : "transparent"; ctx.shadowBlur = inChain ? 12 : 0;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TWO_PI); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.font = `bold ${Math.floor(c.r * 0.9)}px 'Orbitron', monospace`;
        ctx.textAlign = "center"; ctx.fillStyle = inChain ? "#aaffcc" : "#ffffff90";
        ctx.fillText(String(c.val), c.x, c.y + c.r * 0.32);
      }

      // Particles
      for (const p of g.particles) { ctx.globalAlpha = p.life / p.max; ctx.fillStyle = "#33ff88"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TWO_PI); ctx.fill(); }
      ctx.globalAlpha = 1;
      setScoreDisp(g.score);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    function cellAtPoint(px: number, py: number): number {
      const g = gsRef.current;
      for (let i = 0; i < g.cells.length; i++) {
        const c = g.cells[i];
        if (c.clearing) continue;
        const dx = px - c.x, dy = py - c.y;
        if (dx * dx + dy * dy <= (c.r * 1.15) * (c.r * 1.15)) return i;
      }
      return -1;
    }

    function getPointerPos(e: PointerEvent): [number, number] {
      const rect = canvas.getBoundingClientRect();
      return [(e.clientX - rect.left) * (canvas.width / rect.width), (e.clientY - rect.top) * (canvas.height / rect.height)];
    }

    const onDown = (e: PointerEvent) => {
      if (finishedRef.current) return;
      const g = gsRef.current;
      const [px, py] = getPointerPos(e);
      const idx = cellAtPoint(px, py);
      if (idx < 0) return;
      g.dragging = true; g.chain = [idx]; g.cells[idx].inChain = true;
    };
    const onMove = (e: PointerEvent) => {
      if (finishedRef.current || !gsRef.current.dragging) return;
      const g = gsRef.current;
      const [px, py] = getPointerPos(e);
      const idx = cellAtPoint(px, py);
      if (idx < 0 || g.chain.includes(idx)) return;
      const last2 = g.chain[g.chain.length - 1];
      if (!isAdjacent(last2, idx)) return;
      g.chain.push(idx); g.cells[idx].inChain = true;
    };
    const onUp = () => {
      if (finishedRef.current) return;
      const g = gsRef.current;
      if (!g.dragging) return;
      g.dragging = false;
      const chainSum = g.chain.reduce((s, i) => s + g.cells[i].val, 0);
      if (chainSum === g.targetSum && g.chain.length >= 2) {
        g.score++;
        g.correctFlash = 0.5;
        for (const idx of g.chain) {
          const c = g.cells[idx];
          for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2, spd = 60 + Math.random() * 120;
            g.particles.push({ x: c.x, y: c.y, vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd - 40, life: 0.5, max: 0.5, r: 2 + Math.random() * 3 });
          }
          c.clearing = true; c.clearT = 0.4; c.inChain = false;
        }
        if (g.score >= g.target) { finishGame(true, g.score); return; }
      } else {
        if (g.chain.length >= 2) g.wrongFlash = 0.5;
        for (const idx of g.chain) g.cells[idx].inChain = false;
      }
      g.chain = [];
    };
    canvas.addEventListener("pointerdown", onDown, { signal: abortRef.current!.signal });
    canvas.addEventListener("pointermove", onMove, { signal: abortRef.current!.signal });
    canvas.addEventListener("pointerup", onUp, { signal: abortRef.current!.signal });
    canvas.addEventListener("pointercancel", onUp, { signal: abortRef.current!.signal });
  }, [finishGame]);

  useEffect(() => { return () => { cancelAnimationFrame(rafRef.current); abortRef.current?.abort(); }; }, []);
  useEffect(() => {
    if (phase !== "playing" || !pendingTicketRef.current) return;
    const t = pendingTicketRef.current;
    pendingTicketRef.current = null;
    startGame(t);
  }, [phase, startGame]);

  return (
    <div className="h-screen w-full bg-[#020f08] flex flex-col overflow-hidden">
      <AnimatePresence mode="wait">
        {phase === "select" && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full overflow-y-auto pb-8">
            <div className="flex items-center gap-3 px-4 pt-4 pb-2">
              <Link href="/games"><button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-white/70" /></button></Link>
              <span className="text-xs font-display tracking-widest text-emerald-400/70 uppercase">Sum Chain</span>
            </div>
            <div className="flex flex-col items-center gap-2 px-4 pt-4 pb-6">
              <div className="text-6xl mb-1">🔗</div>
              <div className="flex items-center gap-2 text-xs tracking-widest font-display text-emerald-400/70 uppercase"><Trophy size={12} />SUM CHAIN</div>
              <h1 className="font-display font-black text-3xl text-white text-center uppercase tracking-wider">CHOOSE YOUR TICKET</h1>
              <p className="text-xs text-white/50 text-center max-w-[260px]">Draw a path through adjacent numbers that add up to the target. Find chains to score!</p>
              <div className="mt-1 flex items-center gap-2 px-4 py-2 rounded-full bg-white/8 border border-white/10">
                <Coins size={14} className="text-emerald-400" /><span className="font-display font-bold text-white text-sm">{balance.toLocaleString()} SKZ</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 px-4">
              {TICKETS.map(t => {
                const canAfford = balance >= t.price;
                return (
                  <motion.button key={t.id} whileTap={{ scale: 0.97 }} disabled={!canAfford}
                    onClick={() => { if (!canAfford) return; pendingTicketRef.current = t; setTicket(t); setPhase("playing"); }}
                    className={`flex items-center justify-between px-5 py-4 rounded-2xl border transition-all ${canAfford ? "bg-white/5 border-emerald-500/30 hover:border-emerald-400/60 cursor-pointer" : "opacity-40 border-white/10 cursor-not-allowed"}`}>
                    <div className="text-left">
                      <div className="font-display font-bold text-white text-base">{t.name}</div>
                      <div className="text-[10px] text-white/40 tracking-widest uppercase mt-0.5">SUM {t.targetSum} · {t.target} CHAINS · {t.time}S</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-bold text-emerald-400 text-lg flex items-center gap-1"><Coins size={13} />{t.prize}</div>
                      <div className="text-[10px] text-white/40 uppercase tracking-wide">ENTRY {t.price}</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
            <div className="flex justify-center mt-5 text-xs text-white/30 font-display"><Trophy size={12} className="mr-1 mt-0.5 text-emerald-400/50" />Best: {best}</div>
          </motion.div>
        )}
        {phase === "playing" && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex-1 flex flex-col h-full">
            <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
              <div className="flex items-center gap-3 mb-2">
                <Link href="/games"><button className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-emerald-500/30 flex items-center justify-center text-emerald-300"><ArrowLeft size={15} /></button></Link>
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-emerald-500/20"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400 shadow-[0_0_8px_rgba(0,200,100,0.5)] transition-[width] duration-300" style={{width:`${ticket?Math.min(100,(scoreDisp/ticket.target)*100):0}%`}}/></div>
                  <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-400 transition-none" style={{width:"100%"}}/></div>
                </div>
              </div>
            </div>
            <canvas ref={canvasRef} className="flex-1 w-full h-full touch-none" style={{ touchAction: "none" }} />
          </motion.div>
        )}
        {(phase === "won" || phase === "lost") && ticket && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full px-6 gap-5">
            <div className="text-7xl">{phase === "won" ? "🔗" : "❌"}</div>
            <div className="text-center">
              <div className={`font-display font-black text-4xl uppercase ${phase === "won" ? "text-emerald-400" : "text-red-400"}`}>{phase === "won" ? "CHAINED!" : "BROKEN!"}</div>
              <div className="text-white/60 text-sm mt-1">Chains: {scoreDisp} / {ticket.target}</div>
            </div>
            {phase === "won" ? (
              <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40">
                <Coins size={16} className="text-emerald-400" /><span className="font-display font-bold text-emerald-300 text-lg">+{ticket.prize} SKZ</span>
              </div>
            ) : <div className="text-white/40 text-sm">{gt[getLang()].gameEntryLost(ticket.price)}</div>}
            <div className="text-xs text-white/30 font-display">Balance: {balance.toLocaleString()} SKZ</div>
            {best > 0 && <div className="text-xs text-emerald-400/50 font-display flex items-center gap-1"><Trophy size={11} />Best: {best}</div>}
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button onClick={() => setPhase("select")} className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 font-display font-bold text-emerald-300 hover:bg-emerald-500/30"><RotateCcw size={16} />{gt[getLang()].gamePlayAgain}</button>
              <Link href="/games"><button className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/10 font-display text-white/60 text-sm">← All Games</button></Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
