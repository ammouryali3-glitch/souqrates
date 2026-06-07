import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { useGameFlow } from "@/components/game-flow";
import { ArrowLeft, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";
import { getLang, t as gt } from "@/lib/i18n";
import { GAME_TICKETS } from "@/lib/tickets-data";

type Phase = "select" | "playing" | "won" | "lost";
type Op = "+" | "×";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }
const BEST_KEY = "skz_quicksum_best";
const BALANCE_KEY = "skz_balance";
const RAW_TICKETS: Ticket[] = GAME_TICKETS.quicksum;

function genRound(roundNum: number): { nums: number[]; target: number; op: Op } {
  const useMultiply = roundNum > 3 && Math.random() < 0.3;
  const nums: number[] = Array.from({ length: 9 }, () => 1 + Math.floor(Math.random() * 9));
  if (useMultiply) {
    const i = Math.floor(Math.random() * 9);
    let j = (i + 1 + Math.floor(Math.random() * 8)) % 9;
    const a = 2 + Math.floor(Math.random() * 6), b = 2 + Math.floor(Math.random() * 6);
    nums[i] = a; nums[j] = b;
    return { nums, target: a * b, op: "×" };
  }
  const count = 2 + Math.floor(Math.random() * 3);
  const indices: number[] = [];
  while (indices.length < count) { const k = Math.floor(Math.random() * 9); if (!indices.includes(k)) indices.push(k); }
  let sum = 0;
  indices.forEach(k => { const v = 1 + Math.floor(Math.random() * 7); nums[k] = v; sum += v; });
  return { nums, target: sum, op: "+" };
}

export default function QuickSumGame() {
  const TICKETS = useGameTickets("quicksum", RAW_TICKETS);
  const [phase, setPhase] = useState<Phase>("select");
  const [scoreDisp, setScoreDisp] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [balance, setBalance] = useState(() => parseInt(localStorage.getItem(BALANCE_KEY) || "1000"));
  const [best, setBest] = useState(() => parseInt(localStorage.getItem(BEST_KEY) || "0"));
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [nums, setNums] = useState<number[]>([]);
  const [target, setTarget] = useState(0);
  const [op, setOp] = useState<Op>("+");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

  const timerBarRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreRef = useRef(0);
  const roundRef = useRef(0);
  const finishedRef = useRef(false);
  const feedbackRef = useRef(false);
  const pendingTicketRef = useRef<Ticket | null>(null);

  const { requestEntry, requestExit, notifyWin, overlays } = useGameFlow({ ticket, onConfirmedEntry: (tk) => { setTicket(tk as unknown as Ticket); pendingTicketRef.current = tk as unknown as Ticket; setPhase("playing"); } });
  const finishGame = useCallback((won: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (!ticket) return;
    const finalScore = scoreRef.current;
    if (won) {
      const nb = balance - ticket.price + ticket.prize;
      setBalance(nb); localStorage.setItem(BALANCE_KEY, String(nb));
      const b = parseInt(localStorage.getItem(BEST_KEY) || "0");
      if (finalScore > b) { setBest(finalScore); localStorage.setItem(BEST_KEY, String(finalScore)); }
    } else {
      setBalance(b2 => { const nb = Math.max(0, b2 - ticket.price); localStorage.setItem(BALANCE_KEY, String(nb)); return nb; });
    }
    setScoreDisp(finalScore); setPhase(won ? "won" : "lost");
  }, [ticket, balance]);

  const loadRound = useCallback(() => {
    roundRef.current++;
    const { nums: n, target: tg, op: o } = genRound(roundRef.current);
    setNums(n); setTarget(tg); setOp(o); setSelected(new Set());
  }, []);

  const handleSelect = useCallback((idx: number) => {
    if (feedbackRef.current || finishedRef.current) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) { next.delete(idx); return next; }
      if (op === "×" && next.size >= 2) return prev; // max 2 for multiply
      next.add(idx); return next;
    });
  }, [op]);

  // Evaluate selection
  useEffect(() => {
    if (phase !== "playing" || nums.length === 0 || feedback) return;
    const arr = [...selected].map(i => nums[i]);
    if (arr.length === 0) return;
    let val: number;
    if (op === "+") { val = arr.reduce((a, b) => a + b, 0); }
    else { val = arr.length < 2 ? 0 : arr[0] * arr[1]; }

    const correct = op === "+" ? (val === target && arr.length >= 2) : (arr.length === 2 && val === target);
    const tooHigh = op === "+" && val > target;

    if (correct) {
      feedbackRef.current = true;
      setFeedback("correct");
      scoreRef.current++;
      setScoreDisp(scoreRef.current);
      if (ticket && scoreRef.current >= ticket.target) {
        setTimeout(() => finishGame(true), 350);
      } else {
        setTimeout(() => { feedbackRef.current = false; setFeedback(null); loadRound(); }, 400);
      }
    } else if (tooHigh) {
      feedbackRef.current = true;
      setFeedback("wrong");
      setTimeout(() => { feedbackRef.current = false; setFeedback(null); setSelected(new Set()); }, 400);
    }
  }, [selected, nums, op, target, phase, feedback, ticket, finishGame, loadRound]);

  const startGamePlay = useCallback((t: Ticket) => {
    finishedRef.current = false; feedbackRef.current = false;
    scoreRef.current = 0; roundRef.current = 0;
    setScoreDisp(0); setTimeLeft(t.time); setFeedback(null); setSelected(new Set());
    const { nums: n, target: tg, op: o } = genRound(1);
    roundRef.current = 1;
    setNums(n); setTarget(tg); setOp(o);
    if (timerRef.current) clearInterval(timerRef.current);
    let rem = t.time;
    timerRef.current = setInterval(() => {
      rem--;
      setTimeLeft(rem);
      if (timerBarRef.current) {
        timerBarRef.current.style.width = `${(rem / t.time) * 100}%`;
        timerBarRef.current.style.background = rem <= 8 ? "linear-gradient(to right,#ef4444,#dc2626)" : "linear-gradient(to right,#3b82f6,#8b5cf6)";
      }
      if (rem <= 0) { clearInterval(timerRef.current!); finishGame(scoreRef.current >= t.target); }
    }, 1000);
  }, [finishGame]);

  useEffect(() => {
    const t = pendingTicketRef.current;
    if (phase === "playing" && t) { pendingTicketRef.current = null; startGamePlay(t); }
  }, [phase, startGamePlay]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const currentVal = (() => {
    if (selected.size === 0) return null;
    const arr = [...selected].map(i => nums[i]);
    return op === "+" ? arr.reduce((a, b) => a + b, 0) : arr.length === 2 ? arr[0] * arr[1] : null;
  })();

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{ background: "#050508" }}>
      <AnimatePresence mode="wait">
        {phase === "select" && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col px-6 pt-10 pb-6 overflow-y-auto" style={{ background: "rgba(5,5,8,0.97)" }}>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
              <Link href="/games"><button className="self-start mb-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-white/70" /></button></Link>
              <div className="text-4xl mb-2">🔢</div>
              <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-blue-400" /><span className="text-[11px] tracking-[0.4em] text-blue-400/60 uppercase">Quick Sum</span></div>
              <h1 className="font-display font-black text-2xl text-blue-300 mb-3">CHOOSE YOUR TICKET</h1>
              <p className="text-xs text-white/50 mb-4 max-w-[260px]">Tap numbers that add up to the target! Watch for × mode — find two numbers whose product matches instead!</p>
              <div className="flex items-center gap-2 mb-6 bg-white/5 rounded-full px-4 py-2"><Coins size={14} className="text-blue-400" /><span className="font-display font-bold text-white">{balance.toLocaleString()} SKZ</span></div>
              <div className="flex flex-col gap-3 w-full">
                {TICKETS.map(tk => (
                  <button key={tk.id} disabled={balance < tk.price} onClick={() => requestEntry(tk)}
                    className="flex items-center justify-between px-5 py-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">
                    <div className="text-left"><div className="font-display font-bold text-white text-base">{tk.name}</div><div className="text-xs text-white/40">SOLVE {tk.target} · {tk.time}S</div></div>
                    <div className="text-right"><div className="font-display font-bold text-blue-300 text-lg flex items-center gap-1"><Coins size={13} className="text-blue-400" />{tk.prize}</div><div className="text-xs text-white/40">ENTRY {tk.price}</div></div>
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
                <button onClick={requestExit} className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-blue-500/30 flex items-center justify-center text-blue-300"><ArrowLeft size={15}/></button>
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-blue-500/20"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-400 shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-[width] duration-300" style={{ width: `${ticket ? Math.min(100, (scoreDisp / ticket.target) * 100) : 0}%` }} /></div>
                  <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} className="h-full rounded-full bg-gradient-to-r from-blue-400 to-violet-400 transition-none" style={{ width: "100%" }} /></div>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-5 pt-16 pb-4 gap-4">
              <motion.div key={`${op}-badge`} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className={`px-3 py-1 rounded-full text-[10px] font-display tracking-widest uppercase font-bold ${op === "×" ? "bg-orange-500/20 border border-orange-400/40 text-orange-300" : "bg-blue-500/20 border border-blue-400/40 text-blue-300"}`}>
                {op === "+" ? "ADD  +" : "MULTIPLY  ×"}
              </motion.div>

              <motion.div key={target} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] text-white/25 font-display uppercase tracking-widest">Target</span>
                <div className={`font-display font-black text-[72px] leading-none transition-colors duration-150 ${feedback === "correct" ? "text-green-400 drop-shadow-[0_0_30px_rgba(74,222,128,0.7)]" : feedback === "wrong" ? "text-red-400" : "text-blue-200 drop-shadow-[0_0_25px_rgba(96,165,250,0.5)]"}`}>
                  {target}
                </div>
              </motion.div>

              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-5 py-2 min-w-[180px] justify-center">
                <span className="text-white/35 text-sm font-display">{op === "+" ? "Sum" : "Product"}:</span>
                <span className={`font-display font-bold text-xl ${currentVal === null ? "text-white/20" : currentVal === target ? "text-green-400" : op === "+" && currentVal > target ? "text-red-400" : "text-white"}`}>
                  {currentVal === null ? "—" : currentVal}
                </span>
              </div>

              <motion.div animate={{ opacity: feedback ? 0.75 : 1, scale: feedback === "wrong" ? 0.97 : 1 }} className="grid grid-cols-3 gap-2.5 w-full max-w-[290px]">
                {nums.map((n, i) => (
                  <motion.button key={`${i}-${n}-${roundRef.current}`} whileTap={{ scale: 0.88 }} onClick={() => handleSelect(i)}
                    className={`h-[72px] rounded-2xl text-3xl font-display font-black transition-all duration-150 ${
                      selected.has(i)
                        ? op === "×" ? "bg-orange-500/40 border-2 border-orange-400 text-orange-100 shadow-[0_0_18px_rgba(249,115,22,0.5)]"
                          : "bg-blue-500/40 border-2 border-blue-400 text-blue-100 shadow-[0_0_18px_rgba(59,130,246,0.5)]"
                        : "bg-white/6 border border-white/8 text-white/80 active:bg-white/14"
                    }`}>
                    {n}
                  </motion.button>
                ))}
              </motion.div>

              <div className="text-[10px] text-white/20 font-display tracking-widest uppercase">SOLVED {scoreDisp} / {ticket?.target}</div>
            </div>
          </motion.div>
        )}

        {(phase === "won" || phase === "lost") && ticket && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full px-6 gap-5">
            <div className="text-7xl">{phase === "won" ? "🔢" : "⏱️"}</div>
            <div className="text-center">
              <div className={`font-display font-black text-4xl uppercase ${phase === "won" ? "text-blue-400" : "text-red-400"}`}>{phase === "won" ? "BRILLIANT!" : "TIME'S UP!"}</div>
              <div className="text-white/60 text-sm mt-1">Solved: {scoreDisp} / {ticket.target}</div>
            </div>
            {phase === "won" ? (
              <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-500/20 border border-blue-500/40"><Coins size={16} className="text-blue-400" /><span className="font-display font-bold text-blue-300 text-lg">+{ticket.prize} SKZ</span></div>
            ) : <div className="text-white/40 text-sm">{gt[getLang()].gameEntryLost(ticket.price)}</div>}
            <div className="text-xs text-white/30 font-display">Balance: {balance.toLocaleString()} SKZ</div>
            {best > 0 && <div className="text-xs text-blue-400/50 font-display flex items-center gap-1"><Trophy size={11} />Best: {best}</div>}
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button onClick={() => { finishedRef.current = false; pendingTicketRef.current = ticket; setScoreDisp(0); setTimeLeft(ticket.time); setFeedback(null); setSelected(new Set()); setPhase("playing"); }}
                className="w-full py-3 rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-300 font-display font-bold tracking-wide text-sm flex items-center justify-center gap-2"><RotateCcw size={16} /> {gt[getLang()].gamePlayAgain}</button>
              <Link href="/games"><button className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-display font-bold tracking-wide text-sm">← BACK</button></Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {overlays}
    </div>
  );
}
