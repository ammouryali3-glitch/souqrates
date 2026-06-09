import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, RotateCcw, Loader2, ChevronRight, Star } from "lucide-react";
import { useLang, t } from "@/lib/i18n";
import {
  WHEEL_PRIZES, useWheelStatus, refreshWheelStatus, spinWheel, openLootBox,
  type SpinResult, type BoxResult, type Prize,
} from "@/lib/wheel";
import { hapticSuccess, hapticError, hapticImpact } from "@/lib/haptics";
import { sfx } from "@/lib/sound";

// ── Wheel SVG ─────────────────────────────────────────────────────────────────

const CX = 150, CY = 150, R_OUTER = 140, R_INNER = 38;
const N = WHEEL_PRIZES.length;
const SEG_DEG = 360 / N;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function segPath(i: number): string {
  const s = polar(CX, CY, R_OUTER, i * SEG_DEG);
  const e = polar(CX, CY, R_OUTER, (i + 1) * SEG_DEG);
  const si = polar(CX, CY, R_INNER, i * SEG_DEG);
  const ei = polar(CX, CY, R_INNER, (i + 1) * SEG_DEG);
  return `M ${si.x} ${si.y} L ${s.x} ${s.y} A ${R_OUTER} ${R_OUTER} 0 0 1 ${e.x} ${e.y} L ${ei.x} ${ei.y} A ${R_INNER} ${R_INNER} 0 0 0 ${si.x} ${si.y} Z`;
}

function WheelSVG({ rotation, spinning }: { rotation: number; spinning: boolean }) {
  return (
    <div className="relative select-none" style={{ width: 280, height: 280 }}>
      {/* Pointer */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-10"
        style={{ top: -10, width: 0, height: 0,
          borderLeft: "10px solid transparent", borderRight: "10px solid transparent",
          borderTop: "22px solid #f59e0b",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
        }}
      />
      {/* Wheel */}
      <svg
        width={280} height={280}
        viewBox="0 0 300 300"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? "transform 4s cubic-bezier(0.17,0.67,0.12,0.99)" : "none",
          filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.4))",
        }}
      >
        {/* Segments */}
        {WHEEL_PRIZES.map((prize, i) => {
          const mid = i * SEG_DEG + SEG_DEG / 2;
          const tp = polar(CX, CY, (R_OUTER + R_INNER) / 2, mid);
          return (
            <g key={prize.id}>
              <path d={segPath(i)} fill={prize.color} stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
              <text
                x={tp.x} y={tp.y}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="11" fontWeight="bold" fill="white"
                transform={`rotate(${mid + 90}, ${tp.x}, ${tp.y})`}
                style={{ pointerEvents: "none", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}
              >
                {prize.emoji}
              </text>
              <text
                x={tp.x} y={tp.y + 14}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="7.5" fontWeight="bold" fill="rgba(255,255,255,0.9)"
                transform={`rotate(${mid + 90}, ${tp.x}, ${tp.y + 14})`}
                style={{ pointerEvents: "none" }}
              >
                {prize.label}
              </text>
            </g>
          );
        })}
        {/* Dividers */}
        {WHEEL_PRIZES.map((_, i) => {
          const a = polar(CX, CY, R_OUTER, i * SEG_DEG);
          const b = polar(CX, CY, R_INNER, i * SEG_DEG);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" />;
        })}
        {/* Outer ring */}
        <circle cx={CX} cy={CY} r={R_OUTER} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
        {/* Center hub */}
        <circle cx={CX} cy={CY} r={R_INNER} fill="#0f172a" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
        <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fontSize="20">🎰</text>
      </svg>
    </div>
  );
}

// ── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(target: string | null): string {
  const [display, setDisplay] = useState("");
  useEffect(() => {
    if (!target) { setDisplay(""); return; }
    const update = () => {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) { setDisplay(""); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setDisplay(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [target]);
  return display;
}

// ── Loot Box Card ─────────────────────────────────────────────────────────────

function LootBoxCard({
  count, onOpen, opening,
}: { count: number; onOpen: () => void; opening: boolean }) {
  const lang = useLang();
  const s = t[lang];
  return (
    <div className="bg-gradient-to-br from-pink-900/60 to-purple-900/60 border border-pink-500/30 rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center text-2xl">🎁</div>
        <div>
          <div className="font-bold text-white text-sm">{s.wheelLootBox}</div>
          <div className="text-pink-300 text-xs">{count > 0 ? s.wheelLootBoxes(count) : s.wheelNoBoxes}</div>
        </div>
      </div>
      {count > 0 && (
        <button
          onClick={onOpen}
          disabled={opening}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {opening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
          {s.wheelOpenBox}
        </button>
      )}
    </div>
  );
}

// ── Box Reveal Overlay ────────────────────────────────────────────────────────

function BoxReveal({ result, onClose }: { result: BoxResult; onClose: () => void }) {
  const lang = useLang();
  const s = t[lang];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.5, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.5, y: 40 }}
        transition={{ type: "spring", damping: 15 }}
        className="bg-gradient-to-br from-gray-900 to-gray-800 border border-pink-500/40 rounded-3xl p-6 mx-6 max-w-sm w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <div className="text-4xl mb-1">🎁</div>
          <div className="text-white font-bold text-lg">{s.wheelBoxPrizes}</div>
        </div>
        <div className="flex gap-3 justify-center mb-4">
          {result.prizes.map((prize, i) => (
            <motion.div
              key={i}
              initial={{ rotateY: 180, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ delay: i * 0.25, duration: 0.5 }}
              className="flex-1 bg-white/10 rounded-2xl p-3 text-center"
            >
              <div className="text-3xl mb-1">{prize.emoji}</div>
              <div className="text-white text-xs font-bold">{prize.label}</div>
            </motion.div>
          ))}
        </div>
        {(result.totalSkz > 0 || result.totalXp > 0) && (
          <div className="text-center text-yellow-400 font-bold text-sm mb-4">
            {result.totalSkz > 0 && `+${result.totalSkz.toLocaleString()} SKZ`}
            {result.totalSkz > 0 && result.totalXp > 0 && " · "}
            {result.totalXp > 0 && `+${result.totalXp} XP`}
          </div>
        )}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-pink-500 text-white font-bold text-sm"
        >
          {s.tapToClose}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Prize Result Overlay ──────────────────────────────────────────────────────

function PrizeOverlay({ prize, onClose }: { prize: Prize; onClose: () => void }) {
  const lang = useLang();
  const s = t[lang];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.3 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.3 }}
        transition={{ type: "spring", damping: 12, stiffness: 200 }}
        className="text-center"
        onClick={e => e.stopPropagation()}
      >
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: 3, duration: 0.4 }}
          className="text-8xl mb-4"
        >
          {prize.emoji}
        </motion.div>
        <div className="text-yellow-400 font-black text-3xl mb-2">{s.wheelPrize}</div>
        <div className="text-white font-bold text-xl mb-6">{prize.label}</div>
        <button
          onClick={onClose}
          className="px-8 py-3 rounded-full bg-yellow-500 text-black font-bold text-lg"
        >
          {s.tapToClose}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WheelPage() {
  const lang = useLang();
  const s = t[lang];
  const status = useWheelStatus();

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<Prize | null>(null);
  const [opening, setOpening] = useState(false);
  const [boxResult, setBoxResult] = useState<BoxResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rotRef = useRef(0);
  const countdown = useCountdown(status?.nextSpinAt ?? null);

  useEffect(() => { refreshWheelStatus(); }, []);

  const canSpin = status ? (status.canSpin || status.extraSpins > 0) : false;

  const handleSpin = useCallback(async () => {
    if (spinning || !canSpin) return;
    setError(null);
    setSpinning(true);
    hapticImpact("medium");

    const result = await spinWheel();
    if (!result) {
      setError("حدث خطأ. حاول مرة أخرى.");
      setSpinning(false);
      hapticError();
      return;
    }

    const prize = WHEEL_PRIZES.find(p => p.id === result.prizeId) ?? WHEEL_PRIZES[0];
    const prizeIndex = result.prizeIndex;

    // Spin wheel to land on the winning segment
    const extra = 360 * 5;
    const landAngle = prizeIndex * SEG_DEG + SEG_DEG / 2;
    const target = extra + landAngle;
    const newRot = rotRef.current + target;
    rotRef.current = newRot % 360;
    setRotation(prev => prev + target);

    // Wait for animation to finish
    setTimeout(() => {
      setSpinning(false);
      setWonPrize(prize);
      hapticSuccess();
      sfx.win();
    }, 4200);
  }, [spinning, canSpin]);

  const handleOpenBox = useCallback(async () => {
    if (opening) return;
    setOpening(true);
    hapticImpact("heavy");
    const result = await openLootBox();
    setOpening(false);
    if (!result) {
      hapticError();
      return;
    }
    hapticSuccess();
    setBoxResult(result);
  }, [opening]);

  const lootBoxes = status?.lootBoxes ?? 0;

  return (
    <div className="min-h-full bg-gradient-to-b from-gray-900 via-purple-950 to-gray-900 pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 text-center">
        <h1 className="text-2xl font-black text-white">{s.wheelTitle}</h1>
        <p className="text-purple-300 text-sm mt-1">{s.wheelSubtitle}</p>
      </div>

      {/* Wheel */}
      <div className="flex flex-col items-center gap-4 px-4">
        <WheelSVG rotation={rotation} spinning={spinning} />

        {/* Spin button */}
        {status === null ? (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">جارٍ التحميل...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 w-full max-w-xs">
            <button
              onClick={handleSpin}
              disabled={spinning || !canSpin}
              className="w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
              style={{
                background: canSpin
                  ? "linear-gradient(135deg, #7c3aed, #c026d3)"
                  : "rgba(255,255,255,0.08)",
                color: "white",
                boxShadow: canSpin ? "0 4px 20px rgba(124,58,237,0.5)" : "none",
              }}
            >
              {spinning
                ? <><Loader2 className="w-5 h-5 animate-spin" /> يدور...</>
                : <><RotateCcw className="w-5 h-5" /> {status.extraSpins > 0 ? s.wheelExtraSpins(status.extraSpins) : s.wheelSpin}</>
              }
            </button>

            {!canSpin && countdown && (
              <div className="text-purple-400 text-sm flex items-center gap-1">
                <span className="font-mono font-bold text-white">{countdown}</span>
                <span>{s.wheelCooldownSuffix}</span>
              </div>
            )}

            {error && <div className="text-red-400 text-xs text-center">{error}</div>}
          </div>
        )}
      </div>

      {/* Loot Box Section */}
      <div className="px-4 mt-6">
        <LootBoxCard count={lootBoxes} onOpen={handleOpenBox} opening={opening} />
      </div>

      {/* Prize table */}
      <div className="px-4 mt-6">
        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-3 text-center">
          {s.wheelPrizeTable}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {WHEEL_PRIZES.map(prize => (
            <div key={prize.id} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: prize.color }}
              />
              <span className="text-lg leading-none">{prize.emoji}</span>
              <span className="text-white text-xs font-medium">{prize.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {wonPrize && (
          <PrizeOverlay prize={wonPrize} onClose={() => setWonPrize(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {boxResult && (
          <BoxReveal result={boxResult} onClose={() => setBoxResult(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
