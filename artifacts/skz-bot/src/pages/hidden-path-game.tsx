import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ArenaShell from "@/components/arena-shell";

const GAME_ID = "hiddenpath";
const COLOR = "#4dff91";
const ENTRY_FEE = 175;

const GRID = 7;
// Hidden path: set of [row, col] that form the correct path from (0,0) to (6,6)
const PATH_SET = new Set(["0,0","0,1","0,2","1,2","2,2","2,3","2,4","3,4","4,4","4,5","5,5","5,6","6,6"]);
const START = "0,0", END = "6,6";

type CellState = "hidden" | "correct" | "wrong";

interface GameProps { onComplete: (score: number, timeSec: number) => void; }

function HiddenPathGame({ onComplete }: GameProps) {
  const [cells, setCells] = useState<CellState[][]>(
    Array(GRID).fill(null).map(() => Array(GRID).fill("hidden"))
  );
  const [wrongTaps, setWrongTaps] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [flashCell, setFlashCell] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const startRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wrongRef = useRef(0);
  const penaltyRef = useRef(0);

  useEffect(() => {
    // Reveal start/end
    setCells(prev => {
      const next = prev.map(r => [...r]);
      next[0][0] = "correct"; next[6][6] = "correct";
      return next;
    });
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function tap(r: number, c: number) {
    if (done) return;
    const key = `${r},${c}`;
    if (cells[r][c] !== "hidden") return;
    const isPath = PATH_SET.has(key);
    setFlashCell(key);
    setTimeout(() => setFlashCell(null), 400);
    setCells(prev => {
      const next = prev.map(row => [...row]);
      next[r][c] = isPath ? "correct" : "wrong";
      return next;
    });
    if (!isPath) {
      wrongRef.current++;
      penaltyRef.current += 5;
      setWrongTaps(wrongRef.current);
      setPenalty(penaltyRef.current);
    } else {
      // Check win
      const allPathRevealed = [...PATH_SET].every(k => {
        const [pr, pc] = k.split(",").map(Number);
        return cells[pr][pc] === "correct" || (pr === r && pc === c);
      });
      if (allPathRevealed) {
        if (timerRef.current) clearInterval(timerRef.current);
        const timeSec = Math.floor((Date.now() - startRef.current) / 1000) + penaltyRef.current;
        const score = Math.max(100, 1000 - wrongRef.current * 80 - Math.floor(timeSec * 1.5));
        setDone(true);
        setTimeout(() => onComplete(score, timeSec), 600);
      }
    }
  }

  const m = Math.floor(elapsed / 60), s = elapsed % 60;
  const pathFound = [...PATH_SET].filter(k => { const [r,c]=k.split(",").map(Number); return cells[r][c]==="correct"; }).length;

  return (
    <div className="flex flex-col h-full" style={{ background: "#010f06" }}>
      {/* HUD */}
      <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ background: "rgba(1,15,6,0.95)" }}>
        <div className="font-display font-black text-green-300 text-base uppercase">🗺️ Hidden Path</div>
        <div className="flex items-center gap-3 text-xs font-display">
          <span className="text-red-400">✗ {wrongTaps} wrong (+{penalty}s)</span>
          <span className="text-green-300">{m}:{String(s).padStart(2,"0")}</span>
        </div>
      </div>

      {/* Info */}
      <div className="px-4 pt-2 pb-3 shrink-0">
        <div className="px-4 py-3 rounded-2xl border border-green-500/20 bg-green-900/10 text-xs text-white/60 leading-relaxed">
          A hidden path leads from <span className="text-green-300 font-bold">START →</span> to <span className="text-green-300 font-bold">END ●</span>.
          Tap cells to reveal them. <span className="text-green-300">Green = on path</span>, <span className="text-red-400">Red = wrong (+5s penalty)</span>. Find all path cells to win!
        </div>
        <div className="mt-2 text-xs text-white/30 font-display text-center">
          Path cells found: {pathFound}/{PATH_SET.size} · {wrongTaps} wrong taps
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 flex items-center justify-center px-3 pb-4">
        <div className="grid gap-1.5 w-full max-w-[340px]" style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)` }}>
          {Array.from({ length: GRID }, (_, r) =>
            Array.from({ length: GRID }, (_, c) => {
              const key = `${r},${c}`;
              const state = cells[r][c];
              const isStart = key === START, isEnd = key === END;
              const isFlash = flashCell === key;
              return (
                <motion.button key={key} onClick={() => tap(r, c)}
                  animate={isFlash ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-display font-black transition-all
                    ${state === "correct" ? "bg-green-500/40 border-green-400 border" : state === "wrong" ? "bg-red-500/20 border-red-500/50 border" : isStart || isEnd ? "border-2" : "bg-white/5 border border-white/10 hover:bg-white/10"}`}
                  style={state === "correct" ? { boxShadow: "0 0 10px #4dff9144" } : state === "wrong" ? { boxShadow: "0 0 8px #ff444444" } : {}}>
                  {isStart && state !== "correct" ? <span className="text-green-400">S</span> :
                    isEnd && state !== "correct" ? <span className="text-green-400">E</span> :
                    state === "correct" ? <span className="text-green-300">✓</span> :
                    state === "wrong" ? <span className="text-red-400">✗</span> : ""}
                </motion.button>
              );
            })
          )}
        </div>
      </div>

      {done && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(1,15,6,0.9)" }}>
          <div className="text-center">
            <div className="text-6xl mb-3">🗺️</div>
            <div className="font-display font-black text-3xl text-green-400">PATH FOUND!</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HiddenPathPage() {
  return (
    <ArenaShell gameId={GAME_ID} title="Hidden Path" subtitle="Weekly · Puzzle" icon="🗺️" color={COLOR}
      entryFee={ENTRY_FEE} period="weekly"
      description="A hidden path is embedded in a 7×7 grid. Tap cells to find it — wrong taps cost +5 seconds. Fewest mistakes + fastest time wins.">
      {({ onComplete }) => <HiddenPathGame onComplete={onComplete} />}
    </ArenaShell>
  );
}
