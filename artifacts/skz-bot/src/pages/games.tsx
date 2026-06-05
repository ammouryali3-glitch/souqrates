import { motion } from "framer-motion";
import { Trophy, Swords, Zap, Users, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ACCENTS, ARENA_GAMES, SKILL_GAMES, type GameDef } from "@/lib/games-data";
import { useAdmin } from "@/lib/admin-store";

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

function ArenaCard({ game }: { game: GameDef }) {
  const a = ACCENTS[game.accent];
  const Icon = game.icon;
  return (
    <Link href={game.route}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }}
        data-testid={`card-arena-${game.id}`}
        className={`relative overflow-hidden rounded-3xl border ${a.border} ${a.card} p-5 shadow-lg ${a.glow} cursor-pointer group mb-3`}>
        <div className={`absolute -right-4 -top-4 opacity-15 ${a.bigIcon}`}><Icon size={110} strokeWidth={1.2} /></div>
        <div className="flex items-center justify-between mb-2 relative z-10">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] tracking-[0.3em] font-display uppercase ${a.text}`}>{game.tag}</span>
            <span className="flex items-center gap-1 text-[10px] text-yellow-400 font-medium"><div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" /> Live Pool</span>
          </div>
          <span className={`font-display font-black ${a.text} text-sm`}>{game.prize} SKZ</span>
        </div>
        <div className="flex items-end justify-between relative z-10">
          <div>
            <h2 className="font-display font-black text-2xl text-white uppercase">{game.title}</h2>
            <p className="text-xs text-white/50 mt-1 max-w-[200px]">{game.desc}</p>
          </div>
          <div className={`w-14 h-14 rounded-2xl ${a.iconWrap} flex items-center justify-center shrink-0`}><Icon size={26} className={a.iconText} /></div>
        </div>
        <div className={`flex items-center gap-2 mt-2 text-xs font-display font-bold ${a.text} relative z-10`}>
          <Trophy size={12} />الدخول: {game.entry} SKZ · {game.tagline}
          <ChevronRight size={13} className="ml-auto text-white/30 group-hover:translate-x-1 transition-transform" />
        </div>
      </motion.div>
    </Link>
  );
}

function SkillCard({ game }: { game: GameDef }) {
  const a = ACCENTS[game.accent];
  const Icon = game.icon;
  return (
    <Link href={game.route}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }}
        data-testid={`card-game-${game.id}`}
        className={`relative overflow-hidden rounded-3xl border ${a.border} ${a.card} p-5 shadow-lg ${a.glow} cursor-pointer group`}>
        <div className={`absolute -right-6 -top-6 opacity-20 group-hover:opacity-30 transition-opacity ${a.bigIcon}`}><Icon size={120} strokeWidth={1.2} /></div>
        <div className="flex flex-col gap-3 relative z-10">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] tracking-[0.3em] font-display uppercase ${a.text}`}>{game.category}</span>
            <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Playable</span>
          </div>
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="font-display font-black text-2xl text-white tracking-wide uppercase leading-none">{game.title}</h2>
              <p className="text-xs text-white/60 mt-1 max-w-[200px]">{game.desc}</p>
            </div>
            <div className={`w-14 h-14 rounded-2xl ${a.iconWrap} flex items-center justify-center shrink-0`}><Icon size={26} className={a.iconText} /></div>
          </div>
          <div className={`flex items-center gap-2 mt-1 text-xs font-display font-bold ${a.text} tracking-wide`}>
            <Trophy size={13} /> {game.tagline}
            <ChevronRight size={14} className="ml-auto text-white/40 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function Games() {
  const { gameOverrides, settings } = useAdmin();

  const applyOverride = (g: GameDef): GameDef | null => {
    const o = gameOverrides[g.id];
    if (o && o.enabled === false) return null;
    if (!o) return g;
    return {
      ...g,
      title: o.title ?? g.title,
      tagline: o.tagline ?? g.tagline,
      desc: o.desc ?? g.desc,
      prize: o.prize ?? g.prize,
      entry: o.entry ?? g.entry,
    };
  };

  // Featured (pinned) games float to the top of their section.
  const byFeatured = (a: GameDef, b: GameDef) =>
    (gameOverrides[b.id]?.featured ? 1 : 0) - (gameOverrides[a.id]?.featured ? 1 : 0);

  const arena = settings.arenaEnabled ? [...ARENA_GAMES].sort(byFeatured).map(applyOverride).filter(Boolean) as GameDef[] : [];
  const skill = settings.skillEnabled ? [...SKILL_GAMES].sort(byFeatured).map(applyOverride).filter(Boolean) as GameDef[] : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white tracking-wider uppercase">Arena</h1>
          <p className="text-sm text-muted-foreground mt-1">High stakes skill matches</p>
        </div>
        <div className="bg-card/50 backdrop-blur px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
          <Zap size={14} className="text-accent" />
          <span className="text-sm font-bold text-white">{settings.onlineCount} Online</span>
        </div>
      </div>

      {/* ── PRIZE POOL ARENA ── */}
      {arena.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-gradient-to-r from-yellow-500/40 to-transparent" />
            <span className="text-[10px] tracking-[0.4em] font-display uppercase text-yellow-400/70 flex items-center gap-1.5">
              <Trophy size={11} className="text-yellow-400" /> Prize Pool Arena
            </span>
            <div className="flex-1 h-px bg-gradient-to-l from-yellow-500/40 to-transparent" />
          </div>
          <p className="text-xs text-white/30 text-center mb-4 font-display">ادفع الدخول · حُلّ الأسرع · اربح الجائزة</p>
          {arena.map((g) => <ArenaCard key={g.id} game={g} />)}
        </div>
      )}

      {/* ── SKILL GAMES ── */}
      {skill.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/40 to-transparent" />
            <span className="text-[10px] tracking-[0.4em] font-display uppercase text-cyan-400/70 flex items-center gap-1.5">
              <Swords size={11} className="text-cyan-400" /> Skill Games
            </span>
            <div className="flex-1 h-px bg-gradient-to-l from-cyan-500/40 to-transparent" />
          </div>
          {skill.map((g) => <SkillCard key={g.id} game={g} />)}
        </div>
      )}

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
                <h3 className="text-xl font-display font-black text-white tracking-wide uppercase">{tier.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/80">Entry: <span className="font-display font-bold text-white tracking-wider">{tier.price} SKZ</span></span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10">
                  <Trophy size={12} className="text-primary" />
                  <span className="text-xs font-display font-bold text-primary tracking-wide">Win {tier.win}</span>
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
