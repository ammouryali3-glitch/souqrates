import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Coins, Skull, Share2, CheckCircle2 } from "lucide-react";
import { useLang, t } from "@/lib/i18n";
import { hapticImpact, hapticSuccess } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
import { createChallenge } from "@/lib/challenge";
import { ALL_GAMES } from "@/lib/games-data";

interface GameOverOverlayProps {
  show: boolean;
  entryFee: number;
  score: number;
  target: number;
  balance: number;
  lostReason?: string | null;
  onRetry: () => void;
}

export function GameOverOverlay({ show, entryFee, score, target, balance, lostReason, onRetry }: GameOverOverlayProps) {
  const lang = useLang();
  const s = t[lang];

  useEffect(() => {
    if (show) hapticImpact("heavy");
  }, [show]);

  const reasonText = lostReason === "time" ? s.gameTimeUp : s.gameYouLost;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="gameover"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center px-8"
          style={{ background: "rgba(6,4,15,0.98)", backdropFilter: "blur(16px)" }}
        >
          <motion.div
            initial={{ scale: 0.75, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 24, delay: 0.05 }}
            className="w-full max-w-[300px] flex flex-col items-center text-center"
          >
            <motion.div
              animate={{ rotate: [0, -12, 12, -8, 8, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 0.7, delay: 0.2, ease: "easeInOut" }}
              className="text-6xl mb-4"
            >
              💀
            </motion.div>

            <span className="text-xs tracking-[0.45em] font-display uppercase mb-1 text-red-400/80">
              {reasonText}
            </span>
            <div className="font-display font-black text-5xl text-transparent bg-clip-text bg-gradient-to-br from-red-400 via-red-300 to-white/60 mb-1">
              -{entryFee}
            </div>
            <div className="flex items-center gap-1.5 text-white/40 text-sm mb-7">
              <Coins size={13} className="text-red-400/60" />
              <span>SKZ entry fee lost</span>
            </div>

            <div className="w-full grid grid-cols-2 gap-3 mb-7">
              <div className="bg-white/4 border border-white/8 rounded-2xl p-3 flex flex-col items-center gap-1">
                <span className="text-[10px] text-white/35 uppercase tracking-wider font-display">{s.gameScore}</span>
                <span className="font-display font-bold text-xl text-white">{score} / {target}</span>
              </div>
              <div className="bg-white/4 border border-white/8 rounded-2xl p-3 flex flex-col items-center gap-1">
                <span className="text-[10px] text-white/35 uppercase tracking-wider font-display">Balance</span>
                <span className="font-display font-bold text-xl text-white">{balance.toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={onRetry}
              className="w-full py-3.5 rounded-2xl font-display font-bold tracking-widest flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform"
              style={{
                background: "linear-gradient(135deg, #ef4444, #b91c1c)",
                boxShadow: "0 0 28px rgba(239,68,68,0.35)",
                color: "#fff",
              }}
            >
              <RotateCcw size={17} />
              {s.gamePlayAgain}
            </button>

            <Link href="/games">
              <button className="text-sm text-white/40 hover:text-white/70 transition-colors font-medium">
                {s.arenaBackToGames}
              </button>
            </Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface GameWonOverlayProps {
  show: boolean;
  prize: number;
  score: number;
  target: number;
  balance: number;
  onRetry: () => void;
}

export function GameWonOverlay({ show, prize, score, target, balance, onRetry }: GameWonOverlayProps) {
  const lang = useLang();
  const s = t[lang];
  const [location] = useLocation();
  const [challenging, setChallenging] = useState(false);
  const [challengeSent, setChallengeSent] = useState(false);

  useEffect(() => {
    if (show) {
      hapticSuccess();
      setChallengeSent(false);
    }
  }, [show]);

  // Derive game def from current route e.g. /games/stack → "stack"
  const gameMatch = location.match(/^\/games\/(\w+)/);
  const gameId = gameMatch?.[1] ?? null;
  const gameDef = gameId ? ALL_GAMES.find((g) => g.id === gameId) : null;

  const handleChallenge = async () => {
    if (!gameId || !gameDef || challenging) return;
    setChallenging(true);
    hapticImpact("medium");
    try {
      const result = await createChallenge(gameId, gameDef.title, score);
      setChallengeSent(true);
      hapticSuccess();
      sfx.coin();
      type TelegramWebApp = { openTelegramLink?: (u: string) => void; openLink?: (u: string) => void };
      const twa = (window as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
      if (twa?.openTelegramLink) {
        twa.openTelegramLink(result.shareUrl);
      } else if (twa?.openLink) {
        twa.openLink(result.shareUrl);
      } else {
        try { await navigator.clipboard.writeText(result.shareUrl); } catch { /* ignore */ }
      }
    } catch { /* silent */ }
    setChallenging(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="gamewon"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center px-8"
          style={{ background: "rgba(6,4,15,0.97)", backdropFilter: "blur(16px)" }}
        >
          <motion.div
            initial={{ scale: 0.75, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.05 }}
            className="w-full max-w-[300px] flex flex-col items-center text-center"
          >
            <motion.div
              animate={{ rotate: [0, -10, 10, -6, 0], scale: [1, 1.2, 1.1, 1] }}
              transition={{ duration: 0.8, delay: 0.15, ease: "easeInOut" }}
              className="text-6xl mb-4"
            >
              🏆
            </motion.div>

            <span className="text-xs tracking-[0.45em] font-display uppercase mb-1"
              style={{ color: "#F5B50A" }}
            >
              {s.gameYouWin}
            </span>
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 500, damping: 20 }}
              className="font-display font-black text-5xl text-transparent bg-clip-text mb-1"
              style={{ backgroundImage: "linear-gradient(135deg, #F5B50A, #fde68a, #D4AF37)" }}
            >
              +{prize.toLocaleString()}
            </motion.div>
            <div className="flex items-center gap-1.5 text-white/40 text-sm mb-7">
              <Coins size={13} style={{ color: "#F5B50A" }} />
              <span>SKZ prize claimed</span>
            </div>

            <div className="w-full grid grid-cols-2 gap-3 mb-7">
              <div className="rounded-2xl p-3 flex flex-col items-center gap-1 border"
                style={{ background: "rgba(212,175,55,0.08)", borderColor: "rgba(212,175,55,0.25)" }}>
                <span className="text-[10px] text-white/35 uppercase tracking-wider font-display">{s.gameScore}</span>
                <span className="font-display font-bold text-xl text-white">{score} / {target}</span>
              </div>
              <div className="rounded-2xl p-3 flex flex-col items-center gap-1 border"
                style={{ background: "rgba(212,175,55,0.08)", borderColor: "rgba(212,175,55,0.25)" }}>
                <span className="text-[10px] text-white/35 uppercase tracking-wider font-display">Balance</span>
                <span className="font-display font-bold text-xl" style={{ color: "#F5B50A" }}>{balance.toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={onRetry}
              className="w-full py-3.5 rounded-2xl font-display font-bold tracking-widest flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform text-black"
              style={{
                background: "linear-gradient(135deg, #F5B50A, #D4AF37)",
                boxShadow: "0 0 28px rgba(245,181,10,0.4)",
              }}
            >
              <RotateCcw size={17} />
              {s.gamePlayAgain}
            </button>

            {/* Challenge button — visible only for skill game routes */}
            {gameDef && !challengeSent && (
              <button
                onClick={handleChallenge}
                disabled={challenging}
                className="w-full py-3 rounded-2xl font-display font-bold tracking-widest flex items-center justify-center gap-2 mb-3 active:scale-95 transition-transform disabled:opacity-50"
                style={{
                  background: "rgba(124,58,237,0.18)",
                  border: "1px solid rgba(139,92,246,0.4)",
                  color: "#a78bfa",
                }}
              >
                {challenging ? (
                  <div className="w-4 h-4 border-2 rounded-full animate-spin border-violet-400/30 border-t-violet-400" />
                ) : (
                  <><Share2 size={16} /> {s.challengeCreate}</>
                )}
              </button>
            )}
            {challengeSent && (
              <div className="flex items-center justify-center gap-1.5 text-sm mb-3" style={{ color: "#34d399" }}>
                <CheckCircle2 size={14} />
                <span>{s.challengeSent}</span>
              </div>
            )}

            <Link href="/games">
              <button className="text-sm text-white/40 hover:text-white/70 transition-colors font-medium">
                {s.arenaBackToGames}
              </button>
            </Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
