import { motion } from "framer-motion";
import { ArrowRight, Trophy, Users, ShoppingBag, ArrowUpRight, Flame, Gamepad2, Coins, Gift, UserCircle2 } from "lucide-react";
import { Link } from "wouter";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Card } from "@/components/ui/card";
import { useAdmin, useBalance, admin } from "@/lib/admin-store";
import { useLang, t } from "@/lib/i18n";
import { useTelegramUser } from "@/lib/telegram-user";

export default function Home() {
  const { settings } = useAdmin();
  const skzBalance = useBalance();
  const lang = useLang();
  const s = t[lang];
  const canClaim = settings.dailyBonus > 0 && admin.canClaimDailyBonus();
  const { tgUser, inTelegram } = useTelegramUser();

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
              PREMIUM
            </span>
          )}
        </motion.div>
      )}

      {/* Daily bonus */}
      {canClaim && (
        <motion.button
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => admin.claimDailyBonus()}
          className="flex items-center gap-3 p-3 rounded-2xl border text-right"
          style={{ borderColor: `${settings.accent}55`, background: `linear-gradient(135deg, ${settings.accent}22, transparent)` }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: `${settings.accent}30`, color: settings.accent }}>
            <Gift size={20} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-display font-bold text-white">{s.dailyBonus}</div>
            <div className="text-[11px] text-muted-foreground">{s.dailyBonusSub(settings.dailyBonus, skzBalance)}</div>
          </div>
          <ArrowRight size={16} style={{ color: settings.accent }} />
        </motion.button>
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
          <div className="flex items-center gap-2 relative">
            <span className="text-5xl font-display font-bold tracking-tight text-white drop-shadow-[0_0_15px_rgba(212,175,55,0.6)]">
              <NumberTicker value={skzBalance} decimals={0} />
            </span>
            <span className="text-xl font-display font-black text-primary mt-3 tracking-widest drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]">SKZ</span>
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
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

      {/* Stats — zeros until real data flows in */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-card/40 backdrop-blur-md border-white/5 p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Trophy size={14} className="text-primary" />
            <span className="text-xs font-medium">{s.totalWon}</span>
          </div>
          <span className="text-lg font-display font-bold text-white">— SKZ</span>
        </Card>
        <Card className="bg-card/40 backdrop-blur-md border-white/5 p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users size={14} className="text-accent" />
            <span className="text-xs font-medium">{s.network}</span>
          </div>
          <span className="text-lg font-display font-bold text-white">0 {s.refs}</span>
        </Card>
      </div>

      {/* Activity Feed — empty state until backend feeds real events */}
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

        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50 gap-2">
          <ArrowUpRight size={28} className="opacity-30" />
          <span className="text-xs">{s.noActivity}</span>
        </div>
      </div>
    </div>
  );
}
