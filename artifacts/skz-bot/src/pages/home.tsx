import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Trophy, Users, ShoppingBag, Coins,
  ArrowUpRight, ArrowDownLeft, Flame, Gamepad2,
  CheckCircle2, UserCircle2, CalendarCheck,
} from "lucide-react";
import { Link } from "wouter";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Card } from "@/components/ui/card";
import { useAdmin, useBalance, admin } from "@/lib/admin-store";
import { useLang, t, type Strings } from "@/lib/i18n";
import { useTelegramUser } from "@/lib/telegram-user";
import {
  fetchCheckinStatus, claimCheckin, fetchUserStats, fetchUserActivity,
  type CheckinStatus, type ActivityItem, type UserStats,
} from "@/lib/user-api";

// ── Activity reason → i18n label ─────────────────────────────────────────────
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

// ── Component ─────────────────────────────────────────────────────────────────

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
    fetchCheckinStatus().then((status) => {
      setCheckin(status);
      setCheckinLoading(false);
    });
    fetchUserStats().then((s) => { if (s) setStats(s); });
    fetchUserActivity().then(setActivity);
  }, []);

  const handleCheckin = async () => {
    if (claiming || checkin?.checkedInToday) return;
    setClaiming(true);
    const result = await claimCheckin();
    if (result.ok && result.reward !== undefined && result.streak !== undefined) {
      setClaimed({ reward: result.reward, streak: result.streak });
      setCheckin({ checkedInToday: true, streak: result.streak, nextReward: checkin?.nextReward ?? 50 });
      if (result.newSkz !== undefined) admin.setBalance(result.newSkz);
      // Refresh activity after checkin
      fetchUserActivity().then(setActivity);
    }
    setClaiming(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Brand header */}
      <div className="flex flex-col items-center text-center mt-4 -mb-2">
        <h1
          className="text-xl font-display font-black tracking-wide"
          style={{ color: settings.accent, textShadow: `0 0 16px ${settings.accent}66` }}
        >
          {settings.appName}
        </h1>
        {settings.welcomeMessage && (
          <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">{settings.welcomeMessage}</p>
        )}
      </div>

      {/* Player identity */}
      {inTelegram && tgUser && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-1"
        >
          {tgUser.photo_url ? (
            <img
              src={tgUser.photo_url}
              alt={tgUser.first_name}
              className="w-10 h-10 rounded-full object-cover shrink-0"
              style={{ border: `2px solid ${settings.accent}55` }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `${settings.accent}22`, color: settings.accent }}
            >
              <UserCircle2 size={22} />
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-white truncate leading-tight">
              {tgUser.first_name}{tgUser.last_name ? ` ${tgUser.last_name}` : ""}
            </span>
            {tgUser.username && (
              <span className="text-[11px] text-muted-foreground truncate leading-tight">@{tgUser.username}</span>
            )}
          </div>
          {tgUser.is_premium && (
            <span
              className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{ background: `${settings.accent}22`, color: settings.accent }}
            >
              {s.premiumBadge}
            </span>
          )}
        </motion.div>
      )}

      {/* Daily Check-In Card */}
      {!checkinLoading && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <AnimatePresence mode="wait">
            {claimed ? (
              <motion.div
                key="claimed"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-3 p-3 rounded-2xl border"
                style={{ borderColor: `${settings.accent}55`, background: `linear-gradient(135deg, ${settings.accent}22, transparent)` }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: `${settings.accent}30`, color: settings.accent }}>
                  <CheckCircle2 size={20} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-display font-bold text-white">+{claimed.reward.toLocaleString()} SKZ</div>
                  <div className="text-[11px] text-muted-foreground">{s.checkinDone(claimed.streak)}</div>
                </div>
              </motion.div>
            ) : checkin?.checkedInToday ? (
              <motion.div
                key="done"
                className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-card/30"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-white/10 text-muted-foreground">
                  <CalendarCheck size={20} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{s.checkin}</div>
                  <div className="text-[11px] text-muted-foreground">{s.checkinDone(checkin.streak)}</div>
                </div>
                {checkin.streak > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${settings.accent}22`, color: settings.accent }}>
                    {s.checkinStreak(checkin.streak)}
                  </span>
                )}
              </motion.div>
            ) : (
              <motion.button
                key="claim"
                onClick={handleCheckin}
                disabled={claiming}
                whileTap={{ scale: 0.97 }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border text-right disabled:opacity-60"
                style={{ borderColor: `${settings.accent}55`, background: `linear-gradient(135deg, ${settings.accent}22, transparent)` }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: `${settings.accent}30`, color: settings.accent }}>
                  {claiming ? (
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CalendarCheck size={20} />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-display font-bold text-white">{s.checkin}</div>
                  <div className="text-[11px] text-muted-foreground">{s.checkinClaim(checkin?.nextReward ?? 50)}</div>
                </div>
                <ArrowRight size={16} style={{ color: settings.accent }} />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Balance */}
      <div className="flex flex-col items-center justify-center mt-2 mb-2">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.8 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
          <h2 className="text-muted-foreground text-sm font-medium tracking-widest uppercase mb-1 text-center">{s.totalBalance}</h2>
          <div className="flex items-center gap-2 relative justify-center">
            {balanceLoading ? (
              <div className="h-12 w-36 rounded-xl bg-white/10 animate-pulse" />
            ) : (
              <span className="text-5xl font-display font-bold tracking-tight text-white drop-shadow-[0_0_15px_rgba(212,175,55,0.6)]">
                <NumberTicker value={skzBalance} decimals={0} />
              </span>
            )}
            <span className="text-xl font-display font-black text-primary mt-3 tracking-widest drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]">SKZ</span>
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <div className={`grid grid-cols-3 gap-3 transition-opacity duration-300 ${balanceLoading ? "opacity-40 pointer-events-none" : ""}`}>
        <Link href="/games" className="group">
          <div className="flex flex-col items-center justify-center bg-card/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 gap-2 transition-all hover:bg-card/60 hover:border-primary/30">
            <div className="w-10 h-10 rounded-full bg-accent/20 text-accent flex items-center justify-center group-hover:scale-110 transition-transform">
              <Gamepad2 size={20} />
            </div>
            <span className="text-xs font-medium text-foreground">{s.play}</span>
          </div>
        </Link>
        <Link href="/shop" className="group">
          <div className="flex flex-col items-center justify-center bg-card/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 gap-2 transition-all hover:bg-card/60 hover:border-primary/30">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShoppingBag size={20} />
            </div>
            <span className="text-xs font-medium text-foreground">{s.shop}</span>
          </div>
        </Link>
        <Link href="/wallet" className="group">
          <div className="flex flex-col items-center justify-center bg-card/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 gap-2 transition-all hover:bg-card/60 hover:border-primary/30">
            <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Coins size={20} />
            </div>
            <span className="text-xs font-medium text-foreground">{s.wallet}</span>
          </div>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-card/40 backdrop-blur-md border-white/5 p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Trophy size={14} className="text-primary" />
            <span className="text-xs font-medium">{s.totalWon}</span>
          </div>
          {stats ? (
            <span className="text-lg font-display font-bold text-white">
              {stats.totalWon.toLocaleString()} SKZ
            </span>
          ) : (
            <div className="h-6 w-20 rounded bg-white/10 animate-pulse" />
          )}
        </Card>
        <Card className="bg-card/40 backdrop-blur-md border-white/5 p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users size={14} className="text-accent" />
            <span className="text-xs font-medium">{s.network}</span>
          </div>
          {stats ? (
            <span className="text-lg font-display font-bold text-white">
              {stats.refCount} {s.refs}
            </span>
          ) : (
            <div className="h-6 w-16 rounded bg-white/10 animate-pulse" />
          )}
        </Card>
      </div>

      {/* Activity Feed */}
      <div className="flex flex-col gap-3 mt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2">
            <Flame size={16} className="text-orange-500" />
            {s.liveActivity.toUpperCase()}
          </h3>
          <Link href="/wallet" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
            {s.viewAll} <ArrowRight size={12} />
          </Link>
        </div>

        {activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50 gap-2">
            <ArrowUpRight size={28} className="opacity-30" />
            <span className="text-xs">{s.noActivity}</span>
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
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 bg-card/30 border border-white/5 rounded-xl p-3"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isCredit ? "bg-green-500/15" : "bg-red-500/15"}`}>
                    {isCredit
                      ? <ArrowDownLeft size={14} className="text-green-400" />
                      : <ArrowUpRight size={14} className="text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{reasonLabel(item.reason, s)}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(item.createdAt, s)}</div>
                  </div>
                  <span className={`text-sm font-bold font-mono ${isCredit ? "text-green-400" : "text-red-400"}`}>
                    {isCredit ? "+" : "-"}{item.amount.toLocaleString()} SKZ
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
