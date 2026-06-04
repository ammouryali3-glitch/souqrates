import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle } from "lucide-react";
import ArenaShell from "@/components/arena-shell";

const GAME_ID = "geniusgrid";
const COLOR = "#cc88ff";
const ENTRY_FEE = 180;

const SYMS = ["🌟","💎","🔥","❄️"];

// Solution: 4x4 grid, each row/col has each symbol exactly once
// [row][col]: 0=🌟 1=💎 2=🔥 3=❄️
const SOLUTION = [
  [0,1,2,3],
  [2,3,0,1],
  [3,0,1,2],
  [1,2,3,0],
];

// Given cells (prefilled): -1 = empty
const GIVEN: number[][] = [
  [0,-1,-1,3],
  [2,-1,0,-1],
  [-1,0,-1,2],
  [-1,2,3,-1],
];

interface GameProps { onComplete: (score: number, timeSec: number) => void; }

function GeniusGrid({ onComplete }: GameProps) {
  const [grid, setGrid] = useState<number[][]>(GIVEN.map(r => [...r]));
  const [selected, setSelected] = useState<[number,number] | null>(null);
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [wrongCount, setWrongCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const startRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wrongRef = useRef(0);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function isGiven(r: number, c: number) { return GIVEN[r][c] !== -1; }

  function place(sym: number) {
    if (!selected || done) return;
    const [r, c] = selected;
    if (isGiven(r, c)) return;
    const next = grid.map(row => [...row]);
    next[r][c] = sym;
    // Validate
    const newErrors = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const rowNums = next[i].filter(v => v !== -1);
      if (new Set(rowNums).size < rowNums.length) for (let j = 0; j < 4; j++) if (next[i][j] !== -1) newErrors.add(`${i},${j}`);
      const colNums = next.map(row => row[i]).filter(v => v !== -1);
      if (new Set(colNums).size < colNums.length) for (let j = 0; j < 4; j++) if (next[j][i] !== -1) newErrors.add(`${j},${i}`);
    }
    // Wrong placement detection
    if (SOLUTION[r][c] !== sym && sym !== -1) {
      wrongRef.current++;
      setWrongCount(wrongRef.current);
      newErrors.add(`${r},${c}`);
    }
    setErrors(newErrors);
    setGrid(next);
    // Check win
    const complete = next.every((row, ri) => row.every((v, ci) => v === SOLUTION[ri][ci]));
    if (complete) {
      if (timerRef.current) clearInterval(timerRef.current);
      const timeSec = Math.floor((Date.now() - startRef.current) / 1000);
      const score = Math.max(100, 1000 - Math.floor(timeSec * 4) - wrongRef.current * 80);
      setDone(true);
      setSelected(null);
      setTimeout(() => onComplete(score, timeSec), 700);
    }
  }

  function clearCell() {
    if (!selected || done) return;
    const [r,c] = selected;
    if (isGiven(r,c)) return;
    const next = grid.map(row => [...row]); next[r][c] = -1; setGrid(next);
  }

  const m = Math.floor(elapsed / 60), s = elapsed % 60;
  const filled = grid.flat().filter(v => v !== -1).length;

  return (
    <div className="flex flex-col h-full" style={{ background: "#0a0015" }}>
      {/* HUD */}
      <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ background: "rgba(10,0,21,0.95)" }}>
        <div className="font-display font-black text-purple-300 text-base uppercase">🧠 Genius Grid</div>
        <div className="flex items-center gap-3 text-xs font-display">
          <span className="text-red-400/80">✗ {wrongCount} errors</span>
          <span className="text-purple-300">{m}:{String(s).padStart(2,"0")}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4 pb-4">
        {/* Rules */}
        <div className="w-full max-w-[320px] text-xs text-white/40 font-display text-center">
          Each row &amp; column must contain all 4 symbols exactly once · No repeats
        </div>

        {/* Symbol legend */}
        <div className="flex items-center gap-4">
          {SYMS.map((s2, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <span className="text-xl">{s2}</span>
              <span className="text-[9px] text-white/20 font-display">{["A","B","C","D"][i]}</span>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-4 gap-2 w-full max-w-[300px]">
          {grid.map((row, r) => row.map((val, c) => {
            const sel = selected?.[0] === r && selected?.[1] === c;
            const given = isGiven(r, c);
            const hasErr = errors.has(`${r},${c}`);
            return (
              <motion.button key={`${r},${c}`} whileTap={!given ? { scale: 0.92 } : {}}
                onClick={() => !given && setSelected([r,c])}
                className={`h-[66px] rounded-2xl flex items-center justify-center text-2xl border-2 transition-all
                  ${given ? "border-purple-500/40 bg-purple-500/15" : sel ? "border-purple-400 bg-purple-400/20" : hasErr ? "border-red-500/60 bg-red-900/20" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                style={sel ? { boxShadow: "0 0 16px #cc88ff66" } : given ? { boxShadow: "0 0 8px #cc88ff22" } : {}}>
                {val !== -1 ? SYMS[val] : sel ? <span className="text-purple-400/40 text-sm font-display">tap</span> : ""}
              </motion.button>
            );
          }))}
        </div>

        {/* Symbol Picker */}
        <AnimatePresence>
          {selected && !done && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-3">
              {SYMS.map((sym, i) => (
                <motion.button key={i} whileTap={{ scale: 0.85 }} onClick={() => place(i)}
                  className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl hover:bg-purple-500/20 hover:border-purple-400/40 transition-all">
                  {sym}
                </motion.button>
              ))}
              <motion.button whileTap={{ scale: 0.85 }} onClick={clearCell}
                className="w-14 h-14 rounded-2xl bg-red-900/20 border border-red-500/30 flex items-center justify-center text-white/40 text-sm font-display hover:bg-red-900/30 transition-all">
                ✕
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-xs text-white/20 font-display">{filled}/16 cells filled</div>

        {done && (
          <div className="flex items-center gap-2 text-green-400 font-display font-bold animate-pulse">
            <CheckCircle size={20} />Grid solved!
          </div>
        )}
      </div>
    </div>
  );
}

export default function GeniusGridPage() {
  return (
    <ArenaShell gameId={GAME_ID} title="Genius Grid" subtitle="Daily · Logic" icon="🧠" color={COLOR}
      entryFee={ENTRY_FEE} period="daily"
      description="Fill the 4×4 grid so every row and column has each symbol exactly once. No errors + fastest time = leaderboard domination.">
      {({ onComplete }) => <GeniusGrid onComplete={onComplete} />}
    </ArenaShell>
  );
}
