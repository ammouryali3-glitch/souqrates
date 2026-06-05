import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw, Trophy, Coins, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";
import { GAME_TICKETS } from "@/lib/tickets-data";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }
const BEST_KEY = "skz_match3_best";
const BALANCE_KEY = "skz_balance";
const RAW_TICKETS: Ticket[] = GAME_TICKETS.match3;
const COLS = 7, ROWS = 7;
const GEM_COLORS = ["#ff4444", "#4488ff", "#44ff88", "#ffdd00", "#cc44ff"];
const GEM_GLOW   = ["#ff222288", "#2266ff88", "#22ff6688", "#ffcc0088", "#aa22ff88"];
interface FloatText { x: number; y: number; text: string; life: number; vy: number; }

function mkGrid(): number[] { return Array.from({ length: COLS * ROWS }, () => Math.floor(Math.random() * GEM_COLORS.length)); }

function findMatches(grid: number[]): Set<number> {
  const m = new Set<number>();
  for (let r = 0; r < ROWS; r++) {
    let s = 0, len = 1;
    for (let c = 1; c <= COLS; c++) {
      if (c < COLS && grid[r * COLS + c] === grid[r * COLS + (c - 1)] && grid[r * COLS + c] !== -1) { len++; }
      else { if (len >= 3) for (let k = 0; k < len; k++) m.add(r * COLS + (s + k)); s = c; len = 1; }
    }
  }
  for (let c = 0; c < COLS; c++) {
    let s = 0, len = 1;
    for (let r = 1; r <= ROWS; r++) {
      if (r < ROWS && grid[r * COLS + c] === grid[(r - 1) * COLS + c] && grid[r * COLS + c] !== -1) { len++; }
      else { if (len >= 3) for (let k = 0; k < len; k++) m.add((s + k) * COLS + c); s = r; len = 1; }
    }
  }
  return m;
}

function dropAndFill(grid: number[]): void {
  for (let c = 0; c < COLS; c++) {
    let wr = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r * COLS + c] !== -1) { grid[wr * COLS + c] = grid[r * COLS + c]; if (wr !== r) grid[r * COLS + c] = -1; wr--; }
    }
    while (wr >= 0) { grid[wr * COLS + c] = Math.floor(Math.random() * GEM_COLORS.length); wr--; }
  }
}

export default function Match3Game() {
  const TICKETS = useGameTickets("match3", RAW_TICKETS);
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
  const pendingTicketRef = useRef<Ticket | null>(null);
  const onTapRef = useRef<((x: number, y: number) => void) | null>(null);

  const gsRef = useRef({
    grid: [] as number[], selected: null as { r: number; c: number } | null,
    floats: [] as FloatText[], score: 0, time: 60, maxTime: 60, target: 150,
    flashCells: new Set<number>(), flashT: 0, shakeT: 0, shakeAmp: 0,
  });

  const finishGame = useCallback((won: boolean, finalScore: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true; cancelAnimationFrame(rafRef.current);
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
    // ensure no initial matches
    let grid = mkGrid();
    for (let attempt = 0; attempt < 20; attempt++) { if (findMatches(grid).size === 0) break; grid = mkGrid(); }
    g.grid = grid; g.selected = null; g.floats = [];
    g.score = 0; g.time = t.time; g.maxTime = t.time; g.target = t.target;
    g.flashCells = new Set(); g.flashT = 0; g.shakeT = 0; g.shakeAmp = 0;
    const canvas = canvasRef.current!;
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    lastSecRef.current = Date.now();
    setScoreDisp(0); setTimeLeft(t.time);
    startingRef.current = false;

    const TOP = 70;
    function layout() {
      const W = canvas.width;
      const cs = Math.floor((W - 10) / COLS);
      const left = Math.round((W - cs * COLS) / 2);
      const top = TOP + 8;
      return { cs, left, top };
    }

    function applyMatches() {
      const matched = findMatches(g.grid);
      if (matched.size === 0) return;
      const pts = matched.size * 10 + (matched.size >= 5 ? 50 : 0);
      g.score += pts;
      if (matched.size >= 5) { g.time = Math.min(g.maxTime, g.time + 3); g.shakeT = 0.3; g.shakeAmp = 6; }
      else if (matched.size >= 4) { g.shakeT = 0.15; g.shakeAmp = 3; }
      const { cs, left, top } = layout();
      // float text
      const midIdx = [...matched][Math.floor(matched.size / 2)];
      const mc = midIdx % COLS, mr = Math.floor(midIdx / COLS);
      g.floats.push({ x: left + mc * cs + cs / 2, y: top + mr * cs, text: `+${pts}`, life: 1, vy: -60 });
      g.flashCells = matched; g.flashT = 0.2;
      matched.forEach(idx => { g.grid[idx] = -1; });
      dropAndFill(g.grid);
      setScoreDisp(g.score);
      if (g.score >= g.target) { setTimeout(() => finishGame(true, g.score), 200); }
      // one cascade
      setTimeout(() => {
        if (!finishedRef.current) { applyMatches(); }
      }, 250);
    }

    onTapRef.current = (px, py) => {
      if (finishedRef.current || g.flashT > 0) return;
      const rect = canvas.getBoundingClientRect();
      const { cs, left, top } = layout();
      const rx = px - rect.left, ry = py - rect.top;
      const c = Math.floor((rx - left) / cs), r = Math.floor((ry - top) / cs);
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) { g.selected = null; return; }
      if (!g.selected) { g.selected = { r, c }; return; }
      const { r: sr, c: sc } = g.selected;
      if (r === sr && c === sc) { g.selected = null; return; }
      if (!((r === sr && Math.abs(c - sc) === 1) || (c === sc && Math.abs(r - sr) === 1))) {
        g.selected = { r, c }; return;
      }
      // attempt swap
      const ai = sr * COLS + sc, bi = r * COLS + c;
      [g.grid[ai], g.grid[bi]] = [g.grid[bi], g.grid[ai]];
      const m = findMatches(g.grid);
      if (m.size === 0) { [g.grid[ai], g.grid[bi]] = [g.grid[bi], g.grid[ai]]; } // swap back
      else { applyMatches(); }
      g.selected = null;
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
          timerBarRef.current.style.background = g.time <= 8 ? "linear-gradient(to right,#ef4444,#dc2626)" : "linear-gradient(to right,#a855f7,#ec4899)";
        }
        if (g.time <= 0) { finishGame(g.score >= g.target, g.score); return; }
      }
      g.flashT = Math.max(0, g.flashT - dt); if (g.flashT <= 0) g.flashCells = new Set();
      g.shakeT = Math.max(0, g.shakeT - dt);
      const sx = g.shakeT > 0 ? (Math.random() - 0.5) * 2 * g.shakeAmp : 0;
      const sy = g.shakeT > 0 ? (Math.random() - 0.5) * 2 * g.shakeAmp : 0;
      g.floats.forEach(f => { f.y += f.vy * dt; f.life -= dt * 1.8; });
      g.floats = g.floats.filter(f => f.life > 0);

      const ctx = canvas.getContext("2d")!; const W = canvas.width, H = canvas.height;
      const { cs, left, top } = layout();
      ctx.clearRect(0, 0, W, H); ctx.save(); ctx.translate(sx, sy);
      const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#0c001a"); bg.addColorStop(1, "#06000f");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      for (let r2 = 0; r2 < ROWS; r2++) {
        for (let c2 = 0; c2 < COLS; c2++) {
          const idx = r2 * COLS + c2, color = g.grid[idx]; if (color === -1) continue;
          const x = left + c2 * cs + 2, y = top + r2 * cs + 2, s2 = cs - 4;
          const hex = GEM_COLORS[color];
          const isFlash = g.flashCells.has(idx), isSel = g.selected?.r === r2 && g.selected?.c === c2;
          ctx.beginPath(); ctx.roundRect(x, y, s2, s2, 8);
          ctx.fillStyle = isFlash ? "#ffffff" : hex + "cc"; ctx.fill();
          if (!isFlash) {
            ctx.beginPath(); ctx.roundRect(x + 3, y + 3, s2 - 6, s2 * 0.38, 5);
            ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fill();
          }
          ctx.shadowColor = isFlash ? "#ffffff" : hex; ctx.shadowBlur = isSel ? 20 : 8;
          ctx.beginPath(); ctx.roundRect(x, y, s2, s2, 8);
          ctx.strokeStyle = isSel ? "#ffffff" : hex; ctx.lineWidth = isSel ? 2.5 : 1.5; ctx.stroke();
          ctx.shadowBlur = 0;
          if (isSel) {
            ctx.beginPath(); ctx.roundRect(x - 2, y - 2, s2 + 4, s2 + 4, 10);
            ctx.strokeStyle = "#ffffff55"; ctx.lineWidth = 1; ctx.stroke();
          }
        }
      }
      // float texts
      g.floats.forEach(f => {
        ctx.save(); ctx.globalAlpha = Math.max(0, f.life);
        ctx.font = "bold 18px 'Orbitron',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff"; ctx.shadowColor = "#a855f7"; ctx.shadowBlur = 12;
        ctx.fillText(f.text, f.x, f.y); ctx.shadowBlur = 0; ctx.restore();
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
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{ background: "#0c001a" }}>
      <AnimatePresence mode="wait">
        {phase === "select" && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col px-6 pt-10 pb-6 overflow-y-auto" style={{ background: "rgba(12,0,26,0.97)" }}>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
              <Link href="/games"><button className="self-start mb-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-white/70" /></button></Link>
              <div className="text-4xl mb-2">🎮</div>
              <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-purple-400" /><span className="text-[11px] tracking-[0.4em] text-purple-400/60 uppercase">Match 3 Blitz</span></div>
              <h1 className="font-display font-black text-2xl text-purple-300 mb-3">CHOOSE YOUR TICKET</h1>
              <p className="text-xs text-white/50 mb-4 max-w-[260px]">Swap adjacent gems to match 3 or more! Match 5+ for bonus time and explosive combo points. Race the clock!</p>
              <div className="flex items-center gap-2 mb-6 bg-white/5 rounded-full px-4 py-2"><Coins size={14} className="text-purple-400" /><span className="font-display font-bold text-white">{balance.toLocaleString()} SKZ</span></div>
              <div className="flex flex-col gap-3 w-full">
                {TICKETS.map(tk => (
                  <button key={tk.id} disabled={balance < tk.price} onClick={() => { setTicket(tk); pendingTicketRef.current = tk; setPhase("playing"); }}
                    className="flex items-center justify-between px-5 py-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">
                    <div className="text-left"><div className="font-display font-bold text-white text-base">{tk.name}</div><div className="text-xs text-white/40">SCORE {tk.target} · {tk.time}S</div></div>
                    <div className="text-right"><div className="font-display font-bold text-purple-300 text-lg flex items-center gap-1"><Coins size={13} className="text-purple-400" />{tk.prize}</div><div className="text-xs text-white/40">ENTRY {tk.price}</div></div>
                  </button>
                ))}
              </div>
              {balance < TICKETS[0].price && <button onClick={() => { setBalance(1000); localStorage.setItem(BALANCE_KEY, "1000"); }} className="mt-4 text-xs text-purple-400/60 underline">Refill balance (demo)</button>}
            </motion.div>
          </motion.div>
        )}

        {phase === "playing" && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex-1 flex flex-col h-full">
            <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
              <div className="flex items-center gap-3 mb-2">
                <Link href="/games"><button className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-purple-500/30 flex items-center justify-center text-purple-300"><ArrowLeft size={15} /></button></Link>
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-purple-500/20"><div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-400 shadow-[0_0_8px_rgba(168,85,247,0.5)] transition-[width] duration-300" style={{ width: `${ticket ? Math.min(100, (scoreDisp / ticket.target) * 100) : 0}%` }} /></div>
                  <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} className="h-full rounded-full bg-gradient-to-r from-purple-400 to-pink-400 transition-none" style={{ width: "100%" }} /></div>
                </div>
              </div>
            </div>
            <div className="flex-1 relative" onPointerDown={(e) => onTapRef.current?.(e.clientX, e.clientY)}>
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none" />
            </div>
          </motion.div>
        )}

        {(phase === "won" || phase === "lost") && ticket && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full px-6 gap-5">
            <div className={`text-7xl ${phase === "won" ? "drop-shadow-[0_0_30px_rgba(168,85,247,0.8)]" : ""}`}>{phase === "won" ? "🎮" : "💀"}</div>
            <div className="text-center">
              <div className={`font-display font-black text-4xl uppercase ${phase === "won" ? "text-purple-400" : "text-red-400"}`}>{phase === "won" ? "BLITZED!" : "OUT OF TIME!"}</div>
              <div className="text-white/60 text-sm mt-1">Score: {scoreDisp} / {ticket.target}</div>
            </div>
            {phase === "won" ? (
              <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-purple-500/20 border border-purple-500/40"><Coins size={16} className="text-purple-400" /><span className="font-display font-bold text-purple-300 text-lg">+{ticket.prize} SKZ</span></div>
            ) : <div className="text-white/40 text-sm">Lost {ticket.price} SKZ entry fee</div>}
            <div className="text-xs text-white/30 font-display">Balance: {balance.toLocaleString()} SKZ</div>
            {best > 0 && <div className="text-xs text-purple-400/50 font-display flex items-center gap-1"><Trophy size={11} />Best: {best}</div>}
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button onClick={() => { pendingTicketRef.current = ticket; startingRef.current = false; finishedRef.current = false; setScoreDisp(0); setTimeLeft(ticket.time); setPhase("playing"); }}
                className="w-full py-3 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-300 font-display font-bold tracking-wide text-sm flex items-center justify-center gap-2"><RotateCcw size={16} /> TRY AGAIN</button>
              <Link href="/games"><button className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-display font-bold tracking-wide text-sm">← BACK</button></Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
