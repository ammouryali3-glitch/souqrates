import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Trophy, Users, ShoppingBag, ArrowUpRight, Flame, Gamepad2, Coins } from "lucide-react";
import { Link } from "wouter";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const recentActivity = [
  { id: 1, type: "win", title: "Won Diamond Match", amount: "+10,000", time: "2m ago" },
  { id: 2, type: "purchase", title: "Bought Pro Trading Course", amount: "-500", time: "1h ago" },
  { id: 3, type: "referral", title: "Referral Commission", amount: "+15", time: "3h ago" },
  { id: 4, type: "deposit", title: "USDT Deposit", amount: "+2,500", time: "1d ago" },
];

export default function Home() {
  const [balance] = useState(12450.75);

  return (
    <div className="flex flex-col gap-6">
      {/* Header / Balance */}
      <div className="flex flex-col items-center justify-center mt-6 mb-2">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.8 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
          <h2 className="text-muted-foreground text-sm font-medium tracking-widest uppercase mb-1 text-center">Total Balance</h2>
          <div className="flex items-center gap-2 relative">
            <span className="text-5xl font-bold tracking-tight text-white drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]">
              <NumberTicker value={balance} decimals={2} />
            </span>
            <span className="text-xl font-bold text-primary mt-3">SKZ</span>
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
            <span className="text-xs font-medium text-foreground">Play</span>
          </div>
        </Link>
        <Link href="/shop" className="group">
          <div className="flex flex-col items-center justify-center bg-card/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 gap-2 transition-all hover:bg-card/60 hover:border-primary/30">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShoppingBag size={20} />
            </div>
            <span className="text-xs font-medium text-foreground">Shop</span>
          </div>
        </Link>
        <Link href="/wallet" className="group">
          <div className="flex flex-col items-center justify-center bg-card/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 gap-2 transition-all hover:bg-card/60 hover:border-primary/30">
            <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Coins size={20} />
            </div>
            <span className="text-xs font-medium text-foreground">Wallet</span>
          </div>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-card/40 backdrop-blur-md border-white/5 p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Trophy size={14} className="text-primary" />
            <span className="text-xs font-medium">Total Won</span>
          </div>
          <span className="text-lg font-bold text-white">45,200 SKZ</span>
        </Card>
        <Card className="bg-card/40 backdrop-blur-md border-white/5 p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users size={14} className="text-accent" />
            <span className="text-xs font-medium">Network</span>
          </div>
          <span className="text-lg font-bold text-white">22 Refs</span>
        </Card>
      </div>

      {/* Activity Feed */}
      <div className="flex flex-col gap-3 mt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2">
            <Flame size={16} className="text-orange-500" />
            LIVE ACTIVITY
          </h3>
          <Link href="/wallet" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
            View All <ArrowRight size={12} />
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          {recentActivity.map((activity, i) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center justify-between p-3 rounded-xl bg-card/30 border border-white/5"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  activity.type === 'win' ? 'bg-primary/20 text-primary' :
                  activity.type === 'purchase' ? 'bg-blue-500/20 text-blue-400' :
                  activity.type === 'deposit' ? 'bg-green-500/20 text-green-400' :
                  'bg-accent/20 text-accent'
                }`}>
                  {activity.type === 'win' ? <Trophy size={14} /> :
                   activity.type === 'purchase' ? <ShoppingBag size={14} /> :
                   activity.type === 'deposit' ? <ArrowUpRight size={14} /> :
                   <Users size={14} />}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white">{activity.title}</span>
                  <span className="text-[10px] text-muted-foreground">{activity.time}</span>
                </div>
              </div>
              <span className={`text-sm font-bold ${activity.amount.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                {activity.amount}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
