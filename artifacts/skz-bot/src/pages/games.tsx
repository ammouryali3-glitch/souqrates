import { motion } from "framer-motion";
import { Trophy, Swords, Zap, Users, Layers, Play, ChevronRight, Orbit, Sword, Scissors, Circle, GitBranch, Music2, Cpu, Sparkles, Rocket, Grid2x2, ArrowUp, Crosshair, Hammer, Link2, Scale, BoltIcon } from "lucide-react";
import { Link } from "wouter";
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
          <h1 className="text-2xl font-display font-bold text-white tracking-wider uppercase">Arena</h1>
          <p className="text-sm text-muted-foreground mt-1">High stakes skill matches</p>
        </div>
        <div className="bg-card/50 backdrop-blur px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
          <Zap size={14} className="text-accent" />
          <span className="text-sm font-bold text-white">12.4k Online</span>
        </div>
      </div>

      {/* Featured Skill Game */}
      <Link href="/games/stack">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          data-testid="card-game-stack"
          className="relative overflow-hidden rounded-3xl border border-accent/40 bg-gradient-to-br from-accent/30 via-primary/10 to-background p-5 shadow-lg shadow-accent/20 cursor-pointer group"
        >
          <div className="absolute -right-6 -top-6 opacity-20 group-hover:opacity-30 transition-opacity">
            <Layers size={120} strokeWidth={1.2} />
          </div>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.25),transparent_60%)]" />

          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-display tracking-[0.3em] text-accent uppercase">New · Skill</span>
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Playable
              </span>
            </div>

            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-display font-black text-2xl text-white tracking-wide uppercase leading-none">Stack & Match</h2>
                <p className="text-xs text-white/60 mt-1 max-w-[200px]">Drop blocks, chain perfect combos, build the tallest tower.</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-[0_0_25px_rgba(212,175,55,0.5)] shrink-0">
                <Play size={26} className="text-black fill-black ml-0.5" />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-1 text-xs font-display font-bold text-primary tracking-wide">
              <Trophy size={13} /> Earn up to 5 SKZ per block
              <ChevronRight size={14} className="ml-auto text-white/40 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </Link>

      {/* Featured: Orbit Dash */}
      <Link href="/games/orbit">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          data-testid="card-game-orbit"
          className="relative overflow-hidden rounded-3xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/20 via-violet-600/10 to-background p-5 shadow-lg shadow-cyan-500/20 cursor-pointer group"
        >
          <div className="absolute -right-6 -top-6 opacity-20 group-hover:opacity-30 transition-opacity text-cyan-300">
            <Orbit size={120} strokeWidth={1.2} />
          </div>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.25),transparent_60%)]" />

          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-display tracking-[0.3em] text-cyan-300 uppercase">New · Skill</span>
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Playable
              </span>
            </div>

            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-display font-black text-2xl text-white tracking-wide uppercase leading-none">Orbit Dash</h2>
                <p className="text-xs text-white/60 mt-1 max-w-[200px]">Jump between orbits, grab the crystals, dodge the counter-spin.</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-400 to-violet-500 flex items-center justify-center shadow-[0_0_25px_rgba(34,211,238,0.5)] shrink-0">
                <Play size={26} className="text-black fill-black ml-0.5" />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-1 text-xs font-display font-bold text-cyan-300 tracking-wide">
              <Trophy size={13} /> Neon crystal hunt
              <ChevronRight size={14} className="ml-auto text-white/40 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </Link>

      {/* Featured: Knife Master */}
      <Link href="/games/knife">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          data-testid="card-game-knife"
          className="relative overflow-hidden rounded-3xl border border-amber-800/50 bg-gradient-to-br from-amber-900/30 via-yellow-900/10 to-background p-5 shadow-lg shadow-amber-900/30 cursor-pointer group"
        >
          <div className="absolute -right-6 -top-6 opacity-20 group-hover:opacity-30 transition-opacity text-amber-600">
            <Sword size={120} strokeWidth={1.2} />
          </div>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,rgba(180,100,20,0.22),transparent_60%)]" />

          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-display tracking-[0.3em] text-amber-400 uppercase">New · Skill</span>
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Playable
              </span>
            </div>

            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-display font-black text-2xl text-white tracking-wide uppercase leading-none">Knife Master</h2>
                <p className="text-xs text-white/60 mt-1 max-w-[200px]">Throw knives into the spinning disc — never hit the blade.</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-700 to-yellow-500 flex items-center justify-center shadow-[0_0_25px_rgba(180,100,20,0.55)] shrink-0">
                <Sword size={26} className="text-white" />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-1 text-xs font-display font-bold text-amber-400 tracking-wide">
              <Trophy size={13} /> Grab apples for bonus time
              <ChevronRight size={14} className="ml-auto text-white/40 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </Link>

      {/* Perfect Slice */}
      <Link href="/games/slice">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          data-testid="card-game-slice"
          className="relative overflow-hidden rounded-3xl border border-teal-700/50 bg-gradient-to-br from-teal-900/30 via-cyan-900/10 to-background p-5 shadow-lg shadow-teal-900/30 cursor-pointer group"
        >
          <div className="absolute -right-6 -top-6 opacity-20 group-hover:opacity-30 transition-opacity text-teal-500">
            <Scissors size={120} strokeWidth={1.2} />
          </div>

          <div className="flex flex-col gap-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.3em] font-display uppercase text-teal-400/80">
                Game 4
              </span>
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Playable
              </span>
            </div>

            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-display font-black text-2xl text-white tracking-wide uppercase leading-none">Perfect Slice</h2>
                <p className="text-xs text-white/60 mt-1 max-w-[200px]">Hold to cut — release before iron barriers. Watch the decoys!</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-700 to-cyan-400 flex items-center justify-center shadow-[0_0_25px_rgba(0,180,160,0.55)] shrink-0">
                <Scissors size={26} className="text-white" />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-1 text-xs font-display font-bold text-teal-400 tracking-wide">
              <Trophy size={13} /> Decoy barriers reverse to trick you
              <ChevronRight size={14} className="ml-auto text-white/40 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </Link>

      {/* Color Switch */}
      <Link href="/games/color">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} data-testid="card-game-color"
          className="relative overflow-hidden rounded-3xl border border-violet-700/50 bg-gradient-to-br from-violet-900/30 via-fuchsia-900/10 to-background p-5 shadow-lg shadow-violet-900/30 cursor-pointer group">
          <div className="absolute -right-6 -top-6 opacity-20 group-hover:opacity-30 transition-opacity text-violet-500"><Circle size={120} strokeWidth={1.2} /></div>
          <div className="flex flex-col gap-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.3em] font-display uppercase text-violet-400/80">Game 5</span>
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Playable</span>
            </div>
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-display font-black text-2xl text-white tracking-wide uppercase leading-none">Color Switch</h2>
                <p className="text-xs text-white/60 mt-1 max-w-[200px]">Match your ball to the ring segment. Timing is everything!</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-700 to-fuchsia-400 flex items-center justify-center shadow-[0_0_25px_rgba(160,80,255,0.55)] shrink-0"><Circle size={26} className="text-white" /></div>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs font-display font-bold text-violet-400 tracking-wide">
              <Trophy size={13} /> Inner ring decoy appears at score 10+<ChevronRight size={14} className="ml-auto text-white/40 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </Link>

      {/* ZigZag Driver */}
      <Link href="/games/zigzag">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} data-testid="card-game-zigzag"
          className="relative overflow-hidden rounded-3xl border border-cyan-700/50 bg-gradient-to-br from-cyan-900/30 via-blue-900/10 to-background p-5 shadow-lg shadow-cyan-900/30 cursor-pointer group">
          <div className="absolute -right-6 -top-6 opacity-20 group-hover:opacity-30 transition-opacity text-cyan-500"><GitBranch size={120} strokeWidth={1.2} /></div>
          <div className="flex flex-col gap-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.3em] font-display uppercase text-cyan-400/80">Game 6</span>
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Playable</span>
            </div>
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-display font-black text-2xl text-white tracking-wide uppercase leading-none">ZigZag Driver</h2>
                <p className="text-xs text-white/60 mt-1 max-w-[200px]">Tap to flip direction. Grab coins at dangerous corners!</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-700 to-blue-400 flex items-center justify-center shadow-[0_0_25px_rgba(0,180,240,0.55)] shrink-0"><GitBranch size={26} className="text-white" /></div>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs font-display font-bold text-cyan-400 tracking-wide">
              <Trophy size={13} /> 3D isometric low-poly track<ChevronRight size={14} className="ml-auto text-white/40 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </Link>

      {/* Piano Tiles Rush */}
      <Link href="/games/piano">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} data-testid="card-game-piano"
          className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-white/5 via-white/[0.03] to-background p-5 shadow-lg cursor-pointer group">
          <div className="absolute -right-6 -top-6 opacity-15 group-hover:opacity-25 transition-opacity text-white"><Music2 size={120} strokeWidth={1.2} /></div>
          <div className="flex flex-col gap-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.3em] font-display uppercase text-white/50">Game 7</span>
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Playable</span>
            </div>
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-display font-black text-2xl text-white tracking-wide uppercase leading-none">Piano Rush</h2>
                <p className="text-xs text-white/60 mt-1 max-w-[200px]">Tap black tiles as they fall. Hold long tiles — miss one and it's over!</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-white/20 to-white/40 flex items-center justify-center shadow-[0_0_25px_rgba(255,255,255,0.25)] shrink-0"><Music2 size={26} className="text-black" /></div>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs font-display font-bold text-white/60 tracking-wide">
              <Trophy size={13} /> 4 lanes · hold tiles · speed surge<ChevronRight size={14} className="ml-auto text-white/40 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </Link>

      {/* Whack-A-Cyber */}
      <Link href="/games/whack">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} data-testid="card-game-whack"
          className="relative overflow-hidden rounded-3xl border border-green-700/40 bg-gradient-to-br from-[#020d06]/80 via-green-900/10 to-background p-5 shadow-lg shadow-green-900/20 cursor-pointer group">
          <div className="absolute -right-6 -top-6 opacity-20 group-hover:opacity-30 transition-opacity text-green-500"><Cpu size={120} strokeWidth={1.2} /></div>
          <div className="flex flex-col gap-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.3em] font-display uppercase text-green-400/80 font-mono">Game 8</span>
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Playable</span>
            </div>
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-display font-black text-2xl text-green-400 tracking-wide uppercase leading-none">Whack_Cyber</h2>
                <p className="text-xs text-white/60 mt-1 max-w-[200px]">Eliminate cyber creatures. Avoid bombs. Golden ones give ×2!</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-green-900 to-green-500 flex items-center justify-center shadow-[0_0_25px_rgba(0,255,136,0.4)] shrink-0"><Cpu size={26} className="text-black" /></div>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs font-mono font-bold text-green-400 tracking-wide">
              <Trophy size={13} /> Hacker terminal UI · freeze bonus<ChevronRight size={14} className="ml-auto text-white/40 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </Link>

      {/* Bubble Shooter */}
      <Link href="/games/bubble">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} data-testid="card-game-bubble"
          className="relative overflow-hidden rounded-3xl border border-purple-500/40 bg-gradient-to-br from-purple-900/30 via-violet-900/10 to-background p-5 shadow-lg shadow-purple-900/30 cursor-pointer group">
          <div className="absolute -right-6 -top-6 opacity-20 group-hover:opacity-30 transition-opacity text-purple-400"><Sparkles size={120} strokeWidth={1.2} /></div>
          <div className="flex flex-col gap-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.3em] font-display uppercase text-purple-400/80">Game 9</span>
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Playable</span>
            </div>
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-display font-black text-2xl text-white tracking-wide uppercase leading-none">Bubble Shooter</h2>
                <p className="text-xs text-white/60 mt-1 max-w-[200px]">Aim the glowing cannon. Match 3+ bubbles to pop chains & trigger explosive combos!</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-700 to-violet-400 flex items-center justify-center shadow-[0_0_25px_rgba(155,89,182,0.6)] shrink-0"><Sparkles size={26} className="text-white" /></div>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs font-display font-bold text-purple-400 tracking-wide">
              <Trophy size={13} /> Chain reactions · wall bounce · combo multiplier<ChevronRight size={14} className="ml-auto text-white/40 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </Link>

      {/* Galaxy Striker */}
      <Link href="/games/striker">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} data-testid="card-game-striker"
          className="relative overflow-hidden rounded-3xl border border-blue-500/40 bg-gradient-to-br from-[#000510]/90 via-blue-950/30 to-background p-5 shadow-lg shadow-blue-900/30 cursor-pointer group">
          <div className="absolute -right-6 -top-6 opacity-20 group-hover:opacity-30 transition-opacity text-blue-400"><Rocket size={120} strokeWidth={1.2} /></div>
          <div className="flex flex-col gap-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.3em] font-display uppercase text-blue-400/80">Game 10</span>
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Playable</span>
            </div>
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-display font-black text-2xl text-white tracking-wide uppercase leading-none">Galaxy Striker</h2>
                <p className="text-xs text-white/60 mt-1 max-w-[200px]">Drag to pilot your ship across neon nebulae. Auto-fire destroys wave after wave of aliens!</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-800 to-cyan-400 flex items-center justify-center shadow-[0_0_25px_rgba(52,152,219,0.6)] shrink-0"><Rocket size={26} className="text-white" /></div>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs font-display font-bold text-blue-400 tracking-wide">
              <Trophy size={13} /> 4 enemy types · shield · triple shot · bomb<ChevronRight size={14} className="ml-auto text-white/40 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </Link>

      {/* HyperBreak */}
      <Link href="/games/breakout">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} data-testid="card-game-breakout"
          className="relative overflow-hidden rounded-3xl border border-pink-600/40 bg-gradient-to-br from-[#0a0015]/90 via-purple-950/30 to-background p-5 shadow-lg shadow-purple-900/20 cursor-pointer group">
          <div className="absolute -right-6 -top-6 opacity-20 group-hover:opacity-30 transition-opacity text-pink-400"><Grid2x2 size={120} strokeWidth={1.2} /></div>
          <div className="flex flex-col gap-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.3em] font-display uppercase text-pink-400/80">Game 11</span>
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Playable</span>
            </div>
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-display font-black text-2xl text-white tracking-wide uppercase leading-none">HyperBreak</h2>
                <p className="text-xs text-white/60 mt-1 max-w-[200px]">Classic brick-breaker evolved. Laser beams, multi-ball chaos, wide paddle & bomb bricks!</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-800 to-pink-500 flex items-center justify-center shadow-[0_0_25px_rgba(180,50,255,0.5)] shrink-0"><Grid2x2 size={26} className="text-white" /></div>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs font-display font-bold text-pink-400 tracking-wide">
              <Trophy size={13} /> Laser · multi-ball · bomb bricks · power-ups<ChevronRight size={14} className="ml-auto text-white/40 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </Link>

      {/* Sky Hopper */}
      <Link href="/games/hopper">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} data-testid="card-game-hopper"
          className="relative overflow-hidden rounded-3xl border border-green-500/40 bg-gradient-to-br from-[#001408]/90 via-green-950/20 to-background p-5 shadow-lg shadow-green-900/20 cursor-pointer group">
          <div className="absolute -right-6 -top-6 opacity-20 group-hover:opacity-30 transition-opacity text-green-400"><ArrowUp size={120} strokeWidth={1.2} /></div>
          <div className="flex flex-col gap-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.3em] font-display uppercase text-green-400/80">Game 12</span>
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Playable</span>
            </div>
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-display font-black text-2xl text-white tracking-wide uppercase leading-none">Sky Hopper</h2>
                <p className="text-xs text-white/60 mt-1 max-w-[200px]">Bounce up through the galaxy! Moving, breaking & cloud platforms. Stomp enemies for bonus!</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-green-700 to-teal-400 flex items-center justify-center shadow-[0_0_25px_rgba(46,204,113,0.5)] shrink-0"><ArrowUp size={26} className="text-white" /></div>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs font-display font-bold text-green-400 tracking-wide">
              <Trophy size={13} /> 5 platform types · enemies · spring boost<ChevronRight size={14} className="ml-auto text-white/40 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </Link>

      {/* Math Games Section */}
      <div className="flex items-center gap-3 mt-4 mb-1">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
        <span className="text-[10px] tracking-[0.3em] font-display uppercase text-cyan-400/60">Math Games</span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
      </div>

      {/* Calc Blaster */}
      <Link href="/games/calcblast">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} data-testid="card-game-calcblast"
          className="relative overflow-hidden rounded-3xl border border-cyan-500/40 bg-gradient-to-br from-[#001520]/90 via-cyan-950/20 to-background p-5 shadow-lg shadow-cyan-900/20 cursor-pointer group">
          <div className="absolute -right-6 -top-6 opacity-20 group-hover:opacity-30 transition-opacity text-cyan-400"><Crosshair size={120} strokeWidth={1.2} /></div>
          <div className="flex flex-col gap-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.3em] font-display uppercase text-cyan-400/80">Game 13 · Math</span>
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Playable</span>
            </div>
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-display font-black text-2xl text-white tracking-wide uppercase leading-none">Calc Blaster</h2>
                <p className="text-xs text-white/60 mt-1 max-w-[200px]">Equations fall from above. Tap the right answer to blast them with a laser before they hit the ground!</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-700 to-blue-400 flex items-center justify-center shadow-[0_0_25px_rgba(0,200,255,0.5)] shrink-0"><Crosshair size={26} className="text-white" /></div>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs font-display font-bold text-cyan-400 tracking-wide">
              <Trophy size={13} /> 4 operations · 3 HP · speed ramp<ChevronRight size={14} className="ml-auto text-white/40 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </Link>

      {/* Number Smash */}
      <Link href="/games/numsmash">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} data-testid="card-game-numsmash"
          className="relative overflow-hidden rounded-3xl border border-orange-500/40 bg-gradient-to-br from-[#1a0800]/90 via-orange-950/20 to-background p-5 shadow-lg shadow-orange-900/20 cursor-pointer group">
          <div className="absolute -right-6 -top-6 opacity-20 group-hover:opacity-30 transition-opacity text-orange-400"><Hammer size={120} strokeWidth={1.2} /></div>
          <div className="flex flex-col gap-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.3em] font-display uppercase text-orange-400/80">Game 14 · Math</span>
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Playable</span>
            </div>
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-display font-black text-2xl text-white tracking-wide uppercase leading-none">Number Smash</h2>
                <p className="text-xs text-white/60 mt-1 max-w-[200px]">Numbers pop up in a grid. Follow the challenge: Smash Primes! Evens! Squares! Tap the wrong one = −HP.</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-700 to-red-400 flex items-center justify-center shadow-[0_0_25px_rgba(255,100,0,0.5)] shrink-0"><Hammer size={26} className="text-white" /></div>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs font-display font-bold text-orange-400 tracking-wide">
              <Trophy size={13} /> 5 challenge types · rotating rules · 3 HP<ChevronRight size={14} className="ml-auto text-white/40 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </Link>

      {/* Sum Chain */}
      <Link href="/games/chainsum">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} data-testid="card-game-chainsum"
          className="relative overflow-hidden rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-[#001a08]/90 via-emerald-950/20 to-background p-5 shadow-lg shadow-emerald-900/20 cursor-pointer group">
          <div className="absolute -right-6 -top-6 opacity-20 group-hover:opacity-30 transition-opacity text-emerald-400"><Link2 size={120} strokeWidth={1.2} /></div>
          <div className="flex flex-col gap-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.3em] font-display uppercase text-emerald-400/80">Game 15 · Math</span>
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Playable</span>
            </div>
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-display font-black text-2xl text-white tracking-wide uppercase leading-none">Sum Chain</h2>
                <p className="text-xs text-white/60 mt-1 max-w-[200px]">Draw a glowing path through adjacent numbers that add up to the target sum. Race the clock!</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-700 to-teal-400 flex items-center justify-center shadow-[0_0_25px_rgba(46,204,113,0.5)] shrink-0"><Link2 size={26} className="text-white" /></div>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs font-display font-bold text-emerald-400 tracking-wide">
              <Trophy size={13} /> 5×5 grid · path drawing · combo clear<ChevronRight size={14} className="ml-auto text-white/40 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </Link>

      {/* Fraction Sort */}
      <Link href="/games/fracsort">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} data-testid="card-game-fracsort"
          className="relative overflow-hidden rounded-3xl border border-violet-500/40 bg-gradient-to-br from-[#0e0020]/90 via-violet-950/20 to-background p-5 shadow-lg shadow-violet-900/20 cursor-pointer group">
          <div className="absolute -right-6 -top-6 opacity-20 group-hover:opacity-30 transition-opacity text-violet-400"><Scale size={120} strokeWidth={1.2} /></div>
          <div className="flex flex-col gap-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.3em] font-display uppercase text-violet-400/80">Game 16 · Math</span>
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Playable</span>
            </div>
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-display font-black text-2xl text-white tracking-wide uppercase leading-none">Fraction Sort</h2>
                <p className="text-xs text-white/60 mt-1 max-w-[200px]">Is the fraction less than ½ or greater than ½? Tap the correct side before you run out of HP!</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-700 to-purple-400 flex items-center justify-center shadow-[0_0_25px_rgba(155,89,182,0.5)] shrink-0"><Scale size={26} className="text-white" /></div>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs font-display font-bold text-violet-400 tracking-wide">
              <Trophy size={13} /> 20 unique fractions · 3 HP · visual card<ChevronRight size={14} className="ml-auto text-white/40 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </Link>

      {/* Speed Math */}
      <Link href="/games/speedmath">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} data-testid="card-game-speedmath"
          className="relative overflow-hidden rounded-3xl border border-yellow-500/40 bg-gradient-to-br from-[#100800]/90 via-yellow-950/20 to-background p-5 shadow-lg shadow-yellow-900/20 cursor-pointer group">
          <div className="absolute -right-6 -top-6 opacity-20 group-hover:opacity-30 transition-opacity text-yellow-400"><Zap size={120} strokeWidth={1.2} /></div>
          <div className="flex flex-col gap-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.3em] font-display uppercase text-yellow-400/80">Game 17 · Math</span>
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Playable</span>
            </div>
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-display font-black text-2xl text-white tracking-wide uppercase leading-none">Speed Math</h2>
                <p className="text-xs text-white/60 mt-1 max-w-[200px]">Equation flashes for 0.9s — then 4 choices appear. Answer fast for speed bonus! Build combos for ×5 multiplier!</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-yellow-700 to-amber-400 flex items-center justify-center shadow-[0_0_25px_rgba(255,200,0,0.5)] shrink-0"><Zap size={26} className="text-white" /></div>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs font-display font-bold text-yellow-400 tracking-wide">
              <Trophy size={13} /> Speed bonus · ×5 combo · 4 operations<ChevronRight size={14} className="ml-auto text-white/40 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </Link>

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
