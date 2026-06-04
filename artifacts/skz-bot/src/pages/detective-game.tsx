import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import ArenaShell from "@/components/arena-shell";

const GAME_ID = "detective";
const COLOR = "#ff9f1c";
const ENTRY_FEE = 200;

const CLUES = [
  { id: 0, icon: "📸", title: "Security Footage", content: "The butler was seen near the kitchen corridor at 9:45 PM, far from the study. He left the estate entirely by 10 PM." },
  { id: 1, icon: "📝", title: "Witness Statement", content: "The victim's niece, Elara, was overheard arguing with Sir Edmund about the inheritance will at 9 PM in the study." },
  { id: 2, icon: "🔬", title: "Lab Report", content: "The autopsy confirms death by slow-acting poison mixed into a drink. Time of death: between 10 PM and 11 PM." },
  { id: 3, icon: "📋", title: "Insurance Document", content: "A life insurance policy worth 2 million was found — the sole beneficiary is Victor Crane, the business partner." },
  { id: 4, icon: "👆", title: "Fingerprint Analysis", content: "Dr. Harlow's fingerprints appear on the wine decanter. The decanter was wiped, but a partial print remained near the base." },
];

const SUSPECTS = [
  { id: "butler", name: "James (Butler)", icon: "🤵", motive: "Long grudge over unpaid wages" },
  { id: "niece", name: "Elara (Niece)", icon: "👩", motive: "Fought over inheritance will" },
  { id: "doctor", name: "Dr. Harlow", icon: "👨‍⚕️", motive: "Owed money; had medical expertise" },
  { id: "partner", name: "Victor Crane", icon: "💼", motive: "Life insurance beneficiary" },
];

const LOCATIONS = ["The Study", "The Kitchen", "The Garden", "The Library"];
const WEAPONS = ["Revolver", "Poison", "Candlestick", "Knife"];

const ANSWER = { suspect: "partner", location: "The Library", weapon: "Poison" };

interface GameProps { onComplete: (score: number, timeSec: number) => void; }

function DetectiveGame({ onComplete }: GameProps) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [openClue, setOpenClue] = useState<number | null>(null);
  const [phase, setPhase] = useState<"clues" | "solve" | "wrong">("clues");
  const [suspect, setSuspect] = useState("");
  const [location, setLocation] = useState("");
  const [weapon, setWeapon] = useState("");
  const [wrongAns, setWrongAns] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function revealClue(id: number) {
    if (revealed.has(id)) { setOpenClue(id); return; }
    setRevealed(prev => new Set([...prev, id]));
    setOpenClue(id);
  }

  function handleSolve() {
    if (!suspect || !location || !weapon) return;
    if (suspect === ANSWER.suspect && location === ANSWER.location && weapon === ANSWER.weapon) {
      if (timerRef.current) clearInterval(timerRef.current);
      const timeSec = Math.floor((Date.now() - startRef.current) / 1000);
      const score = Math.max(100, 1000 - revealed.size * 60 - Math.floor(timeSec * 1.5));
      onComplete(score, timeSec);
    } else {
      setWrongAns(true);
      setTimeout(() => setWrongAns(false), 1200);
    }
  }

  const m = Math.floor(elapsed / 60), s = elapsed % 60;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#0c0800" }}>
      {/* HUD */}
      <div className="sticky top-0 z-20 px-4 py-3 flex items-center justify-between" style={{ background: "rgba(12,8,0,0.95)", backdropFilter: "blur(8px)" }}>
        <div className="font-display font-black text-white text-base uppercase">🔍 The Detective</div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-display text-orange-400/70 flex items-center gap-1">
            <Eye size={12} />{revealed.size}/5 clues
          </div>
          <div className="font-display font-bold text-orange-300 text-sm">{m}:{String(s).padStart(2,"0")}</div>
        </div>
      </div>

      {/* Case Brief */}
      <div className="mx-4 mt-2 mb-4 p-4 rounded-2xl border border-orange-500/20 bg-orange-900/10">
        <div className="text-xs text-orange-400/60 font-display uppercase tracking-widest mb-1">Case #47-SKZ</div>
        <p className="text-sm text-white/80 leading-relaxed">
          <span className="font-bold text-orange-300">Sir Edmund</span> was found dead in his mansion. Death occurred between 10–11 PM.
          You have access to {5 - revealed.size} sealed evidence files. Reveal clues carefully — each one costs time.
          Identify the <span className="text-orange-300 font-bold">suspect, location, and weapon</span>.
        </p>
      </div>

      {/* Clue Cards */}
      <div className="px-4 mb-4">
        <div className="text-xs text-white/30 font-display uppercase tracking-widest mb-2">Evidence Files</div>
        <div className="flex flex-col gap-2">
          {CLUES.map(c => (
            <motion.button key={c.id} whileTap={{ scale: 0.98 }} onClick={() => revealClue(c.id)}
              className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${revealed.has(c.id) ? "border-orange-500/30 bg-orange-900/15" : "border-white/10 bg-white/5 hover:bg-white/8"}`}>
              <div className="text-2xl">{revealed.has(c.id) ? c.icon : "📁"}</div>
              <div className="flex-1">
                <div className={`font-display font-bold text-sm ${revealed.has(c.id) ? "text-orange-300" : "text-white/40"}`}>{c.title}</div>
                <div className="text-xs text-white/30 font-display">{revealed.has(c.id) ? "Evidence revealed" : "Tap to open — costs 60 pts"}</div>
              </div>
              {revealed.has(c.id) ? <CheckCircle size={16} className="text-orange-400 shrink-0" /> : <EyeOff size={16} className="text-white/20 shrink-0" />}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Solve Section */}
      <div className="px-4 mb-8">
        <div className="text-xs text-white/30 font-display uppercase tracking-widest mb-3">Make Your Accusation</div>
        {/* Suspect */}
        <div className="mb-3">
          <div className="text-xs text-orange-400/60 font-display mb-1.5">Suspect</div>
          <div className="grid grid-cols-2 gap-2">
            {SUSPECTS.map(s => (
              <button key={s.id} onClick={() => setSuspect(s.id)}
                className={`p-2.5 rounded-xl border text-left transition-all ${suspect === s.id ? "border-orange-400 bg-orange-400/20" : "border-white/10 bg-white/5"}`}>
                <div className="text-lg">{s.icon}</div>
                <div className="text-xs font-display font-bold text-white">{s.name}</div>
              </button>
            ))}
          </div>
        </div>
        {/* Location */}
        <div className="mb-3">
          <div className="text-xs text-orange-400/60 font-display mb-1.5">Location</div>
          <div className="grid grid-cols-2 gap-2">
            {LOCATIONS.map(l => (
              <button key={l} onClick={() => setLocation(l)}
                className={`p-2.5 rounded-xl border text-center text-xs font-display font-bold transition-all ${location === l ? "border-orange-400 bg-orange-400/20 text-orange-300" : "border-white/10 bg-white/5 text-white/60"}`}>{l}</button>
            ))}
          </div>
        </div>
        {/* Weapon */}
        <div className="mb-4">
          <div className="text-xs text-orange-400/60 font-display mb-1.5">Method</div>
          <div className="grid grid-cols-2 gap-2">
            {WEAPONS.map(w => (
              <button key={w} onClick={() => setWeapon(w)}
                className={`p-2.5 rounded-xl border text-center text-xs font-display font-bold transition-all ${weapon === w ? "border-orange-400 bg-orange-400/20 text-orange-300" : "border-white/10 bg-white/5 text-white/60"}`}>{w}</button>
            ))}
          </div>
        </div>

        <motion.button whileTap={{ scale: 0.97 }}
          disabled={!suspect || !location || !weapon}
          onClick={handleSolve}
          animate={wrongAns ? { x: [-6, 6, -6, 6, 0] } : { x: 0 }}
          className={`w-full py-4 rounded-2xl font-display font-black text-base tracking-widest uppercase flex items-center justify-center gap-2 disabled:opacity-30 transition-all ${wrongAns ? "border-red-500 bg-red-500/20 text-red-300" : ""}`}
          style={!wrongAns ? { background: "linear-gradient(135deg, #ff9f1c, #ff6b2b)", color: "#000", boxShadow: "0 0 25px #ff9f1c44" } : {}}>
          {wrongAns ? <><AlertCircle size={18} /> Wrong! Try again</> : "⚖️ Accuse!"}
        </motion.button>
      </div>

      {/* Clue Modal */}
      <AnimatePresence>
        {openClue !== null && (
          <motion.div key="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
            onClick={() => setOpenClue(null)}>
            <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-[360px] rounded-3xl border border-orange-500/30 p-6 mb-4"
              style={{ background: "#140a00" }}>
              <div className="text-3xl mb-2">{CLUES[openClue].icon}</div>
              <div className="font-display font-black text-orange-300 text-lg mb-2">{CLUES[openClue].title}</div>
              <p className="text-sm text-white/80 leading-relaxed">{CLUES[openClue].content}</p>
              <button onClick={() => setOpenClue(null)}
                className="mt-4 w-full py-2.5 rounded-xl border border-orange-500/30 text-orange-400 font-display text-sm">Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DetectiveGamePage() {
  return (
    <ArenaShell gameId={GAME_ID} title="The Detective" subtitle="Weekly · Mystery" icon="🔍" color={COLOR}
      entryFee={ENTRY_FEE} period="weekly"
      description="One case per week. Reveal clues carefully — each one costs points. Solve fastest with fewest hints to lead the board.">
      {({ onComplete }) => <DetectiveGame onComplete={onComplete} />}
    </ArenaShell>
  );
}
