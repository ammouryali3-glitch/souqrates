import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const duration = 2200;
    const interval = 30;
    const steps = duration / interval;
    let current = 0;

    const timer = setInterval(() => {
      current += 1;
      // Ease-out curve: fast at start, slows near 100
      const eased = Math.round(100 * (1 - Math.pow(1 - current / steps, 2)));
      setProgress(Math.min(eased, 100));

      if (current >= steps) {
        clearInterval(timer);
        setTimeout(() => {
          setVisible(false);
          setTimeout(onDone, 500);
        }, 200);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 select-none"
          style={{
            background: "radial-gradient(ellipse at 50% 30%, #1a0e3a 0%, #0a0614 60%, #050310 100%)",
          }}
        >
          {/* Ambient glow behind logo */}
          <div
            className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(138,80,255,0.18) 0%, transparent 70%)" }}
          />

          {/* Logo */}
          <motion.img
            src="/souqrates-logo.png"
            alt="Souqrates"
            className="w-56 h-56 object-contain relative z-10"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          />

          {/* Title */}
          <motion.div
            className="flex flex-col items-center gap-1 relative z-10"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
          >
            <h1
              className="font-display font-black text-2xl tracking-[0.2em] uppercase"
              style={{
                background: "linear-gradient(135deg, #f0d060 0%, #c9a227 50%, #f0d060 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Souqrates System
            </h1>
          </motion.div>

          {/* Progress bar */}
          <motion.div
            className="relative z-10 flex flex-col items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <div className="w-48 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #7c3aed, #c9a227, #f0d060)",
                  boxShadow: "0 0 8px rgba(212,175,55,0.6)",
                  transition: "width 30ms linear",
                }}
              />
            </div>
            <span className="font-display text-[11px] text-white/30 tracking-widest tabular-nums">
              {progress}%
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
