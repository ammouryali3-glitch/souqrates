import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { useGameFlow } from "@/components/game-flow";
import { ArrowLeft, RotateCcw, Trophy, Coins, Grid2x2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";
import { getLang, t as gt } from "@/lib/i18n";
import { GAME_TICKETS } from "@/lib/tickets-data";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }
const BEST_KEY = "skz_gridpop_best";
const BALANCE_KEY = "skz_balance";
const RAW_TICKETS: Ticket[] = GAME_TICKETS.gridpop;
const COLS = 6, ROWS = 9;
const COLORS = ["#ff4da6", "#00d4ff", "#ffdd00", "#4dff91", "#ff7a00", "#cc88ff"];
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; r: number; }

export default function GridPopGame() {
  const TICKETS = useGameTickets("gridpop", RAW_TICKETS);
  const [phase, setPhase] = useState<Phase>("select");
  const [scoreDisp, setScoreDisp] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [balance, setBalance] = useState(() => parseInt(localStorage.getItem(BALANCE_KEY) || "1000"));
  const [best, setBest] = useState(() => parseInt(localStorage.getItem(BEST_KEY) || "0"));
  const [ticket, setTicket] = useState<Ticket | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const finishedRef = useRef(false);
  const startingRef = useRef(false);
  const timerBarRef = useRef<HTMLDivElement>(null);
  const lastSecRef = useRef(0);
  const pendingTicketRef = useRef<Ticket | null>(null);
  const onTapRef = useRef<((x: number, y: number) => void) | null>(null);
  const gsRef = useRef({ grid: [] as number[], particles: [] as Particle[], score: 0, time: 60, maxTime: 60, target: 200, shakeT: 0, shakeAmp: 0 });

  const { requestEntry, requestExit, notifyWin, overlays } = useGameFlow({ ticket, onConfirmedEntry: (tk) => { setTicket(tk as unknown as Ticket); pendingTicketRef.current = tk as unknown as Ticket; setPhase("playing"); } });
  const finishGame = useCallback((won: boolean, finalScore: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    cancelAnimationFrame(rafRef.current);
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
    if (canvasRef.current.offsetWidth === 0) { rafRef.current = requestAnimationFrame(() => startGame(t)); return; }
    startingRef.current = true; finishedRef.current = false;
    const g = gsRef.current;
    g.grid = Array.from({ length: COLS * ROWS }, () => Math.floor(Math.random() * COLORS.length));
    g.particles = []; g.score = 0; g.time = t.time; g.maxTime = t.time; g.target = t.target; g.shakeT = 0; g.shakeAmp = 0;
    const canvas = canvasRef.current!;
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    lastSecRef.current = Date.now();
    setScoreDisp(0); setTimeLeft(t.time);
    startingRef.current = false;
    const TOP = 72;

    function cellDims() { return { cw: canvas.width / COLS, ch: (canvas.height - TOP) / ROWS }; }

    function floodFill(idx: number, color: number, visited: Set<number>) {
      if (visited.has(idx) || g.grid[idx] !== color) return;
      visited.add(idx);
      const col = idx % COLS, row = Math.floor(idx / COLS);
      if (col > 0) floodFill(idx - 1, color, visited);
      if (col < COLS - 1) floodFill(idx + 1, color, visited);
      if (row > 0) floodFill(idx - COLS, color, visited);
      if (row < ROWS - 1) floodFill(idx + COLS, color, visited);
    }

    function popGroup(cells: number[], color: number) {
      const { cw, ch } = cellDims();
      g.score += cells.length * cells.length;
      if (cells.length >= 8) { g.time = Math.min(g.maxTime, g.time + 5); g.shakeT = 0.5; g.shakeAmp = 10; }
      else if (cells.length >= 5) { g.shakeT = 0.25; g.shakeAmp = 5; }
      const hex = COLORS[color];
      cells.forEach(idx => {
        const c = idx % COLS, r = Math.floor(idx / COLS);
        const cx = c * cw + cw / 2, cy = TOP + r * ch + ch / 2;
        for (let i = 0; i < 10 + cells.length; i++) {
          const a = Math.random() * Math.PI * 2, spd = 80 + Math.random() * 220;
          g.particles.push({ x: cx, y: cy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 30, life: 1 + Math.random() * 0.4, color: hex, r: 3 + Math.random() * 5 });
        }
        g.grid[idx] = -1;
      });
      for (let c = 0; c < COLS; c++) {
        let wr = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) {
          if (g.grid[r * COLS + c] !== -1) { g.grid[wr * COLS + c] = g.grid[r * COLS + c]; if (wr !== r) g.grid[r * COLS + c] = -1; wr--; }
        }
        while (wr >= 0) { g.grid[wr * COLS + c] = Math.floor(Math.random() * COLORS.length); wr--; }
      }
    }

    onTapRef.current = (px, py) => {
      if (finishedRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const { cw, ch } = cellDims();
      const col = Math.floor((px - rect.left) / cw);
      const row = Math.floor((py - rect.top - TOP) / ch);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
      const idx = row * COLS + col;
      if (g.grid[idx] === -1) return;
      const color = g.grid[idx];
      const visited = new Set<number>(); floodFill(idx, color, visited);
      if (visited.size >= 3) {
        popGroup([...visited], color);
        setScoreDisp(g.score);
        if (g.score >= g.target) { finishGame(true, g.score); }
      }
    };

    let last = performance.now();
    function loop(now: number) {
      if (finishedRef.current) return;
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      const n2 = Date.now();
      if (n2 - lastSecRef.current >= 1000) {
        lastSecRef.current = n2; g.time = Math.max(0, g.time - 1); setTimeLeft(g.time);
        if (timerBarRef.current) {
          timerBarRef.current.style.width = `${(g.time / g.maxTime) * 100}%`;
          timerBarRef.current.style.background = g.time <= 8 ? "linear-gradient(to right,#ef4444,#dc2626)" : "linear-gradient(to right,#ec4899,#a855f7)";
        }
        if (g.time <= 0) { finishGame(g.score >= g.target, g.score); return; }
      }
      g.shakeT = Math.max(0, g.shakeT - dt);
      const sx = g.shakeT > 0 ? (Math.random() - 0.5) * 2 * g.shakeAmp : 0;
      const sy = g.shakeT > 0 ? (Math.random() - 0.5) * 2 * g.shakeAmp : 0;
      const ctx = canvas.getContext("2d")!; const { width: W, height: H } = canvas;
      const { cw, ch } = cellDims();
      ctx.clearRect(0, 0, W, H);
      ctx.save(); ctx.translate(sx, sy);
      const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#0a0010"); bg.addColorStop(1, "#04000a");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const idx = r * COLS + c, color = g.grid[idx]; if (color === -1) continue;
          const x = c * cw + 2, y = TOP + r * ch + 2, bw = cw - 4, bh = ch - 4;
          const hex = COLORS[color];
          ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 7); ctx.fillStyle = hex + "bb"; ctx.fill();
          ctx.beginPath(); ctx.roundRect(x + 3, y + 3, bw - 6, bh * 0.38, 4); ctx.fillStyle = "rgba(255,255,255,0.27)"; ctx.fill();
          ctx.shadowColor = hex; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 7); ctx.strokeStyle = hex; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
      g.particles = g.particles.filter(p => p.life > 0);
      g.particles.forEach(p => {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 360 * dt; p.life -= dt * 2.2;
        const a = Math.max(0, p.life);
        ctx.shadowColor = p.color; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(a * 200).toString(16).padStart(2, "0"); ctx.fill(); ctx.shadowBlur = 0;
      });
      ctx.restore();
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [finishGame]);

  useEffect(() => {
    const t = pendingTicketRef.current;
    if (phase === "playing" && t) { pendingTicketRef.current = null; startGame(t); }
  }, [phase, startGame]);
  useEffect(() => () => { cancelAnimationFrame(rafRef.current); }, []);

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{ background: "#0a0010" }}>
      <AnimatePresence mode="wait">
        {phase === "select" && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col px-6 pt-10 pb-6 overflow-y-auto" style={{ background: "rgba(10,0,16,0.97)" }}>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
              <Link href="/games"><button className="self-start mb-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-white/70" /></button></Link>
              <div className="text-4xl mb-2">💎</div>
              <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-pink-400" /><span className="text-[11px] tracking-[0.4em] text-pink-400/60 uppercase">Grid Pop</span></div>
              <h1 className="font-display font-black text-2xl text-pink-300 mb-3">CHOOSE YOUR TICKET</h1>
              <p className="text-xs text-white/50 mb-4 max-w-[260px]">Tap 3+ connected same-color blocks to pop them! Pop 8+ at once for bonus time and a screen-shaking explosion!</p>
              <div className="flex items-center gap-2 mb-6 bg-white/5 rounded-full px-4 py-2"><Coins size={14} className="text-pink-400" /><span className="font-display font-bold text-white">{balance.toLocaleString()} SKZ</span></div>
              <div className="flex flex-col gap-3 w-full">
                {TICKETS.map(tk => (
                  <button key={tk.id} disabled={balance < tk.price} onClick={() => requestEntry(tk)}
                    className="flex items-center justify-between px-5 py-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">
                    <div className="text-left"><div className="font-display font-bold text-white text-base">{tk.name}</div><div className="text-xs text-white/40">SCORE {tk.target} · {tk.time}S</div></div>
                    <div className="text-right"><div className="font-display font-bold text-pink-300 text-lg flex items-center gap-1"><Coins size={13} className="text-pink-400" />{tk.prize}</div><div className="text-xs text-white/40">ENTRY {tk.price}</div></div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {phase === "playing" && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex-1 flex flex-col h-full">
            <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={requestExit} className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-pink-500/30 flex items-center justify-center text-pink-300"><ArrowLeft size={15}/></button>
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-pink-500/20"><div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-purple-400 shadow-[0_0_8px_rgba(236,72,153,0.5)] transition-[width] duration-300" style={{ width: `${ticket ? Math.min(100, (scoreDisp / ticket.target) * 100) : 0}%` }} /></div>
                  <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-400 transition-none" style={{ width: "100%" }} /></div>
                </div>
              </div>
            </div>
            <div ref={wrapRef} className="flex-1 relative" onPointerDown={(e) => onTapRef.current?.(e.clientX, e.clientY)}>
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none" />
            </div>
          </motion.div>
        )}

        {(phase === "won" || phase === "lost") && ticket && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full px-6 gap-5">
            <div className={`text-7xl ${phase === "won" ? "drop-shadow-[0_0_30px_rgba(236,72,153,0.8)]" : ""}`}>{phase === "won" ? "💎" : "💥"}</div>
            <div className="text-center">
              <div className={`font-display font-black text-4xl uppercase ${phase === "won" ? "text-pink-400" : "text-red-400"}`}>{phase === "won" ? "POPPED!" : "SCATTERED!"}</div>
              <div className="text-white/60 text-sm mt-1">Score: {scoreDisp} / {ticket.target}</div>
            </div>
            {phase === "won" ? (
              <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-pink-500/20 border border-pink-500/40"><Coins size={16} className="text-pink-400" /><span className="font-display font-bold text-pink-300 text-lg">+{ticket.prize} SKZ</span></div>
            ) : <div className="text-white/40 text-sm">{gt[getLang()].gameEntryLost(ticket.price)}</div>}
            <div className="text-xs text-white/30 font-display">Balance: {balance.toLocaleString()} SKZ</div>
            {best > 0 && <div className="text-xs text-pink-400/50 font-display flex items-center gap-1"><Trophy size={11} />Best: {best}</div>}
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button onClick={() => { pendingTicketRef.current = ticket; startingRef.current = false; finishedRef.current = false; setScoreDisp(0); setTimeLeft(ticket.time); setPhase("playing"); }}
                className="w-full py-3 rounded-2xl bg-pink-500/20 border border-pink-500/40 text-pink-300 font-display font-bold tracking-wide text-sm flex items-center justify-center gap-2"><RotateCcw size={16} /> {gt[getLang()].gamePlayAgain}</button>
              <Link href="/games"><button className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-display font-bold tracking-wide text-sm">← BACK</button></Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {overlays}
    </div>
  );
}
