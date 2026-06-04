import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle } from "lucide-react";
import ArenaShell from "@/components/arena-shell";

const GAME_ID = "cipher";
const COLOR = "#00d4ff";
const ENTRY_FEE = 150;

// Today's cipher: Caesar shift 3 (A→D, B→E, etc.)
// Encoded words to decode
const CIPHER_PAIRS: { encoded: string; decoded: string; hint: string }[] = [
  { encoded: "VHFUHW", decoded: "SECRET", hint: "Something hidden" },
  { encoded: "PHVVDJH", decoded: "MESSAGE", hint: "A communication" },
  { encoded: "HQFRGHG", decoded: "ENCODED", hint: "Scrambled text" },
  { encoded: "FLSKHU", decoded: "CIPHER", hint: "Type of code" },
  { encoded: "YLFWRU", decoded: "VICTOR", hint: "One who wins" },
  { encoded: "VKDGRZ", decoded: "SHADOW", hint: "Dark silhouette" },
  { encoded: "PLVVLRQ", decoded: "MISSION", hint: "An objective" },
];

interface GameProps { onComplete: (score: number, timeSec: number) => void; }

function CipherGame({ onComplete }: GameProps) {
  const [answers, setAnswers] = useState<string[]>(Array(CIPHER_PAIRS.length).fill(""));
  const [submitted, setSubmitted] = useState<(boolean | null)[]>(Array(CIPHER_PAIRS.length).fill(null));
  const [allDone, setAllDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showKey, setShowKey] = useState(true);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function checkAll() {
    const results = CIPHER_PAIRS.map((p, i) => answers[i].trim().toUpperCase() === p.decoded);
    setSubmitted(results);
    const correct = results.filter(Boolean).length;
    if (correct === CIPHER_PAIRS.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      const timeSec = Math.floor((Date.now() - startRef.current) / 1000);
      const score = Math.max(100, 1000 - Math.floor(timeSec * 3));
      setAllDone(true);
      setTimeout(() => onComplete(score, timeSec), 800);
    }
  }

  const m = Math.floor(elapsed / 60), s = elapsed % 60;
  const correct = submitted.filter(x => x === true).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#00080f" }}>
      {/* HUD */}
      <div className="sticky top-0 z-20 px-4 py-3 flex items-center justify-between" style={{ background: "rgba(0,8,15,0.95)", backdropFilter: "blur(8px)" }}>
        <div className="font-display font-black text-cyan-300 text-base uppercase">🧩 Cipher Rush</div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-display text-cyan-400/70">{correct}/{CIPHER_PAIRS.length} solved</div>
          <div className="font-display font-bold text-cyan-300 text-sm">{m}:{String(s).padStart(2,"0")}</div>
        </div>
      </div>

      {/* Cipher Key */}
      <div className="mx-4 mt-2 mb-3 rounded-2xl border border-cyan-500/20 overflow-hidden">
        <button onClick={() => setShowKey(k => !k)}
          className="w-full px-4 py-3 flex items-center justify-between bg-cyan-900/15 text-left">
          <div className="font-display font-bold text-cyan-300 text-sm">🔑 Cipher Key (Caesar +3)</div>
          <span className="text-xs text-cyan-400/60">{showKey ? "Hide" : "Show"}</span>
        </button>
        {showKey && (
          <div className="px-3 py-3 grid grid-cols-7 gap-1">
            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((ch, i) => {
              const enc = String.fromCharCode(((ch.charCodeAt(0) - 65 + 3) % 26) + 65);
              return (
                <div key={i} className="flex flex-col items-center">
                  <div className="text-[10px] text-cyan-400 font-display font-bold">{ch}</div>
                  <div className="text-[8px] text-white/30 font-display">↓</div>
                  <div className="text-[10px] text-white/50 font-display">{enc}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Instruction */}
      <div className="mx-4 mb-4 px-4 py-3 rounded-2xl bg-white/5 border border-white/10">
        <p className="text-xs text-white/50 leading-relaxed">
          Each word below is encoded with <span className="text-cyan-300 font-bold">Caesar Cipher (+3 shift)</span>. 
          Type the decoded word for each. Hints are there if needed — but speed matters!
        </p>
      </div>

      {/* Words */}
      <div className="px-4 flex flex-col gap-3 mb-6">
        {CIPHER_PAIRS.map((pair, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`p-4 rounded-2xl border transition-all ${submitted[i] === true ? "border-green-500/40 bg-green-900/15" : submitted[i] === false ? "border-red-500/40 bg-red-900/15" : "border-white/10 bg-white/5"}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-display font-black text-xl tracking-[0.25em]" style={{ color: COLOR, fontFamily: "monospace" }}>{pair.encoded}</div>
              {submitted[i] === true && <CheckCircle size={18} className="text-green-400" />}
              {submitted[i] === false && <XCircle size={18} className="text-red-400" />}
            </div>
            <div className="text-xs text-white/30 font-display mb-2">Hint: {pair.hint}</div>
            <input
              type="text"
              value={answers[i]}
              onChange={e => {
                const next = [...answers]; next[i] = e.target.value.toUpperCase(); setAnswers(next);
                const next2 = [...submitted]; next2[i] = null; setSubmitted(next2);
              }}
              disabled={submitted[i] === true}
              placeholder="Type decoded word..."
              className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 font-display font-bold text-white text-sm tracking-widest uppercase placeholder:text-white/20 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
            />
          </motion.div>
        ))}
      </div>

      <div className="px-4 mb-8">
        <motion.button whileTap={{ scale: 0.97 }} onClick={checkAll} disabled={allDone || answers.some(a => !a.trim())}
          className="w-full py-4 rounded-2xl font-display font-black text-base tracking-widest uppercase disabled:opacity-30"
          style={{ background: "linear-gradient(135deg, #00d4ff, #0080cc)", color: "#000", boxShadow: "0 0 25px #00d4ff44" }}>
          {allDone ? "✓ Submitted!" : "🔓 Decode & Submit"}
        </motion.button>
        <div className="text-center text-xs text-white/20 mt-2 font-display">All 7 must be correct to submit</div>
      </div>
    </div>
  );
}

export default function CipherRushPage() {
  return (
    <ArenaShell gameId={GAME_ID} title="Cipher Rush" subtitle="Daily · Code Breaking" icon="🧩" color={COLOR}
      entryFee={ENTRY_FEE} period="daily"
      description="A new cipher is published every day. Decode all 7 words using the cipher key. Fastest correct solver takes the daily prize pool.">
      {({ onComplete }) => <CipherGame onComplete={onComplete} />}
    </ArenaShell>
  );
}
