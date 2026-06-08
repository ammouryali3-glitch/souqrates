import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Target, Sparkles, CheckCircle2, Gift } from "lucide-react";
import { useLang, t, type Strings } from "@/lib/i18n";
import { useAdmin, admin } from "@/lib/admin-store";
import {
  useQuests,
  refreshQuests,
  claimQuest,
  type QuestView,
} from "@/lib/quests";
import { refreshProgression } from "@/lib/progression";
import { hapticSuccess, hapticError, hapticSelection } from "@/lib/haptics";
import { sfx } from "@/lib/sound";

function questLabel(q: QuestView, s: Strings): string {
  switch (q.metric) {
    case "games_played": return s.questPlayGames(q.target);
    case "skz_earned": return s.questEarnSkz(q.target);
    case "checkin": return s.questCheckin(q.target);
    default: return "";
  }
}

export default function Missions() {
  const lang = useLang();
  const s = t[lang];
  const { settings } = useAdmin();
  const accent = settings.accent || "#c9a227";
  const quests = useQuests();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useEffect(() => { refreshQuests(); }, []);

  const daily = (quests ?? []).filter((q) => q.period === "daily");
  const weekly = (quests ?? []).filter((q) => q.period === "weekly");

  const handleClaim = async (q: QuestView) => {
    if (claimingId || !q.claimable) return;
    setClaimingId(q.id);
    hapticSelection();
    const result = await claimQuest(q.id);
    if (result) {
      hapticSuccess();
      sfx.coin();
      admin.setBalance(result.skz);
      refreshProgression();
    } else {
      hapticError();
    }
    setClaimingId(null);
  };

  const renderQuest = (q: QuestView, idx: number) => {
    const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
    return (
      <motion.div
        key={q.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.04 }}
        className="relative overflow-hidden rounded-2xl p-4"
        style={{
          background: q.claimable
            ? `linear-gradient(135deg, ${accent}1f, rgba(74,222,128,0.08))`
            : "rgba(255,255,255,0.04)",
          border: q.claimable ? `1px solid ${accent}55` : "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: q.claimed ? "rgba(255,255,255,0.08)" : `${accent}22` }}
          >
            {q.claimed
              ? <CheckCircle2 size={18} className="text-white/40" />
              : <Target size={18} style={{ color: accent }} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-display font-bold ${q.claimed ? "text-white/45" : "text-white"}`}>
              {questLabel(q, s)}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: q.claimed ? "rgba(255,255,255,0.25)" : `${accent}cc` }}>
              {s.questReward(q.rewardSkz, q.rewardXp)}
            </div>
          </div>
          {q.claimed ? (
            <span className="text-[11px] font-bold text-white/35 px-2">{s.questClaimed}</span>
          ) : q.claimable ? (
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => handleClaim(q)}
              disabled={claimingId === q.id}
              className="text-xs font-display font-black px-4 py-2 rounded-xl shrink-0 disabled:opacity-60 flex items-center gap-1.5"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)`, color: "#1a1206" }}
            >
              {claimingId === q.id
                ? <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: "#1a120640", borderTopColor: "#1a1206" }} />
                : <><Gift size={13} /> {s.questClaim}</>}
            </motion.button>
          ) : (
            <span className="text-[11px] font-bold text-white/40 px-2 shrink-0">
              {q.progress}/{q.target}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {!q.claimed && (
          <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{ background: q.completed ? "#4ade80" : `linear-gradient(90deg, ${accent}, ${accent}aa)` }}
            />
          </div>
        )}
      </motion.div>
    );
  };

  const Section = ({ title, icon, items }: { title: string; icon: React.ReactNode; items: QuestView[] }) => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        {icon}
        <h2 className="text-sm font-display font-black text-white tracking-wide">{title}</h2>
      </div>
      {items.length === 0
        ? <div className="text-[12px] text-white/30 px-1">{s.noMissions}</div>
        : items.map((q, i) => renderQuest(q, i))}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 pb-4">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="px-1 pt-1">
        <h1 className="text-2xl font-display font-black text-white">{s.missionsTitle}</h1>
        <p className="text-[12px] text-white/40 mt-1 leading-relaxed">{s.missionsSubtitle}</p>
      </motion.div>

      <Section title={s.dailyMissions} icon={<Sparkles size={16} style={{ color: accent }} />} items={daily} />
      <Section title={s.weeklyMissions} icon={<Target size={16} style={{ color: accent }} />} items={weekly} />
    </div>
  );
}
