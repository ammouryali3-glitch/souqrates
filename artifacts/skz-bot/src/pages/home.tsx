import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Users, ShoppingBag, Coins,
  ArrowUpRight, ArrowDownLeft, Flame, Gamepad2,
  CheckCircle2, UserCircle2, CalendarCheck, ArrowRight,
  TrendingUp, Target,
} from "lucide-react";
import { Link } from "wouter";
import { NumberTicker } from "@/components/ui/number-ticker";
import { useAdmin, useBalance, admin } from "@/lib/admin-store";
import { useLang, t, type Strings } from "@/lib/i18n";
import { useTelegramUser } from "@/lib/telegram-user";
import {
  fetchCheckinStatus, claimCheckin, fetchUserStats, fetchUserActivity,
  type CheckinStatus, type ActivityItem, type UserStats,
} from "@/lib/user-api";
import { ProgressionCard } from "@/components/progression-card";
import { refreshProgression } from "@/lib/progression";
import { refreshQuests, useClaimableCount } from "@/lib/quests";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { sfx } from "@/lib/sound";

const HOME_CACHE_TTL = 5 * 60 * 1000;
interface HomeCache {
  ts: number;
  checkin: CheckinStatus | null;
  stats: UserStats | null;
  activity: ActivityItem[];
}
let _homeCache: HomeCache | null = null;

function reasonLabel(reason: string, s: Strings): string {
  const map: Record<string, string> = {
    game_win: s.activityReasonGameWin,
    game_fee: s.activityReasonGameFee,
    withdrawal: s.activityReasonWithdrawal,
    purchase: s.activityReasonPurchase,
    daily_checkin: s.activityReasonCheckin,
    referral: s.activityReasonReferral,
    deposit: s.activityReasonDeposit,
    prize: s.activityReasonPrize,
    starting_balance: s.activityReasonStarting,
    refund: s.activityReasonRefund,
  };
  return map[reason] ?? reason;
}

function timeAgo(dateStr: string, s: Strings): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return s.timeAgoNow;
  if (diff < 3_600_000) return s.timeAgoMinutes(Math.floor(diff / 60_000));
  if (diff < 86_400_000) return s.timeAgoHours(Math.floor(diff / 3_600_000));
  return s.timeAgoDays(Math.floor(diff / 86_400_000));
}

export default function Home() {
  const { settings } = useAdmin();
  const skzBalance = useBalance();
  const lang = useLang();
  const s = t[lang];
  const { tgUser, inTelegram, loading: balanceLoading } = useTelegramUser();

  const [checkin, setCheckin] = useState<CheckinStatus | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState<{ reward: number; streak: number } | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    // Progression is cheap and changes after every game/check-in, so refresh
    // it on each home mount rather than caching it with the 5-min home cache.
    refreshProgression();
    const now = Date.now();
    if (_homeCache && now - _homeCache.ts < HOME_CACHE_TTL) {
      setCheckin(_homeCache.checkin);
      setCheckinLoading(false);
      if (_homeCache.stats) setStats(_homeCache.stats);
      setActivity(_homeCache.activity);
      return;
    }
    Promise.all([fetchCheckinStatus(), fetchUserStats(), fetchUserActivity()]).then(([ci, st, act]) => {
      _homeCache = { ts: Date.now(), checkin: ci, stats: st, activity: act };
      setCheckin(ci);
      setCheckinLoading(false);
      if (st) setStats(st);
      setActivity(act);
    });
  }, []);

  // Keep the missions badge fresh whenever home mounts.
  useEffect(() => { refreshQuests(); }, []);

  const handleCheckin = async () => {
    if (claiming || checkin?.checkedInToday) return;
    setClaiming(true);
    const result = await claimCheckin();
    if (result.ok && result.reward !== undefined && result.streak !== undefined) {
      setClaimed({ reward: result.reward, streak: result.streak });
      hapticSuccess();
      sfx.coin();
      const newCheckin = { checkedInToday: true, streak: result.streak, nextReward: checkin?.nextReward ?? 50 };
      setCheckin(newCheckin);
      if (result.newSkz !== undefined) admin.setBalance(result.newSkz);
      fetchUserActivity().then((act) => {
        setActivity(act);
        if (_homeCache) _homeCache = { ..._homeCache, checkin: newCheckin, activity: act, ts: Date.now() };
      });
      // Check-in awards XP server-side; refresh so a level-up can surface.
      refreshProgression();
    } else {
      hapticError();
    }
    setClaiming(false);
  };

  const accent = settings.accent || "#c9a227";

  return (
    <div className="flex flex-col gap-5">

      {/* ── User identity strip ──────────────────────────────────────── */}
      {inTelegram && tgUser && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-1 mt-1"
        >
          {tgUser.photo_url ? (
            <img
              src={tgUser.photo_url}
              alt={tgUser.first_name}
              className="w-11 h-11 rounded-full object-cover shrink-0"
              style={{ border: `2px solid ${accent}60`, boxShadow: `0 0 12px ${accent}30` }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `${accent}20`, border: `2px solid ${accent}40` }}
            >
              <UserCircle2 size={22} style={{ color: accent }} />
            </div>
          )}
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[15px] font-bold text-white truncate leading-tight">
              {tgUser.first_name}{tgUser.last_name ? ` ${tgUser.last_name}` : ""}
            </span>
            {tgUser.username && (
              <span className="text-[11px] text-white/35 truncate leading-tight">@{tgUser.username}</span>
            )}
          </div>
          {tgUser.is_premium && (
            <span
              className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 font-display tracking-wider"
              style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}40` }}
            >
              {s.premiumBadge}
            </span>
          )}
        </motion.div>
      )}

      {/* ── Progression: league badge + XP bar ─────────────────────────── */}
      <ProgressionCard />

      {/* ── Balance Hero Card ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="relative overflow-hidden rounded-3xl p-6"
        style={{
          background: "linear-gradient(135deg, rgba(201,162,39,0.18) 0%, rgba(120,40,200,0.12) 50%, rgba(10,8,20,0.9) 100%)",
          border: "1px solid rgba(201,162,39,0.25)",
          boxShadow: "0 8px 40px rgba(201,162,39,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        {/* Ambient radials */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)` }} />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(120,40,200,0.15) 0%, transparent 70%)" }} />

        <p className="text-xs text-white/40 font-display tracking-[0.2em] uppercase mb-1 relative z-10">{s.totalBalance}</p>

        <div className="flex items-end gap-2 mb-5 relative z-10">
          {balanceLoading ? (
            <div className="h-14 w-40 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.08)" }} />
          ) : (
            <>
              <span
                className="text-[52px] font-display font-black leading-none"
                style={{
                  background: `linear-gradient(135deg, #fff 40%, ${accent})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 0 20px rgba(212,175,55,0.3))",
                }}
              >
                <NumberTicker value={skzBalance} decimals={0} />
              </span>
              <span
                className="text-xl font-display font-black mb-2 tracking-widest"
                style={{ color: accent }}
              >
                SKZ
              </span>
            </>
          )}
        </div>

        {/* Quick action pills inside hero */}
        <div className={`flex gap-2 relative z-10 transition-opacity duration-300 ${balanceLoading ? "opacity-30 pointer-events-none" : ""}`}>
          <Link href="/games" className="flex-1">
            <div
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-display font-bold tracking-wide active:scale-95 transition-transform"
              style={{ background: "rgba(138,80,255,0.2)", border: "1px solid rgba(138,80,255,0.3)", color: "#a78bfa" }}
            >
              <Gamepad2 size={13} /> {s.play}
            </div>
          </Link>
          <Link href="/shop" className="flex-1">
            <div
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-display font-bold tracking-wide active:scale-95 transition-transform"
              style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa" }}
            >
              <ShoppingBag size={13} /> {s.shop}
            </div>
          </Link>
          <Link href="/wallet" className="flex-1">
            <div
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-display font-bold tracking-wide active:scale-95 transition-transform"
              style={{ background: "rgba(201,162,39,0.15)", border: "1px solid rgba(201,162,39,0.3)", color: accent }}
            >
              <Coins size={13} /> {s.wallet}
            </div>
          </Link>
        </div>
      </motion.div>

      {/* ── Daily Check-In ────────────────────────────────────────────── */}
      {!checkinLoading && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <AnimatePresence mode="wait">
            {claimed ? (
              <motion.div
                key="claimed"
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-4 p-4 rounded-2xl"
                style={{
                  background: `linear-gradient(135deg, ${accent}20, rgba(74,222,128,0.08))`,
                  border: `1px solid ${accent}40`,
                }}
              >
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: `${accent}25` }}>
                  <CheckCircle2 size={22} style={{ color: accent }} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-display font-black text-white">+{claimed.reward.toLocaleString()} SKZ</div>
                  <div className="text-[11px] text-white/40 mt-0.5">{s.checkinDone(claimed.streak)}</div>
                </div>
              </motion.div>
            ) : checkin?.checkedInToday ? (
              <motion.div
                key="done"
                className="flex items-center gap-4 p-4 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 bg-white/10">
                  <CalendarCheck size={20} className="text-white/50" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white/70">{s.checkin}</div>
                  <div className="text-[11px] text-white/30 mt-0.5">{s.checkinDone(checkin.streak)}</div>
                </div>
                {checkin.streak > 0 && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full font-display"
                    style={{ background: `${accent}18`, color: accent }}>
                    🔥 {checkin.streak}
                  </span>
                )}
              </motion.div>
            ) : (
              <motion.button
                key="claim"
                onClick={handleCheckin}
                disabled={claiming}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl text-right disabled:opacity-50 active:scale-[0.98] transition-transform"
                style={{
                  background: `linear-gradient(135deg, ${accent}18, rgba(138,80,255,0.1))`,
                  border: `1px solid ${accent}45`,
                  boxShadow: `0 4px 20px ${accent}15`,
                }}
              >
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: `${accent}25` }}>
                  {claiming
                    ? <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: `${accent}40`, borderTopColor: accent }} />
                    : <CalendarCheck size={20} style={{ color: accent }} />}
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-display font-black text-white">{s.checkin}</div>
                  <div className="text-[11px] text-white/40 mt-0.5">{s.checkinClaim(checkin?.nextReward ?? 50)}</div>
                </div>
                <ArrowRight size={16} style={{ color: accent }} />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Missions entry ────────────────────────────────────────────── */}
      <MissionsEntry accent={accent} s={s} />

      {/* ── Stats Row ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-2 gap-3"
      >
        <div
          className="flex flex-col gap-2 p-4 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-1.5">
            <Trophy size={13} style={{ color: accent }} />
            <span className="text-[10px] text-white/40 font-medium tracking-wide uppercase">{s.totalWon}</span>
          </div>
          {stats ? (
            <span className="text-lg font-display font-black text-white">{stats.totalWon.toLocaleString()} <span className="text-xs font-normal text-white/40">SKZ</span></span>
          ) : (
            <div className="h-6 w-20 rounded-lg animate-pulse bg-white/8" />
          )}
        </div>
        <div
          className="flex flex-col gap-2 p-4 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-1.5">
            <Users size={13} className="text-violet-400" />
            <span className="text-[10px] text-white/40 font-medium tracking-wide uppercase">{s.network}</span>
          </div>
          {stats ? (
            <span className="text-lg font-display font-black text-white">{stats.refCount} <span className="text-xs font-normal text-white/40">{s.refs}</span></span>
          ) : (
            <div className="h-6 w-16 rounded-lg animate-pulse bg-white/8" />
          )}
        </div>
      </motion.div>

      {/* ── Activity Feed ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col gap-3 pb-2"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-display font-bold tracking-[0.15em] uppercase text-white/50 flex items-center gap-2">
            <Flame size={13} className="text-orange-400" />
            {s.liveActivity}
          </h3>
          <Link href="/wallet">
            <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: accent }}>
              {s.viewAll} <ArrowRight size={11} />
            </span>
          </Link>
        </div>

        {activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3"
            style={{ background: "rgba(255,255,255,0.02)", borderRadius: "1rem", border: "1px solid rgba(255,255,255,0.05)" }}>
            <TrendingUp size={28} className="text-white/15" />
            <span className="text-xs text-white/25">{s.noActivity}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {activity.slice(0, 5).map((item, i) => {
              const isCredit = item.type === "credit";
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.22 + i * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={isCredit
                      ? { background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.2)" }
                      : { background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.2)" }}
                  >
                    {isCredit
                      ? <ArrowDownLeft size={14} className="text-green-400" />
                      : <ArrowUpRight size={14} className="text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-white/85 truncate">{reasonLabel(item.reason, s)}</div>
                    <div className="text-[10px] text-white/30 mt-0.5">{timeAgo(item.createdAt, s)}</div>
                  </div>
                  <span
                    className="text-[13px] font-display font-black tabular-nums"
                    style={{ color: isCredit ? "#4ade80" : "#f87171" }}
                  >
                    {isCredit ? "+" : "-"}{item.amount.toLocaleString()}
                    <span className="text-[10px] font-normal ml-0.5 opacity-60">SKZ</span>
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function MissionsEntry({ accent, s }: { accent: string; s: Strings }) {
  const claimable = useClaimableCount();
  return (
    <Link href="/missions">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        whileTap={{ scale: 0.98 }}
        className="w-full flex items-center gap-4 p-4 rounded-2xl cursor-pointer active:scale-[0.98] transition-transform"
        style={{
          background: claimable > 0
            ? `linear-gradient(135deg, ${accent}20, rgba(138,80,255,0.12))`
            : "rgba(255,255,255,0.04)",
          border: claimable > 0 ? `1px solid ${accent}45` : "1px solid rgba(255,255,255,0.07)",
          boxShadow: claimable > 0 ? `0 4px 20px ${accent}15` : "none",
        }}
      >
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: `${accent}22` }}>
          <Target size={20} style={{ color: accent }} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-display font-black text-white">{s.missionsTitle}</div>
          <div className="text-[11px] text-white/40 mt-0.5">{s.missionsSubtitle}</div>
        </div>
        {claimable > 0 && (
          <span className="text-[11px] font-display font-black px-2.5 py-1 rounded-full shrink-0"
            style={{ background: accent, color: "#1a1206" }}>
            {claimable}
          </span>
        )}
        <ArrowRight size={16} style={{ color: accent }} />
      </motion.div>
    </Link>
  );
}
