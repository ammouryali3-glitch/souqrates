import { useState } from "react";
import { motion } from "framer-motion";
import { Share2, Users, Network, TrendingUp, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/lib/admin-store";
import { useLang, t } from "@/lib/i18n";

export default function Referrals() {
  const [copied, setCopied] = useState(false);
  const { referralLevels } = useAdmin();
  const lang = useLang();
  const s = t[lang];

  const inviteLink = "t.me/skzbot?start=ref_xxx";

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">{s.syndicateTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">{s.syndicateDesc}</p>
      </div>

      {/* Hero Stats — zeroed until real backend */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{s.totalEarned}</span>
          <span className="text-2xl font-bold text-primary">0</span>
          <span className="text-[10px] text-white/50">{s.allTime}</span>
        </div>
        <div className="bg-card/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-1 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 text-accent/10">
            <TrendingUp size={64} />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{s.thisMonth}</span>
          <span className="text-2xl font-bold text-white">0</span>
          <span className="text-[10px] text-muted-foreground">SKZ</span>
        </div>
      </div>

      {/* Invite Link */}
      <div className="bg-accent/10 border border-accent/20 rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent">
            <Share2 size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{s.inviteLink}</h3>
            <p className="text-xs text-accent/80">{s.inviteSub}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 bg-black/40 border border-accent/20 rounded-xl px-3 py-3 text-sm font-mono text-white/80 truncate">
            {inviteLink}
          </div>
          <Button onClick={copyLink} className="bg-accent hover:bg-accent/90 text-white rounded-xl px-4">
            {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
          </Button>
        </div>
      </div>

      {/* Network Tiers — from admin config, real commissions */}
      <div className="flex flex-col gap-3 mt-2">
        <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2">
          <Network size={16} className="text-muted-foreground" />
          {s.networkTiers}
        </h3>

        <div className="flex flex-col gap-3">
          {referralLevels.filter(l => l.enabled).map((level, i) => (
            <motion.div
              key={level.level}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-card/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden group"
            >
              <div className="flex justify-between items-center z-10">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm z-10
                    ${level.level === 1 ? 'bg-primary/20 text-primary border border-primary/30' :
                      level.level === 2 ? 'bg-white/10 text-white/80 border border-white/20' :
                      'bg-white/5 text-white/50 border border-white/10'}`}
                  >
                    L{level.level}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">{s.tier} {level.level}</span>
                    <span className="text-[10px] text-muted-foreground">{level.commission}% {s.commission}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Users size={10} /> 0 {s.active}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-white/5 mt-1 z-10">
                <span className="text-xs text-muted-foreground">{s.generatedRevenue}</span>
                <span className="text-sm font-bold text-primary">0 {level.currency}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
