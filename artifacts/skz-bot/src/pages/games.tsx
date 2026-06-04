import { motion } from "framer-motion";
import { Trophy, Swords, Zap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const activeGames = [
  { id: 1, players: 42, prize: "2,100 SKZ", tier: "Gold" },
  { id: 2, players: 128, prize: "6,400 SKZ", tier: "Silver" },
];

const ticketTiers = [
  { name: "Bronze", price: 10, win: 50, color: "from-amber-700/40 to-amber-900/40", border: "border-amber-700/50", glow: "shadow-amber-500/20" },
  { name: "Silver", price: 50, win: 250, color: "from-slate-400/40 to-slate-600/40", border: "border-slate-400/50", glow: "shadow-slate-400/20" },
  { name: "Gold", price: 200, win: 1000, color: "from-yellow-400/30 to-yellow-600/30", border: "border-yellow-400/50", glow: "shadow-yellow-400/20" },
  { name: "Platinum", price: 500, win: 2500, color: "from-cyan-400/30 to-blue-600/30", border: "border-cyan-400/50", glow: "shadow-cyan-400/20" },
  { name: "Diamond", price: 1000, win: 10000, color: "from-violet-500/40 to-fuchsia-700/40", border: "border-violet-400/50", glow: "shadow-violet-500/30" },
];

export default function Games() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Arena</h1>
          <p className="text-sm text-muted-foreground mt-1">High stakes skill matches</p>
        </div>
        <div className="bg-card/50 backdrop-blur px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
          <Zap size={14} className="text-accent" />
          <span className="text-sm font-bold text-white">12.4k Online</span>
        </div>
      </div>

      {/* Currently Playing */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Live Matches</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x hide-scrollbar">
          {activeGames.map((game, i) => (
            <div key={i} className="min-w-[200px] snap-center bg-card/30 border border-white/5 rounded-2xl p-3 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-white bg-white/10 px-2 py-0.5 rounded">{game.tier}</span>
                <span className="flex items-center gap-1 text-xs text-red-400 font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live
                </span>
              </div>
              <div className="flex items-end justify-between mt-2">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground">Prize Pool</span>
                  <span className="text-sm font-bold text-primary">{game.prize}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users size={12} /> {game.players}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ticket Tiers */}
      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mt-2">Select Tier</h3>
        
        {ticketTiers.map((tier, i) => (
          <motion.div
            key={tier.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${tier.color} border ${tier.border} backdrop-blur-md p-4 shadow-lg ${tier.glow}`}
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Swords size={64} />
            </div>
            
            <div className="relative z-10 flex justify-between items-center">
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-bold text-white tracking-tight">{tier.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/80">Entry: <span className="font-bold text-white">{tier.price} SKZ</span></span>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10">
                  <Trophy size={12} className="text-primary" />
                  <span className="text-xs font-bold text-primary">Win {tier.win}</span>
                </div>
                <Button size="sm" className="bg-white text-black hover:bg-white/90 font-semibold rounded-xl h-8 px-4">
                  Enter
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
