import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Lock, Crown, CheckCircle2, Sparkles, Shield } from "lucide-react";
import { Link } from "wouter";
import { useLang } from "@/lib/i18n";
import { sfx } from "@/lib/sound";
import {
  useBattlePassStatus,
  refreshBattlePassStatus,
  claimBattlePassTier,
  unlockBattlePassPremium,
} from "@/lib/battle-pass";
import type { BattlePassReward, BattlePassTier } from "@/lib/battle-pass";
import { writeBalance } from "@/lib/admin-store";

// ── Helpers ───────────────────────────────────────────────────────────────────

function rewardLabel(r: BattlePassReward): string {
  if (r.type === "skz") return `${r.amount.toLocaleString()} SKZ`;
  if (r.type === "lootbox") return `📦 × ${r.amount}`;
  return `⭐ × ${r.amount}`;
}

function timeRemaining(endDate: string, ar: boolean): string {
  const ms = new Date(`${endDate}T23:59:59Z`).getTime() - Date.now();
  if (ms <= 0) return ar ? "انتهى الموسم" : "Season Ended";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return ar ? `${days} يوم متبقي` : `${days}d remaining`;
  return ar ? `${hours} ساعة متبقية` : `${hours}h remaining`;
}

const ACCENT = "#F5B50A";
const PREMIUM_COLOR = "#c084fc";
const MILESTONE_BG = "rgba(245,181,10,0.08)";

// ── TierCell ──────────────────────────────────────────────────────────────────

interface TierCellProps {
  tier: BattlePassTier;
  track: "free" | "premium";
  isUnlocked: boolean;
  isClaimed: boolean;
  isPremiumUser: boolean;
  isSeasonActive: boolean;
  onClaim: (tier: number, track: "free" | "premium") => void;
  loading: string | null; // "N-free" | "N-premium"
}

function TierCell({
  tier, track, isUnlocked, isClaimed, isPremiumUser, isSeasonActive, onClaim, loading,
}: TierCellProps) {
  const reward = track === "free" ? tier.freeReward : tier.premiumReward;
  const loadKey = `${tier.tier}-${track}`;
  const isLoading = loading === loadKey;
  const isPremiumLocked = track === "premium" && !isPremiumUser && isUnlocked;
  const isLocked = !isUnlocked || (!isPremiumUser && track === "premium");
  const color = track === "free" ? ACCENT : PREMIUM_COLOR;

  return (
    <div className="flex-1 flex flex-col items-center gap-1.5 px-2 py-3">
      <span className="text-sm font-black" style={{ color: isLocked ? "rgba(255,255,255,0.25)" : color }}>
        {rewardLabel(reward)}
      </span>

      {isClaimed ? (
        <div className="flex items-center gap-1 text-[10px] font-bold" style={{ color: "#4ade80" }}>
          <CheckCircle2 size={12} />
          <span>تم</span>
        </div>
      ) : isPremiumLocked ? (
        <div className="flex items-center gap-0.5" style={{ color: PREMIUM_COLOR, opacity: 0.7 }}>
          <Crown size={13} />
        </div>
      ) : !isUnlocked ? (
        <Lock size={12} className="text-white/20" />
      ) : isSeasonActive ? (
        <button
          disabled={isLoading}
          onClick={() => onClaim(tier.tier, track)}
          className="text-[11px] font-black px-3 py-0.5 rounded-full transition-all active:scale-95"
          style={{
            background: color,
            color: "#0d0118",
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          {isLoading ? "…" : "احصل"}
        </button>
      ) : null}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastMsg { text: string; key: number }

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BattlePassPage() {
  const lang = useLang();
  const ar = lang === "ar";
  const status = useBattlePassStatus();
  const [loading, setLoading] = useState<string | null>(null);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { refreshBattlePassStatus(); }, []);

  const showToast = useCallback((text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const handleClaim = useCallback(async (tier: number, track: "free" | "premium") => {
    const key = `${tier}-${track}`;
    if (loading) return;
    setLoading(key);
    try {
      const res = await claimBattlePassTier(tier, track);
      sfx.coin();
      if (typeof res.newSkz === "number") writeBalance(res.newSkz);
      const label = rewardLabel(res.reward);
      showToast(ar ? `✓ حصلت على ${label}` : `✓ Claimed ${label}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error";
      showToast(msg);
    } finally {
      setLoading(null);
    }
  }, [loading, ar, showToast]);

  const handleUnlockPremium = useCallback(async () => {
    if (unlockLoading || !status) return;
    setUnlockLoading(true);
    try {
      const res = await unlockBattlePassPremium();
      sfx.win();
      writeBalance(res.newSkz);
      showToast(ar ? "🎉 البريميوم مفعّل!" : "🎉 Premium unlocked!");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error";
      showToast(msg);
    } finally {
      setUnlockLoading(false);
    }
  }, [unlockLoading, status, ar, showToast]);

  const seasonActive = status
    ? new Date(`${status.season.endDate}T23:59:59Z`).getTime() > Date.now()
    : true;

  const unlockedSet = new Set(status?.unlockedTiers ?? []);
  const claimedFreeSet = new Set(status?.claimedFree ?? []);
  const claimedPremiumSet = new Set(status?.claimedPremium ?? []);
  const tiers = status?.season.tiers ?? [];

  const seasonXp = status?.seasonXp ?? 0;
  const maxXp = tiers[tiers.length - 1]?.xpRequired ?? 50000;
  const xpPct = Math.min(100, (seasonXp / maxXp) * 100);
  const currentTierIdx = tiers.filter(t => unlockedSet.has(t.tier)).length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0d0118" }} dir={ar ? "rtl" : "ltr"}>

      {/* ── Top Bar ── */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <Link href="/">
          <button className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.06)" }}>
            <ArrowRight size={18} className="text-white/70" style={{ transform: ar ? "none" : "rotate(180deg)" }} />
          </button>
        </Link>
        <div>
          <h1 className="text-base font-display font-black text-white">
            {ar ? "باس الموسم" : "Battle Pass"}
          </h1>
          {status && (
            <p className="text-[11px] text-white/40">{status.season.name}</p>
          )}
        </div>
      </div>

      {!status ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-24 px-4 flex flex-col gap-4">

          {/* ── Season Progress Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{
              background: "linear-gradient(135deg, rgba(245,181,10,0.12), rgba(139,92,246,0.12))",
              border: "1px solid rgba(245,181,10,0.25)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} style={{ color: ACCENT }} />
                <span className="text-sm font-black text-white">{ar ? "تقدمك" : "Progress"}</span>
              </div>
              <span className="text-[11px] font-bold" style={{ color: seasonActive ? ACCENT : "rgba(255,255,255,0.4)" }}>
                {timeRemaining(status.season.endDate, ar)}
              </span>
            </div>

            {/* XP bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-white/50">
                  {ar ? `${currentTierIdx} / ${tiers.length} تير` : `${currentTierIdx} / ${tiers.length} tiers`}
                </span>
                <span className="text-[11px] font-bold text-white/70">
                  {seasonXp.toLocaleString()} / {maxXp.toLocaleString()} XP
                </span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${ACCENT}, #f97316)` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${xpPct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Stats row */}
            <div className="flex gap-3">
              <div className="flex-1 rounded-xl p-2.5 text-center"
                style={{ background: "rgba(0,0,0,0.25)" }}>
                <div className="text-lg font-black" style={{ color: ACCENT }}>
                  {status.claimableCount}
                </div>
                <div className="text-[10px] text-white/40">{ar ? "مكافآت متاحة" : "to claim"}</div>
              </div>
              <div className="flex-1 rounded-xl p-2.5 text-center"
                style={{ background: "rgba(0,0,0,0.25)" }}>
                <div className="text-lg font-black text-white">{status.claimedFree.length + status.claimedPremium.length}</div>
                <div className="text-[10px] text-white/40">{ar ? "محصولة" : "claimed"}</div>
              </div>
              <div className="flex-1 rounded-xl p-2.5 text-center"
                style={{ background: "rgba(0,0,0,0.25)" }}>
                <div className={`text-lg font-black ${status.premium ? "text-purple-400" : "text-white/30"}`}>
                  {status.premium ? "✓" : "✗"}
                </div>
                <div className="text-[10px] text-white/40">{ar ? "بريميوم" : "premium"}</div>
              </div>
            </div>
          </motion.div>

          {/* ── Premium CTA ── */}
          <AnimatePresence>
            {!status.premium && seasonActive && (
              <motion.button
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                onClick={handleUnlockPremium}
                disabled={unlockLoading}
                className="w-full rounded-2xl p-4 flex items-center gap-4 active:scale-[0.98] transition-transform"
                style={{
                  background: "linear-gradient(135deg, rgba(192,132,252,0.2), rgba(139,92,246,0.15))",
                  border: "1px solid rgba(192,132,252,0.4)",
                  boxShadow: "0 4px 24px rgba(139,92,246,0.2)",
                }}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(192,132,252,0.2)" }}>
                  <Crown size={22} style={{ color: PREMIUM_COLOR }} />
                </div>
                <div className="flex-1 text-right">
                  <div className="text-sm font-black text-white">
                    {ar ? "فتح البريميوم" : "Unlock Premium"}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: PREMIUM_COLOR }}>
                    {status.season.premiumCost.toLocaleString()} SKZ
                  </div>
                </div>
                {unlockLoading ? (
                  <div className="w-5 h-5 rounded-full border-2 border-purple-300/30 border-t-purple-300 animate-spin shrink-0" />
                ) : (
                  <ArrowRight size={16} style={{ color: PREMIUM_COLOR, transform: ar ? "none" : "rotate(180deg)" }} />
                )}
              </motion.button>
            )}
            {status.premium && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full rounded-2xl p-3 flex items-center gap-3"
                style={{ background: "rgba(192,132,252,0.1)", border: "1px solid rgba(192,132,252,0.25)" }}
              >
                <Shield size={16} style={{ color: PREMIUM_COLOR }} />
                <span className="text-sm font-bold" style={{ color: PREMIUM_COLOR }}>
                  {ar ? "✓ البريميوم مفعّل — استمتع بكل المكافآت" : "✓ Premium Active — all rewards unlocked"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Tier List ── */}
          <div className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>

            {/* Column headers */}
            <div className="grid grid-cols-[3rem_1px_1fr_1px_1fr] bg-white/[0.03] border-b border-white/[0.06]">
              <div />
              <div className="bg-white/[0.06]" />
              <div className="py-2 text-center text-[10px] font-black tracking-wider"
                style={{ color: ACCENT }}>
                {ar ? "مجاني" : "FREE"}
              </div>
              <div className="bg-white/[0.06]" />
              <div className="py-2 text-center text-[10px] font-black tracking-wider"
                style={{ color: PREMIUM_COLOR }}>
                {ar ? "بريميوم" : "PREMIUM"}
              </div>
            </div>

            {tiers.map((t, idx) => {
              const isUnlocked = unlockedSet.has(t.tier);
              const fClaimed = claimedFreeSet.has(t.tier);
              const pClaimed = claimedPremiumSet.has(t.tier);

              return (
                <div key={t.tier}>
                  <div
                    className="grid grid-cols-[3rem_1px_1fr_1px_1fr]"
                    style={{
                      background: t.milestone ? MILESTONE_BG : (idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)"),
                      borderTop: idx > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    }}
                  >
                    {/* Tier badge */}
                    <div className="flex flex-col items-center justify-center py-3 gap-1">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black"
                        style={{
                          background: isUnlocked
                            ? t.milestone ? ACCENT : "rgba(245,181,10,0.2)"
                            : "rgba(255,255,255,0.06)",
                          color: isUnlocked
                            ? t.milestone ? "#0d0118" : ACCENT
                            : "rgba(255,255,255,0.2)",
                          border: t.milestone && isUnlocked ? "none" : "none",
                          boxShadow: isUnlocked && t.milestone ? `0 0 12px ${ACCENT}60` : "none",
                        }}
                      >
                        {t.tier}
                      </div>
                      {t.milestone && (
                        <div className="text-[8px] font-black" style={{ color: ACCENT, opacity: 0.7 }}>★</div>
                      )}
                    </div>

                    {/* Divider */}
                    <div style={{ background: "rgba(255,255,255,0.06)" }} />

                    {/* Free cell */}
                    <TierCell
                      tier={t}
                      track="free"
                      isUnlocked={isUnlocked}
                      isClaimed={fClaimed}
                      isPremiumUser={status.premium}
                      isSeasonActive={seasonActive}
                      onClaim={handleClaim}
                      loading={loading}
                    />

                    {/* Divider */}
                    <div style={{ background: "rgba(255,255,255,0.06)" }} />

                    {/* Premium cell */}
                    <TierCell
                      tier={t}
                      track="premium"
                      isUnlocked={isUnlocked}
                      isClaimed={pClaimed}
                      isPremiumUser={status.premium}
                      isSeasonActive={seasonActive}
                      onClaim={handleClaim}
                      loading={loading}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-bold text-white text-center whitespace-nowrap"
            style={{ background: "rgba(30,10,50,0.95)", border: "1px solid rgba(245,181,10,0.3)", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
