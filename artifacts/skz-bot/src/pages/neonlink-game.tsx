import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }
const BEST_KEY = "skz_neonlink_best";
const BALANCE_KEY = "skz_balance";
const RAW_TICKETS: Ticket[] = [
  { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 6,  time: 60 },
  { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 12, time: 55 },
  { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 20, time: 50 },
  { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 30, time: 45 },
  { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 45, time: 40 },
];
const SHAPE_COLORS = ["#ff4da6", "#00d4ff", "#ffdd00", "#ff7a00", "#cc88ff", "#44ff88"];
const SHAPES = ["★", "●", "■", "◆", "▲", "♥"];
const SHAPE_R = 26;

interface NShape { x: number; y: number; type: number; paired: boolean; id: number; }
interface Conn { x1: number; y1: number; x2: number; y2: number; color: string; life: number; }
interface Obstacle { x: number; y: number; vx: number; vy: number; r: number; }

export default function NeonLinkGame() {
  const TICKETS = useGameTickets("neonlink", RAW_TICKETS);
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
  const onDownRef = useRef<((x: number, y: number) => void) | null>(null);
  const onMoveRef = useRef<((x: number, y: number) => void) | null>(null);
  const onUpRef = useRef<((x: number, y: number) => void) | null>(null);

  const gsRef = useRef({
    shapes: [] as NShape[], drag: null as { fromId: number; fx: number; fy: number; cx: number; cy: number } | null,
    conns: [] as Conn[], ob: { x: 200, y: 300, vx: 110, vy: 85, r: 22 } as Obstacle,
    score: 0, time: 60, maxTime: 60, target: 6, nextId: 0, roundPairs: 3, roundDone: 0, failFlash: 0,
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
    const canvas = canvasRef.current!;
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const W = canvas.width, H = canvas.height;
    g.score = 0; g.time = t.time; g.maxTime = t.time; g.target = t.target;
    g.nextId = 0; g.roundPairs = 3; g.roundDone = 0; g.drag = null; g.conns = []; g.failFlash = 0;
    g.ob = { x: W * 0.5, y: H * 0.5, vx: 110, vy: 85, r: 22 };
    lastSecRef.current = Date.now();
    setScoreDisp(0); setTimeLeft(t.time);
    startingRef.current = false;

    function spawnRound() {
      const TOP = 80, M = 55;
      const types = Array.from({ length: g.roundPairs }, (_, i) => i % SHAPES.length);
      const pairs = [...types, ...types];
      for (let i = pairs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pairs[i], pairs[j]] = [pairs[j], pairs[i]]; }
      const pos: { x: number; y: number }[] = [];
      g.shapes = pairs.map((type, _i) => {
        let x: number, y: number, att = 0;
        do { x = M + Math.random() * (W - M * 2); y = TOP + M + Math.random() * (H - TOP - M * 2); att++; }
        while (att < 40 && pos.some(p => Math.hypot(p.x - x, p.y - y) < SHAPE_R * 2.8));
        pos.push({ x, y });
        return { x, y, type, paired: false, id: g.nextId++ };
      });
    }
    spawnRound();

    function segCircleHit(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number) {
      const dx = x2 - x1, dy = y2 - y1, fx = x1 - cx, fy = y1 - cy;
      const a = dx * dx + dy * dy;
      if (a === 0) return Math.hypot(fx, fy) < r;
      const t2 = Math.max(0, Math.min(1, -(fx * dx + fy * dy) / a));
      const nx = x1 + t2 * dx - cx, ny = y1 + t2 * dy - cy;
      return nx * nx + ny * ny < (r + 12) * (r + 12);
    }

    onDownRef.current = (px, py) => {
      if (finishedRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const rx = px - rect.left, ry = py - rect.top;
      const s = g.shapes.find(sh => !sh.paired && Math.hypot(sh.x - rx, sh.y - ry) < SHAPE_R + 10);
      if (s) g.drag = { fromId: s.id, fx: s.x, fy: s.y, cx: rx, cy: ry };
    };
    onMoveRef.current = (px, py) => {
      if (!g.drag) return;
      const rect = canvas.getBoundingClientRect();
      g.drag.cx = px - rect.left; g.drag.cy = py - rect.top;
    };
    onUpRef.current = (px, py) => {
      if (!g.drag || finishedRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const rx = px - rect.left, ry = py - rect.top;
      const from = g.shapes.find(s => s.id === g.drag!.fromId);
      if (!from) { g.drag = null; return; }
      const match = g.shapes.find(s => !s.paired && s.id !== from.id && s.type === from.type && Math.hypot(s.x - rx, s.y - ry) < SHAPE_R + 14);
      if (match) {
        if (segCircleHit(from.x, from.y, match.x, match.y, g.ob.x, g.ob.y, g.ob.r)) {
          g.failFlash = 0.5;
        } else {
          from.paired = true; match.paired = true;
          g.conns.push({ x1: from.x, y1: from.y, x2: match.x, y2: match.y, color: SHAPE_COLORS[from.type], life: 1.5 });
          g.score++; g.roundDone++;
          setScoreDisp(g.score);
          if (g.score >= g.target) { g.drag = null; finishGame(true, g.score); return; }
          if (g.roundDone >= g.roundPairs) {
            g.roundDone = 0;
            g.roundPairs = Math.min(g.roundPairs + 1, SHAPES.length);
            spawnRound();
          }
        }
      }
      g.drag = null;
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
          timerBarRef.current.style.background = g.time <= 8 ? "linear-gradient(to right,#ef4444,#dc2626)" : "linear-gradient(to right,#06b6d4,#6366f1)";
        }
        if (g.time <= 0) { finishGame(g.score >= g.target, g.score); return; }
      }
      // move obstacle
      g.ob.x += g.ob.vx * dt; g.ob.y += g.ob.vy * dt;
      if (g.ob.x < g.ob.r + 10 || g.ob.x > W - g.ob.r - 10) g.ob.vx *= -1;
      if (g.ob.y < 80 || g.ob.y > H - g.ob.r - 10) g.ob.vy *= -1;
      g.conns.forEach(c => c.life -= dt * 1.2); g.conns = g.conns.filter(c => c.life > 0);

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#000a18"; ctx.fillRect(0, 0, W, H);
      // star field
      for (let i = 0; i < 50; i++) {
        const sx = ((i * 137.508) % 1) * W, sy = ((i * 173.311) % 1) * H;
        ctx.beginPath(); ctx.arc(sx, sy, 0.7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.2 + ((i * 47) % 30) / 100})`; ctx.fill();
      }
      // connections
      g.conns.forEach(c => {
        ctx.save(); ctx.globalAlpha = Math.min(1, c.life);
        const gr = ctx.createLinearGradient(c.x1, c.y1, c.x2, c.y2);
        gr.addColorStop(0, c.color); gr.addColorStop(1, c.color + "33");
        ctx.shadowColor = c.color; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.moveTo(c.x1, c.y1); ctx.lineTo(c.x2, c.y2);
        ctx.strokeStyle = gr; ctx.lineWidth = 3.5; ctx.stroke();
        ctx.shadowBlur = 0; ctx.restore();
      });
      // drag line
      if (g.drag) {
        const from = g.shapes.find(s => s.id === g.drag!.fromId);
        if (from) {
          ctx.save();
          const gr = ctx.createLinearGradient(from.x, from.y, g.drag.cx, g.drag.cy);
          gr.addColorStop(0, SHAPE_COLORS[from.type]); gr.addColorStop(1, SHAPE_COLORS[from.type] + "22");
          ctx.shadowColor = SHAPE_COLORS[from.type]; ctx.shadowBlur = 14;
          ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(g.drag.cx, g.drag.cy);
          ctx.strokeStyle = gr; ctx.lineWidth = 3; ctx.setLineDash([8, 5]); ctx.stroke();
          ctx.shadowBlur = 0; ctx.restore();
        }
      }
      // obstacle
      const ob = g.ob;
      ctx.save(); ctx.beginPath(); ctx.arc(ob.x, ob.y, ob.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,30,80,0.2)"; ctx.fill();
      ctx.shadowColor = "#ff1e50"; ctx.shadowBlur = 22;
      ctx.strokeStyle = "#ff1e50"; ctx.lineWidth = 2.5; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = "#ff1e50"; ctx.font = "bold 13px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("⚡", ob.x, ob.y); ctx.restore();
      // fail flash
      if (g.failFlash > 0) { ctx.fillStyle = `rgba(255,20,60,${g.failFlash * 0.3})`; ctx.fillRect(0, 0, W, H); g.failFlash -= dt * 2.5; }
      // shapes
      g.shapes.forEach(sh => {
        if (sh.paired) return;
        const color = SHAPE_COLORS[sh.type];
        ctx.save(); ctx.font = `bold ${SHAPE_R * 1.5}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.shadowColor = color; ctx.shadowBlur = 20; ctx.fillStyle = color;
        ctx.fillText(SHAPES[sh.type], sh.x, sh.y);
        ctx.beginPath(); ctx.arc(sh.x, sh.y, SHAPE_R + 5, 0, Math.PI * 2);
        ctx.strokeStyle = color + "55"; ctx.lineWidth = 2; ctx.stroke(); ctx.shadowBlur = 0; ctx.restore();
      });
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
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{ background: "#000a18" }}>
      <AnimatePresence mode="wait">
        {phase === "select" && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col px-6 pt-10 pb-6 overflow-y-auto" style={{ background: "rgba(0,10,24,0.97)" }}>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
              <Link href="/games"><button className="self-start mb-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-white/70" /></button></Link>
              <div className="text-4xl mb-2">✨</div>
              <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-cyan-400" /><span className="text-[11px] tracking-[0.4em] text-cyan-400/60 uppercase">Neon Link</span></div>
              <h1 className="font-display font-black text-2xl text-cyan-300 mb-3">CHOOSE YOUR TICKET</h1>
              <p className="text-xs text-white/50 mb-4 max-w-[260px]">Drag glowing lines to connect matching symbols! If your line crosses the ⚡ blocker, the connection snaps!</p>
              <div className="flex items-center gap-2 mb-6 bg-white/5 rounded-full px-4 py-2"><Coins size={14} className="text-cyan-400" /><span className="font-display font-bold text-white">{balance.toLocaleString()} SKZ</span></div>
              <div className="flex flex-col gap-3 w-full">
                {TICKETS.map(tk => (
                  <button key={tk.id} disabled={balance < tk.price} onClick={() => { setTicket(tk); pendingTicketRef.current = tk; setPhase("playing"); }}
                    className="flex items-center justify-between px-5 py-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">
                    <div className="text-left"><div className="font-display font-bold text-white text-base">{tk.name}</div><div className="text-xs text-white/40">LINKS {tk.target} · {tk.time}S</div></div>
                    <div className="text-right"><div className="font-display font-bold text-cyan-300 text-lg flex items-center gap-1"><Coins size={13} className="text-cyan-400" />{tk.prize}</div><div className="text-xs text-white/40">ENTRY {tk.price}</div></div>
                  </button>
                ))}
              </div>
              {balance < TICKETS[0].price && <button onClick={() => { setBalance(1000); localStorage.setItem(BALANCE_KEY, "1000"); }} className="mt-4 text-xs text-cyan-400/60 underline">Refill balance (demo)</button>}
            </motion.div>
          </motion.div>
        )}

        {phase === "playing" && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex-1 flex flex-col h-full">
            <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
              <div className="flex items-center gap-3 mb-2">
                <Link href="/games"><button className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-cyan-500/30 flex items-center justify-center text-cyan-300"><ArrowLeft size={15} /></button></Link>
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-cyan-500/20"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-400 shadow-[0_0_8px_rgba(6,182,212,0.5)] transition-[width] duration-300" style={{ width: `${ticket ? Math.min(100, (scoreDisp / ticket.target) * 100) : 0}%` }} /></div>
                  <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-400 transition-none" style={{ width: "100%" }} /></div>
                </div>
              </div>
            </div>
            <div className="flex-1 relative touch-none"
              onPointerDown={(e) => onDownRef.current?.(e.clientX, e.clientY)}
              onPointerMove={(e) => onMoveRef.current?.(e.clientX, e.clientY)}
              onPointerUp={(e) => onUpRef.current?.(e.clientX, e.clientY)}
              onPointerLeave={(e) => onUpRef.current?.(e.clientX, e.clientY)}>
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
            </div>
          </motion.div>
        )}

        {(phase === "won" || phase === "lost") && ticket && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full px-6 gap-5">
            <div className="text-7xl">{phase === "won" ? "✨" : "⚡"}</div>
            <div className="text-center">
              <div className={`font-display font-black text-4xl uppercase ${phase === "won" ? "text-cyan-400" : "text-red-400"}`}>{phase === "won" ? "LINKED!" : "BLOCKED!"}</div>
              <div className="text-white/60 text-sm mt-1">Links: {scoreDisp} / {ticket.target}</div>
            </div>
            {phase === "won" ? (
              <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-cyan-500/20 border border-cyan-500/40"><Coins size={16} className="text-cyan-400" /><span className="font-display font-bold text-cyan-300 text-lg">+{ticket.prize} SKZ</span></div>
            ) : <div className="text-white/40 text-sm">Lost {ticket.price} SKZ entry fee</div>}
            <div className="text-xs text-white/30 font-display">Balance: {balance.toLocaleString()} SKZ</div>
            {best > 0 && <div className="text-xs text-cyan-400/50 font-display flex items-center gap-1"><Trophy size={11} />Best: {best}</div>}
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button onClick={() => { pendingTicketRef.current = ticket; startingRef.current = false; finishedRef.current = false; setScoreDisp(0); setTimeLeft(ticket.time); setPhase("playing"); }}
                className="w-full py-3 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-display font-bold tracking-wide text-sm flex items-center justify-center gap-2"><RotateCcw size={16} /> TRY AGAIN</button>
              <Link href="/games"><button className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-display font-bold tracking-wide text-sm">← BACK</button></Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
