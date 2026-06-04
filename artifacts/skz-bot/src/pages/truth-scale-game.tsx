import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ArenaShell from "@/components/arena-shell";

const GAME_ID = "truthscale";
const COLOR = "#ffd700";
const ENTRY_FEE = 200;

interface Question {
  q: string;
  choices: string[];
  answer: number;
  explanation: string;
}

const QUESTIONS: Question[] = [
  { q: "Alex is taller than Bob. Bob is taller than Carl. Who is the shortest?", choices: ["Alex","Bob","Carl","Cannot determine"], answer: 2, explanation: "Carl < Bob < Alex, so Carl is shortest." },
  { q: "A train travels 60 km/h for 2 hours, then 80 km/h for 1 hour. What is the total distance?", choices: ["180 km","200 km","160 km","220 km"], answer: 1, explanation: "60×2 + 80×1 = 120 + 80 = 200 km" },
  { q: "Every Zapper is a Widget. Some Widgets can fly. Can we conclude all Zappers can fly?", choices: ["Yes, always","No, not necessarily","Only some Zappers","It depends"], answer: 1, explanation: "We only know some Widgets fly — Zappers may be in the non-flying subset." },
  { q: "Sara has twice as many coins as Tom. Tom has 8. Sara gives 3 to Tom. Who has more now?", choices: ["Sara","Tom","They're equal","Cannot determine"], answer: 0, explanation: "Sara: 16−3=13, Tom: 8+3=11. Sara still has more." },
  { q: "What comes next? 1, 4, 9, 16, __", choices: ["20","24","25","36"], answer: 2, explanation: "Pattern: 1², 2², 3², 4², 5² = 25" },
  { q: "The red house is directly left of the blue house. The yellow house is directly right of the blue house. Which is in the middle?", choices: ["Red","Blue","Yellow","Cannot determine"], answer: 1, explanation: "Red — Blue — Yellow. Blue is in the middle." },
  { q: "If no Flurps are Blargs, and all Blargs are Crumps, can any Flurp be a Crump?", choices: ["No, never","Yes, it's possible","Only half","All Flurps are Crumps"], answer: 1, explanation: "Crumps may extend beyond Blargs, so Flurps could still be Crumps." },
  { q: "A clock shows 3:15. What is the angle between the hour and minute hand?", choices: ["0°","7.5°","15°","22.5°"], answer: 1, explanation: "At 3:15, minute=90°, hour=97.5°. Difference = 7.5°" },
];

interface GameProps { onComplete: (score: number, timeSec: number) => void; }

function TruthScaleGame({ onComplete }: GameProps) {
  const [current, setCurrent] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [penalties, setPenalties] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);
  const startRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wrongRef = useRef(0);
  const penaltyRef = useRef(0);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function choose(idx: number) {
    if (chosen !== null || done) return;
    setChosen(idx);
    setShowResult(true);
    const q = QUESTIONS[current];
    if (idx === q.answer) {
      setCorrect(c => c + 1);
    } else {
      wrongRef.current++;
      penaltyRef.current += 15;
      setPenalties(penaltyRef.current);
      setWrongFlash(true);
      setTimeout(() => setWrongFlash(false), 600);
    }
  }

  function next() {
    if (current + 1 >= QUESTIONS.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      const timeSec = Math.floor((Date.now() - startRef.current) / 1000) + penaltyRef.current;
      const score = Math.max(100, 1000 - Math.floor(timeSec * 3) - wrongRef.current * 80);
      setDone(true);
      setTimeout(() => onComplete(score, timeSec), 400);
    } else {
      setCurrent(c => c + 1);
      setChosen(null);
      setShowResult(false);
    }
  }

  const m = Math.floor(elapsed / 60), s = elapsed % 60;
  const q = QUESTIONS[current];
  const progress = ((current) / QUESTIONS.length) * 100;

  return (
    <div className={`flex flex-col h-full transition-colors duration-300 ${wrongFlash ? "bg-red-950" : ""}`} style={{ background: wrongFlash ? "#1a0000" : "#0c0800" }}>
      {/* HUD */}
      <div className="px-4 py-3 shrink-0" style={{ background: "rgba(12,8,0,0.95)" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="font-display font-black text-yellow-300 text-base uppercase">⚖️ Truth Scale</div>
          <div className="flex items-center gap-3 text-xs font-display">
            {penalties > 0 && <span className="text-red-400">+{penalties}s penalty</span>}
            <span className="text-yellow-300">{m}:{String(s).padStart(2,"0")}</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-yellow-400 transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-white/30 font-display shrink-0">{current}/{QUESTIONS.length}</span>
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col px-4 pb-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div key={current} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
            className="flex flex-col gap-4 pt-4">
            <div className="px-5 py-5 rounded-3xl border border-yellow-500/20 bg-yellow-900/10">
              <div className="text-[10px] text-yellow-400/60 font-display uppercase tracking-widest mb-2">Question {current + 1} of {QUESTIONS.length}</div>
              <p className="text-white font-display font-bold text-base leading-relaxed">{q.q}</p>
            </div>

            <div className="flex flex-col gap-2.5">
              {q.choices.map((choice, i) => {
                const isChosen = chosen === i;
                const isCorrect = i === q.answer;
                const showState = showResult;
                return (
                  <motion.button key={i} whileTap={chosen === null ? { scale: 0.97 } : {}}
                    onClick={() => choose(i)}
                    className={`w-full text-left px-5 py-4 rounded-2xl border font-display font-bold text-sm transition-all
                      ${showState && isCorrect ? "border-green-400 bg-green-900/30 text-green-300" :
                        showState && isChosen && !isCorrect ? "border-red-500 bg-red-900/30 text-red-300" :
                        isChosen ? "border-yellow-400 bg-yellow-900/20 text-yellow-300" :
                        "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0
                        ${showState && isCorrect ? "bg-green-500 text-white" : showState && isChosen && !isCorrect ? "bg-red-500 text-white" : "bg-white/10 text-white/40"}`}>
                        {["A","B","C","D"][i]}
                      </div>
                      {choice}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {showResult && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`px-4 py-3 rounded-2xl border text-xs font-display leading-relaxed ${chosen === q.answer ? "border-green-500/30 bg-green-900/15 text-green-300" : "border-red-500/30 bg-red-900/15 text-red-300"}`}>
                <div className="font-bold mb-1">{chosen === q.answer ? "✓ Correct!" : `✗ Wrong! (+15s penalty)`}</div>
                <div className="text-white/50">{q.explanation}</div>
              </motion.div>
            )}

            {showResult && (
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileTap={{ scale: 0.97 }}
                onClick={next}
                className="w-full py-4 rounded-2xl font-display font-black text-base tracking-widest uppercase"
                style={{ background: "linear-gradient(135deg, #ffd700, #ff9900)", color: "#000", boxShadow: "0 0 25px #ffd70044" }}>
                {current + 1 >= QUESTIONS.length ? "⚖️ Final Submit" : "Next Question →"}
              </motion.button>
            )}

            {!showResult && (
              <div className="flex items-center gap-2 mt-1">
                {[...Array(QUESTIONS.length)].map((_,i) => (
                  <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i < current ? "bg-yellow-400" : i === current ? "bg-yellow-400/50" : "bg-white/10"}`} />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function TruthScalePage() {
  return (
    <ArenaShell gameId={GAME_ID} title="Truth Scale" subtitle="Weekly · Logic Chain" icon="⚖️" color={COLOR}
      entryFee={ENTRY_FEE} period="weekly"
      description="8 logic puzzles in sequence — math, deduction, patterns. Wrong answer = +15s penalty. Fastest correct solver claims the weekly prize pool.">
      {({ onComplete }) => <TruthScaleGame onComplete={onComplete} />}
    </ArenaShell>
  );
}
