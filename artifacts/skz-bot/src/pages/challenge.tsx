import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Swords, Clock } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useLang } from "@/lib/i18n";
import { getChallenge, setActiveChallenge } from "@/lib/challenge";
import type { ChallengeInfo } from "@/lib/challenge";
import { ALL_GAMES } from "@/lib/games-data";

const ACCENT = "#F5B50A";

function timeLeft(expiresAt: string, ar: boolean): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return ar ? "انتهت المدة" : "Expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return ar ? `${h}س ${m}د متبقية` : `${h}h ${m}m left`;
  return ar ? `${m} دقيقة متبقية` : `${m}m left`;
}

export default function ChallengePage() {
  const lang = useLang();
  const ar = lang === "ar";
  const [location, navigate] = useLocation();
  const challengeId = location.replace(/^\/challenge\//, "");

  const [info, setInfo] = useState<ChallengeInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!challengeId) return;
    setLoading(true);
    getChallenge(challengeId).then((data) => {
      setInfo(data);
      setLoading(false);
    });
  }, [challengeId]);

  const game = info ? ALL_GAMES.find((g) => g.id === info.gameId) : null;

  const handlePlayNow = () => {
    if (!info || !game) return;
    setActiveChallenge(challengeId);
    navigate(game.route);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d0118" }}>
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6"
        style={{ background: "#0d0118" }} dir={ar ? "rtl" : "ltr"}>
        <div className="text-5xl">🔍</div>
        <div className="text-white font-black text-xl">
          {ar ? "التحدي غير موجود" : "Challenge not found"}
        </div>
        <Link href="/">
          <button className="px-6 py-3 rounded-xl text-sm font-bold" style={{ background: ACCENT, color: "#0d0118" }}>
            {ar ? "الرئيسية" : "Home"}
          </button>
        </Link>
      </div>
    );
  }

  const expired = info.status === "expired" || new Date(info.expiresAt).getTime() < Date.now();
  const beaten = info.status === "beaten";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0d0118" }} dir={ar ? "rtl" : "ltr"}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <Link href="/">
          <button className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.06)" }}>
            <ArrowRight size={18} className="text-white/70"
              style={{ transform: ar ? "none" : "rotate(180deg)" }} />
          </button>
        </Link>
        <h1 className="text-base font-display font-black text-white">
          {ar ? "التحدي" : "Challenge"}
        </h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 gap-5 pb-16">

        {/* Challenge Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-3xl p-6 flex flex-col gap-4"
          style={{
            background: "linear-gradient(135deg, rgba(245,181,10,0.12), rgba(139,92,246,0.1))",
            border: "1px solid rgba(245,181,10,0.3)",
          }}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="text-6xl">{(game as any)?.icon ?? "🎮"}</div>
            <div className="text-lg font-display font-black text-white uppercase">{info.gameName}</div>
          </div>

          <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: "rgba(0,0,0,0.3)" }}>
            <div className="text-[10px] text-white/40 uppercase font-bold tracking-widest text-center">
              {ar ? "تحداك" : "challenged you"}
            </div>
            <div className="text-xl font-black text-white text-center">{info.challengerName}</div>
            <div className="flex items-center justify-center gap-2 mt-1">
              <Swords size={16} style={{ color: ACCENT }} />
              <span className="text-2xl font-display font-black" style={{ color: ACCENT }}>
                {info.score.toLocaleString()}
              </span>
              <span className="text-sm text-white/40">{ar ? "نقطة" : "pts"}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Clock size={13} className="text-white/30" />
            <span className="text-[11px] text-white/40">{timeLeft(info.expiresAt, ar)}</span>
          </div>
        </motion.div>

        {/* Action */}
        {beaten ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm rounded-2xl p-5 text-center flex flex-col gap-2"
            style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)" }}>
            <div className="text-3xl">🏆</div>
            <div className="text-lg font-black" style={{ color: "#4ade80" }}>
              {ar ? "تم الفوز بهذا التحدي!" : "Challenge Beaten!"}
            </div>
            {info.opponentScore != null && (
              <div className="text-[11px] text-white/40">
                {info.opponentScore.toLocaleString()} {ar ? "نقطة" : "pts"}
              </div>
            )}
          </motion.div>
        ) : expired ? (
          <div className="text-white/40 text-sm text-center">
            {ar ? "انتهت مدة هذا التحدي" : "This challenge has expired"}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm flex flex-col gap-3">
            <button
              onClick={handlePlayNow}
              disabled={!game}
              className="w-full py-4 rounded-2xl font-display font-black text-base flex items-center justify-center gap-3 disabled:opacity-60"
              style={{ background: ACCENT, color: "#0d0118" }}>
              <Swords size={20} />
              {ar ? "العب الآن وتفوق عليه" : "Play Now & Beat It"}
            </button>
            <div className="text-[11px] text-white/30 text-center">
              {ar ? "ستظهر نتيجتك بعد انتهاء اللعبة" : "Your score will appear after the game ends"}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
