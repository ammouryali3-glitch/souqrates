import { useRef, useState, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";
import { getLang, t as gt } from "@/lib/i18n";
import { GAME_TICKETS } from "@/lib/tickets-data";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }
const BEST_KEY = "skz_numsmash_best";
const BALANCE_KEY = "skz_balance";
const RAW_TICKETS: Ticket[] = GAME_TICKETS.numsmash;

const PRIMES = new Set([2,3,5,7,11,13,17,19,23,29,31,37,41,43]);
const SQUARES = new Set([1,4,9,16,25,36,49]);
const CHALLENGES = [
  { label: "SMASH PRIMES!", test: (n: number) => PRIMES.has(n), color: "#ff6644" },
  { label: "SMASH EVENS!", test: (n: number) => n % 2 === 0, color: "#44aaff" },
  { label: "MULTIPLES OF 3!", test: (n: number) => n % 3 === 0, color: "#44ff88" },
  { label: "PERFECT SQUARES!", test: (n: number) => SQUARES.has(n), color: "#ffdd00" },
  { label: "SMASH ODD!", test: (n: number) => n % 2 !== 0, color: "#cc44ff" },
];

interface Cell { id: number; num: number; x: number; y: number; w: number; visible: boolean; visibleT: number; smashed: boolean; smashT: number; correct: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number; }

export default function NumSmashGame() {
  const TICKETS = useGameTickets("numsmash", RAW_TICKETS);
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
    cells: [] as Cell[], score: 0, hp: 3, time: 60, maxTime: 60, target: 15,
    particles: [] as Particle[], challengeIdx: 0, challengeT: 0,
    nextCellId: 0, spawnT: 0, spawnInterval: 1.8,
    cols: 4, rows: 3,
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
    g.cells = []; g.particles = []; g.challengeIdx = 0; g.challengeT = 0;
    g.nextCellId = 0; g.spawnT = 0; g.spawnInterval = 1.8;
    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    lastSecRef.current = Date.now();
    setHpDisp(3); setScoreDisp(0); setTimeLeft(t.time);
    startingRef.current = false;
    let last = performance.now();
    const COLS = 4, ROWS = 3;
    const CW = canvas.width, CH = canvas.height;
    const PAD = 14, HEADER = 100;
    const cellW = (CW - PAD * (COLS + 1)) / COLS;
    const cellH = (CH - HEADER - PAD * (ROWS + 1)) / ROWS;
    const TWO_PI = Math.PI * 2;

    function spawnCell() {
      const available: number[] = [];
      const occupied = new Set(g.cells.filter(c => c.visible && !c.smashed).map(c => c.id % (COLS * ROWS)));
      for (let i = 0; i < COLS * ROWS; i++) if (!occupied.has(i)) available.push(i);
      if (available.length === 0) return;
      const slot = available[Math.floor(Math.random() * available.length)];
      const col = slot % COLS, row = Math.floor(slot / COLS);
      const x = PAD + col * (cellW + PAD) + cellW / 2;
      const y = HEADER + PAD + row * (cellH + PAD) + cellH / 2;
      const num = 1 + Math.floor(Math.random() * 49);
      const ch = CHALLENGES[g.challengeIdx];
      const correct = ch.test(num);
      g.cells.push({ id: g.nextCellId++, num, x, y, w: Math.min(cellW, cellH) * 0.44, visible: true, visibleT: 2.2, smashed: false, smashT: 0, correct });
    }

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const g = gsRef.current;
      const tLeft = Math.max(0, g.time - (Date.now() - lastSecRef.current) / 1000);
      if (timerBarRef.current) timerBarRef.current.style.width = `${(tLeft / g.maxTime) * 100}%`;
      setTimeLeft(Math.ceil(tLeft));

      // Rotate challenge every 12s
      g.challengeT += dt;
      if (g.challengeT >= 12) { g.challengeT = 0; g.challengeIdx = (g.challengeIdx + 1) % CHALLENGES.length; }

      // Spawn
      g.spawnT += dt;
      if (g.spawnT >= g.spawnInterval) { g.spawnT = 0; spawnCell(); spawnCell(); }

      // Update cells
      for (const c of g.cells) {
        if (c.smashed) { c.smashT -= dt; continue; }
        if (c.visible) {
          c.visibleT -= dt;
          if (c.visibleT <= 0) {
            c.visible = false;
            if (c.correct) { g.hp = Math.max(0, g.hp - 1); setHpDisp(g.hp); if (g.hp <= 0) { finishGame(false, g.score); return; } }
          }
        }
      }
      g.cells = g.cells.filter(c => !c.smashed || c.smashT > 0);

      // Particles
      g.particles = g.particles.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; p.life -= dt; return p.life > 0; });
      if (tLeft <= 0) { finishGame(g.score >= g.target, g.score); return; }

      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#0a0018"; ctx.fillRect(0, 0, CW, CH);

      // Header
      const ch = CHALLENGES[g.challengeIdx];
      ctx.font = "bold 18px 'Orbitron', monospace"; ctx.textAlign = "center";
      ctx.fillStyle = ch.color; ctx.shadowColor = ch.color; ctx.shadowBlur = 16;
      ctx.fillText(ch.label, CW / 2, 48); ctx.shadowBlur = 0;
      ctx.font = "bold 13px 'Orbitron', monospace"; ctx.fillStyle = "#ffffff50";
      ctx.fillText(`SCORE ${g.score} / ${g.target}`, CW / 2, 70);

      // HP
      for (let i = 0; i < 3; i++) { ctx.font = "16px sans-serif"; ctx.textAlign = "left"; ctx.fillText(i < g.hp ? "❤️" : "🖤", 10 + i * 24, 90); }

      // Grid holes
      for (let r = 0; r < ROWS; r++) {
        for (let c2 = 0; c2 < COLS; c2++) {
          const x = PAD + c2 * (cellW + PAD); const y = HEADER + PAD + r * (cellH + PAD);
          ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.roundRect(x, y, cellW, cellH, 14); ctx.fill(); ctx.stroke();
        }
      }

      // Cells
      for (const c of g.cells) {
        if (!c.visible && !c.smashed) continue;
        let alpha = 1;
        if (c.smashed) alpha = Math.max(0, c.smashT / 0.3);
        if (c.visible && c.visibleT < 0.5) alpha = c.visibleT / 0.5;
        ctx.globalAlpha = alpha;
        const r2 = c.w * (c.smashed ? (0.8 + (0.3 - c.smashT) * 1.5) : 1);
        ctx.fillStyle = ch.color + "33"; ctx.strokeStyle = ch.color; ctx.lineWidth = 2.5;
        ctx.shadowColor = ch.color; ctx.shadowBlur = c.smashed ? 30 : 10;
        ctx.beginPath(); ctx.arc(c.x, c.y, r2, 0, TWO_PI); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.font = `bold ${Math.max(16, Math.min(28, c.w * 0.9))}px 'Orbitron', monospace`;
        ctx.textAlign = "center"; ctx.fillStyle = "#ffffff";
        ctx.fillText(String(c.num), c.x, c.y + 8);
        ctx.globalAlpha = 1;
      }

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
      const rect = canvas.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (canvas.width / rect.width);
      const py = (e.clientY - rect.top) * (canvas.height / rect.height);
      const ch2 = CHALLENGES[g.challengeIdx];
      for (const c of g.cells) {
        if (!c.visible || c.smashed) continue;
        const dx = px - c.x, dy = py - c.y;
        if (dx * dx + dy * dy <= c.w * c.w) {
          c.smashed = true; c.smashT = 0.3;
          if (c.correct) {
            g.score++; setScoreDisp(g.score);
            for (let i = 0; i < 18; i++) {
              const angle = Math.random() * Math.PI * 2, spd = 80 + Math.random() * 180;
              g.particles.push({ x: c.x, y: c.y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 60, life: 0.55, max: 0.55, color: ch2.color, r: 3 + Math.random() * 4 });
            }
            if (g.score >= g.target) { finishGame(true, g.score); return; }
          } else {
            g.hp = Math.max(0, g.hp - 1); setHpDisp(g.hp);
            if (g.hp <= 0) { finishGame(false, g.score); return; }
          }
          break;
        }
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

  return (
    <div className="h-screen w-full bg-[#0a0018] flex flex-col overflow-hidden">
      <AnimatePresence mode="wait">
        {phase === "select" && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full overflow-y-auto pb-8">
            <div className="flex items-center gap-3 px-4 pt-4 pb-2">
              <Link href="/games"><button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-white/70" /></button></Link>
              <span className="text-xs font-display tracking-widest text-orange-400/70 uppercase">Number Smash</span>
            </div>
            <div className="flex flex-col items-center gap-2 px-4 pt-4 pb-6">
              <div className="text-6xl mb-1">🔨</div>
              <div className="flex items-center gap-2 text-xs tracking-widest font-display text-orange-400/70 uppercase"><Trophy size={12} />NUMBER SMASH</div>
              <h1 className="font-display font-black text-3xl text-white text-center uppercase tracking-wider">CHOOSE YOUR TICKET</h1>
              <p className="text-xs text-white/50 text-center max-w-[260px]">Numbers pop up in the grid. Follow the challenge: "SMASH PRIMES!" or "SMASH EVENS!" Tap wrong = −HP!</p>
              <div className="mt-1 flex items-center gap-2 px-4 py-2 rounded-full bg-white/8 border border-white/10">
                <Coins size={14} className="text-orange-400" /><span className="font-display font-bold text-white text-sm">{balance.toLocaleString()} SKZ</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 px-4">
              {TICKETS.map(t => {
                const canAfford = balance >= t.price;
                return (
                  <motion.button key={t.id} whileTap={{ scale: 0.97 }} disabled={!canAfford}
                    onClick={() => { if (!canAfford) return; pendingTicketRef.current = t; setTicket(t); setPhase("playing"); }}
                    className={`flex items-center justify-between px-5 py-4 rounded-2xl border transition-all ${canAfford ? "bg-white/5 border-orange-500/30 hover:border-orange-400/60 cursor-pointer" : "opacity-40 border-white/10 cursor-not-allowed"}`}>
                    <div className="text-left">
                      <div className="font-display font-bold text-white text-base">{t.name}</div>
                      <div className="text-[10px] text-white/40 tracking-widest uppercase mt-0.5">SMASH {t.target} · {t.time}S</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-bold text-orange-400 text-lg flex items-center gap-1"><Coins size={13} />{t.prize}</div>
                      <div className="text-[10px] text-white/40 uppercase tracking-wide">ENTRY {t.price}</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
            <div className="flex justify-center mt-5 text-xs text-white/30 font-display"><Trophy size={12} className="mr-1 mt-0.5 text-orange-400/50" />Best: {best}</div>
          </motion.div>
        )}
        {phase === "playing" && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex-1 flex flex-col h-full">
            <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
              <div className="flex items-center gap-3 mb-2">
                <Link href="/games"><button className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-orange-500/30 flex items-center justify-center text-orange-300"><ArrowLeft size={15} /></button></Link>
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-orange-500/20"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-400 shadow-[0_0_8px_rgba(255,120,0,0.5)] transition-[width] duration-300" style={{width:`${ticket?Math.min(100,(scoreDisp/ticket.target)*100):0}%`}}/></div>
                  <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-400 transition-none" style={{width:"100%"}}/></div>
                </div>
              </div>
            </div>
            <canvas ref={canvasRef} className="flex-1 w-full h-full touch-none" />
          </motion.div>
        )}
        {(phase === "won" || phase === "lost") && ticket && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full px-6 gap-5">
            <div className="text-7xl">{phase === "won" ? "🔨" : "😵"}</div>
            <div className="text-center">
              <div className={`font-display font-black text-4xl uppercase ${phase === "won" ? "text-orange-400" : "text-red-400"}`}>{phase === "won" ? "SMASHED!" : "FAILED!"}</div>
              <div className="text-white/60 text-sm mt-1">Score: {scoreDisp} / {ticket.target}</div>
            </div>
            {phase === "won" ? (
              <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-orange-500/20 border border-orange-500/40">
                <Coins size={16} className="text-orange-400" /><span className="font-display font-bold text-orange-300 text-lg">+{ticket.prize} SKZ</span>
              </div>
            ) : <div className="text-white/40 text-sm">{gt[getLang()].gameEntryLost(ticket.price)}</div>}
            <div className="text-xs text-white/30 font-display">Balance: {balance.toLocaleString()} SKZ</div>
            {best > 0 && <div className="text-xs text-orange-400/50 font-display flex items-center gap-1"><Trophy size={11} />Best: {best}</div>}
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button onClick={() => setPhase("select")} className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-orange-500/20 border border-orange-500/40 font-display font-bold text-orange-300 hover:bg-orange-500/30"><RotateCcw size={16} />{gt[getLang()].gamePlayAgain}</button>
              <Link href="/games"><button className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/10 font-display text-white/60 text-sm">← All Games</button></Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
