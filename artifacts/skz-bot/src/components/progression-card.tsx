import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, Check } from "lucide-react";
import { useLang, t } from "@/lib/i18n";
import {
  useProgression, LEAGUES, leagueCosmetic, leagueName,
} from "@/lib/progression";
import { hapticImpact } from "@/lib/haptics";
import { sfx } from "@/lib/sound";

/**
 * Compact league badge + XP progress bar shown on the home screen.
 * Tapping it opens a full leagues overview sheet.
 */
export function ProgressionCard() {
  const lang = useLang();
  const s = t[lang];
  const prog = useProgression();
  const [open, setOpen] = useState(false);

  if (!prog) return null;

  const cos = leagueCosmetic(prog.key);
  const pct = prog.levelSpan > 0
    ? Math.min(100, Math.round((prog.intoLevel / prog.levelSpan) * 100))
    : 100;

  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => { hapticImpact("light"); sfx.click(); setOpen(true); }}
        className="w-full text-start rounded-2xl p-3.5 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${cos.gradient[0]}22, ${cos.gradient[1]}10)`,
          border: `1px solid ${cos.color}40`,
          boxShadow: `0 0 20px ${cos.color}15`,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{
              background: `linear-gradient(135deg, ${cos.gradient[0]}, ${cos.gradient[1]})`,
              boxShadow: `0 0 14px ${cos.color}50`,
            }}
          >
            {cos.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display font-black text-sm" style={{ color: cos.color }}>
                {leagueName(prog.key, lang)}
              </span>
              <span className="font-mono text-[11px] text-white/55">
                {s.levelLabel(prog.level)}
              </span>
            </div>
            {/* XP bar */}
            <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${cos.gradient[0]}, ${cos.gradient[1]})` }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-mono text-[10px] text-white/40">
                {s.xpProgress(prog.intoLevel, prog.levelSpan)}
              </span>
              <span className="font-mono text-[10px] text-white/40">{s.tapForLeagues}</span>
            </div>
          </div>
        </div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <LeaguesSheet
            currentKey={prog.key}
            currentLevel={prog.level}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function LeaguesSheet({
  currentKey, currentLevel, onClose,
}: {
  currentKey: string;
  currentLevel: number;
  onClose: () => void;
}) {
  const lang = useLang();
  const s = t[lang];
  const currentIdx = LEAGUES.findIndex((l) => l.key === currentKey);

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        className="relative w-full max-w-md rounded-t-3xl bg-[#0c0818] border-t border-white/10 p-5 pb-8 max-h-[80vh] overflow-y-auto"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-black text-lg text-white">{s.leaguesTitle}</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-white/45 mb-4 leading-relaxed">{s.leaguesSubtitle}</p>

        <div className="flex flex-col gap-2.5">
          {LEAGUES.map((lg, idx) => {
            const isCurrent = idx === currentIdx;
            const isUnlocked = idx <= currentIdx;
            return (
              <div
                key={lg.key}
                className="rounded-2xl p-3 flex items-center gap-3 relative"
                style={{
                  background: isCurrent
                    ? `linear-gradient(135deg, ${lg.gradient[0]}33, ${lg.gradient[1]}15)`
                    : "rgba(255,255,255,0.03)",
                  border: isCurrent ? `1px solid ${lg.color}66` : "1px solid rgba(255,255,255,0.06)",
                  opacity: isUnlocked ? 1 : 0.55,
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{
                    background: isUnlocked
                      ? `linear-gradient(135deg, ${lg.gradient[0]}, ${lg.gradient[1]})`
                      : "rgba(255,255,255,0.06)",
                  }}
                >
                  {isUnlocked ? lg.icon : <Lock size={18} className="text-white/40" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-sm" style={{ color: isUnlocked ? lg.color : "#ffffff80" }}>
                    {lang === "ar" ? lg.nameAr : lg.nameEn}
                  </div>
                  <div className="font-mono text-[10px] text-white/40">
                    {s.leagueFromLevel(LEAGUES[idx]!.key === "bronze" ? 1 : leagueMinLevel(idx))}
                  </div>
                </div>
                {isCurrent && (
                  <span className="font-display text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: `${lg.color}25`, color: lg.color }}>
                    {s.currentLeague}
                  </span>
                )}
                {isUnlocked && !isCurrent && (
                  <Check size={16} style={{ color: lg.color }} />
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

// Mirror of the server league boundaries for display only.
const LEAGUE_MIN_LEVELS = [1, 5, 10, 18, 28, 40, 55];
function leagueMinLevel(idx: number): number {
  return LEAGUE_MIN_LEVELS[idx] ?? 1;
}
