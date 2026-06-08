import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang, t } from "@/lib/i18n";
import {
  usePendingLevelUp, consumeLevelUp, getProgression, leagueCosmetic, leagueName,
} from "@/lib/progression";
import { hapticSuccess } from "@/lib/haptics";
import { sfx } from "@/lib/sound";

/**
 * Full-screen celebration that fires once whenever the player's level increases.
 * Mounted globally in App.tsx; listens to the pending level-up event store.
 */
export function LevelUpOverlay() {
  const lang = useLang();
  const s = t[lang];
  const pending = usePendingLevelUp();
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    if (pending !== null && shown === null) {
      const lvl = consumeLevelUp();
      if (lvl !== null) {
        setShown(lvl);
        hapticSuccess();
        sfx.levelUp();
        const timer = setTimeout(() => setShown(null), 4200);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [pending, shown]);

  const prog = getProgression();
  const cos = prog ? leagueCosmetic(prog.key) : leagueCosmetic("bronze");

  return (
    <AnimatePresence>
      {shown !== null && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShown(null)}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

          {/* Radial glow burst */}
          <motion.div
            className="absolute w-[320px] h-[320px] rounded-full"
            style={{ background: `radial-gradient(circle, ${cos.color}55, transparent 70%)` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.4, 1.1], opacity: [0, 1, 0.7] }}
            transition={{ duration: 1, ease: "easeOut" }}
          />

          {/* Confetti sparks */}
          {Array.from({ length: 18 }).map((_, i) => {
            const angle = (i / 18) * Math.PI * 2;
            const dist = 120 + (i % 4) * 26;
            return (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{ background: i % 2 === 0 ? cos.gradient[0] : cos.gradient[1] }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(angle) * dist,
                  y: Math.sin(angle) * dist,
                  opacity: 0,
                  scale: 0.3,
                }}
                transition={{ duration: 1.1, delay: 0.1, ease: "easeOut" }}
              />
            );
          })}

          <motion.div
            className="relative text-center"
            initial={{ scale: 0.5, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 18, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="w-28 h-28 mx-auto rounded-3xl flex items-center justify-center text-6xl mb-5"
              style={{
                background: `linear-gradient(135deg, ${cos.gradient[0]}, ${cos.gradient[1]})`,
                boxShadow: `0 0 50px ${cos.color}80`,
              }}
              animate={{ rotate: [0, -8, 8, -4, 0] }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              {cos.icon}
            </motion.div>
            <div className="font-display font-black text-sm tracking-[0.3em] uppercase mb-1" style={{ color: cos.color }}>
              {s.levelUpKicker}
            </div>
            <div className="font-display font-black text-5xl text-white mb-2">
              {s.levelLabel(shown)}
            </div>
            {prog && (
              <div className="font-display text-sm text-white/60">
                {leagueName(prog.key, lang)}
              </div>
            )}
            <div className="mt-5 font-mono text-[11px] text-white/40">{s.tapToClose}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
