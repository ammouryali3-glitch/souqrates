import { useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, Trophy, Users, Clock, Coins, Crown, Flame, ChevronRight, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getPool, getEntries, hasPlayed, markPlayed,
  getLeaderboard, submitScore, getCountdown, formatTime,
  fetchLeaderboard, submitScoreToServer,
  ArenaPeriod, LeaderEntry, LeaderboardPeriod,
} from "@/lib/arena";
import { useArenaEconomy } from "@/lib/game-economy";
import { useTelegramUser } from "@/lib/telegram-user";
import { useLang, t } from "@/lib/i18n";

const BALANCE_KEY = "skz_balance";

type Shell = "lobby" | "playing" | "result" | "leaderboard";

interface ArenaShellProps {
  gameId: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  entryFee: number;
  period: ArenaPeriod;
  description: string;
  children: (props: { onComplete: (score: number, timeSec: number) => void }) => ReactNode;
}

function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    const diff = value - prevRef.current;
    if (diff <= 0) { setDisplay(value); prevRef.current = value; return; }
    let start: number | null = null;
    const from = prevRef.current;
    prevRef.current = value;
    function tick(ts: number) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 800, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + diff * ease));
      if (p < 1) requestAnimationFrame(tick);
      else setDisplay(value);
    }
    requestAnimationFrame(tick);
  }, [value]);
  return <span>{prefix}{display.toLocaleString()}{suffix}</span>;
}

export default function ArenaShell({ gameId, title, subtitle, icon, color, entryFee, period, description, children }: ArenaShellProps) {
  const lang = useLang();
  const s = t[lang];
  const { dbUser } = useTelegramUser();
  const [shell, setShell] = useState<Shell>("lobby");
  const [balance, setBalance] = useState(() => parseInt(localStorage.getItem(BALANCE_KEY) || "1000"));
  const [pool, setPool] = useState(() => getPool(gameId));
  const [entries, setEntries] = useState(() => getEntries(gameId));
  const [leaders, setLeaders] = useState<LeaderEntry[]>(() => getLeaderboard(gameId));
  const [myScore, setMyScore] = useState(0);
  const [myTime, setMyTime] = useState(0);
  const [myRank, setMyRank] = useState(0);
  const [countdown, setCountdown] = useState(() => getCountdown(period));
  const [alreadyPlayed] = useState(() => hasPlayed(gameId, period));
  const [lbTab, setLbTab] = useState<LeaderboardPeriod>(period);
  const [alltimeLeaders, setAlltimeLeaders] = useState<LeaderEntry[]>([]);
  const [alltimeEntries, setAlltimeEntries] = useState(0);
  const [alltimeLoading, setAlltimeLoading] = useState(false);
  const { fee: effEntry, prizeFactor, winnerCut } = useArenaEconomy(gameId, entryFee);
  const winnerTake = Math.floor(pool * winnerCut * prizeFactor);

  // Fetch real leaderboard + pool from server on mount
  useEffect(() => {
    fetchLeaderboard(gameId, period).then((data) => {
      if (!data) return;
      setLeaders(data.leaders);
      setPool(data.pool);       // always trust server value (including 0 for new periods)
      setEntries(data.entries); // always trust server value
    });
  }, [gameId, period]);

  // Fetch all-time leaderboard when tab switches to alltime
  useEffect(() => {
    if (lbTab !== "alltime") return;
    setAlltimeLoading(true);
    fetchLeaderboard(gameId, "alltime").then((data) => {
      if (data) {
        setAlltimeLeaders(data.leaders);
        setAlltimeEntries(data.entries);
      }
      setAlltimeLoading(false);
    });
  }, [lbTab, gameId]);

  // Countdown refresh (period display only — no pool simulation)
  useEffect(() => {
    if (shell !== "lobby") return;
    const cdInterval = setInterval(() => setCountdown(getCountdown(period)), 30000);
    return () => clearInterval(cdInterval);
  }, [shell, period]);

  const handlePay = useCallback(() => {
    if (balance < effEntry) return;
    const nb = balance - effEntry;
    setBalance(nb);
    localStorage.setItem(BALANCE_KEY, String(nb));
    markPlayed(gameId);
    setShell("playing");
  }, [balance, effEntry, gameId]);

  const handleComplete = useCallback(async (score: number, timeSec: number) => {
    setMyScore(score);
    setMyTime(timeSec);

    // Determine display name: prefer DB user name, then fallback
    const playerName = typeof dbUser?.name === "string" && dbUser.name
      ? dbUser.name
      : "You";

    // Optimistic local update
    const { leaders: localLeaders, rank: localRank } = submitScore(gameId, score, timeSec, playerName);
    setLeaders(localLeaders);
    setMyRank(localRank);
    setShell("result");

    // Submit to server (fire and forget — update leaders if server responds)
    const serverResult = await submitScoreToServer(gameId, score, timeSec, playerName, period);
    if (serverResult) {
      // Refresh leaderboard from server after submission
      const fresh = await fetchLeaderboard(gameId, period);
      if (fresh) {
        setLeaders(fresh.leaders);
        setMyRank(fresh.yourRank ?? serverResult.rank);
        setPool(fresh.pool);       // always trust server value
        setEntries(fresh.entries); // always trust server value
      } else {
        setMyRank(serverResult.rank);
      }
    }
  }, [gameId, period, dbUser]);

  const colorRGB = color;

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{ background: "#06040f" }}>
      <AnimatePresence mode="wait">

        {/* ── LOBBY ── */}
        {shell === "lobby" && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -40 }}
            className="absolute inset-0 flex flex-col overflow-y-auto">
            {/* Hero */}
            <div className="relative overflow-hidden px-5 pt-10 pb-6 flex flex-col items-center text-center"
              style={{ background: `linear-gradient(160deg, ${color}22 0%, #06040f 100%)` }}>
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}18 0%, transparent 70%)` }} />
              <Link href="/games">
                <button className="absolute left-4 top-10 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                  <ArrowLeft size={17} className="text-white/70" />
                </button>
              </Link>
              <div className="text-5xl mb-2 relative z-10">{icon}</div>
              <div className="text-[10px] tracking-[0.4em] uppercase mb-1 font-display relative z-10" style={{ color: `${color}` }}>{subtitle}</div>
              <h1 className="font-display font-black text-3xl text-white uppercase relative z-10">{title}</h1>
              <p className="text-xs text-white/50 mt-2 max-w-[260px] relative z-10">{description}</p>
            </div>

            {/* Prize Pool Card */}
            <div className="mx-4 -mt-2 rounded-3xl border p-5 relative overflow-hidden"
              style={{ borderColor: `${color}50`, background: `linear-gradient(135deg, ${color}15, #06040f)` }}>
              <div className="absolute top-2 right-3 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] text-green-400 font-display font-bold tracking-widest uppercase">{s.arenaLive}</span>
              </div>
              <div className="text-xs text-white/40 font-display uppercase tracking-widest mb-1">{s.arenaPrizePool}</div>
              <div className="font-display font-black text-4xl flex items-end gap-2" style={{ color }}>
                <Coins size={28} className="mb-1 shrink-0" />
                <AnimatedNumber value={pool} />
                <span className="text-lg text-white/50 mb-0.5">SKZ</span>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-white/40 font-display">
                <span className="flex items-center gap-1"><Users size={12} /><AnimatedNumber value={entries} suffix={" " + s.arenaPlayersLabel} /></span>
                <span className="flex items-center gap-1"><Clock size={12} />{s.arenaResetsIn(countdown)}</span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ background: color }}
                  animate={{ width: ["60%", "75%", "68%", "82%"] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
              </div>
              <div className="text-[10px] text-white/25 mt-1 font-display">Prize grows with each new entry</div>
            </div>

            {/* Top 3 Preview */}
            <div className="mx-4 mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/30 font-display uppercase tracking-widest">{s.arenaTopChallengers}</span>
                <button onClick={() => setShell("leaderboard")} className="text-xs font-display flex items-center gap-1" style={{ color }}>
                  {s.arenaFullBoard} <ChevronRight size={12} />
                </button>
              </div>
              {leaders.slice(0, 3).map((l, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-display font-black"
                    style={{ background: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : "#cd7f32", color: "#000" }}>
                    {l.rank}
                  </div>
                  <div className="flex-1 font-display text-sm text-white">{l.name}</div>
                  <div className="text-xs text-white/40 font-display">{formatTime(l.time)}</div>
                  <div className="text-xs font-display font-bold" style={{ color }}>{l.score} pts</div>
                </div>
              ))}
            </div>

            {/* Entry */}
            <div className="mx-4 mt-4 mb-6">
              {alreadyPlayed ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 py-4 text-center">
                  <div className="text-white/50 text-sm font-display">
                    {period === "weekly" ? s.arenaAlreadyPlayedWeek : s.arenaAlreadyPlayedDay}
                  </div>
                  <button onClick={() => setShell("leaderboard")} className="mt-2 text-xs font-display" style={{ color }}>{s.arenaViewLb}</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white/5 border border-white/10 mb-3">
                    <span className="text-sm text-white/50 font-display">{s.arenaEntryFee}</span>
                    <span className="font-display font-bold flex items-center gap-1" style={{ color }}>
                      <Coins size={14} />{effEntry === 0 ? s.arenaFree : `${effEntry} SKZ`}
                    </span>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    disabled={balance < effEntry}
                    onClick={handlePay}
                    className="w-full py-4 rounded-2xl font-display font-black text-base tracking-widest uppercase flex items-center justify-center gap-2 disabled:opacity-30"
                    style={{ background: `linear-gradient(135deg, ${color}, ${color}99)`, color: "#000", boxShadow: `0 0 30px ${color}55` }}>
                    <Flame size={18} /> {effEntry === 0 ? s.arenaPlayFree : s.arenaPayAndPlay(effEntry)}
                  </motion.button>
                  <div className="text-center text-xs text-white/25 mt-2 font-display">{s.arenaEntryAddsToPool}</div>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* ── PLAYING ── */}
        {shell === "playing" && (
          <motion.div key="playing" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col">
            {children({ onComplete: handleComplete })}
          </motion.div>
        )}

        {/* ── RESULT ── */}
        {shell === "result" && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center px-5 gap-4 overflow-y-auto pt-10 pb-8">
            <div className="text-7xl">{myRank === 1 ? "👑" : myRank <= 3 ? "🏆" : myRank <= 10 ? "⭐" : "🎮"}</div>
            <div className="text-center">
              <div className="font-display font-black text-3xl text-white uppercase">
                {myRank === 1 ? s.arenaResult1st : s.arenaResultRank(myRank)}
              </div>
              <div className="text-white/50 text-sm mt-1">{s.arenaScoreSubmitted}</div>
            </div>

            {/* Score card */}
            <div className="w-full max-w-[320px] rounded-3xl border p-5 flex flex-col gap-3"
              style={{ borderColor: `${color}40`, background: `linear-gradient(135deg, ${color}12, #06040f)` }}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40 font-display uppercase">{s.arenaYourScore}</span>
                <span className="font-display font-black text-2xl" style={{ color }}>{myScore} pts</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40 font-display uppercase">{s.arenaTimeTaken}</span>
                <span className="font-display font-bold text-white">{formatTime(myTime)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40 font-display uppercase">{s.arenaYourRank}</span>
                <span className="font-display font-bold" style={{ color }}>#{myRank} of {entries}</span>
              </div>
              <div className="border-t border-white/10 pt-3">
                <div className="text-xs text-white/30 font-display uppercase mb-1">{s.arenaCurPrizePool}</div>
                <div className="font-display font-black text-xl flex items-center gap-2" style={{ color }}>
                  <Coins size={18} /><AnimatedNumber value={pool} suffix=" SKZ" />
                </div>
                {myRank === 1 && <div className="text-xs text-yellow-400 mt-1 font-display animate-pulse">{s.arenaLeadNote}</div>}
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full max-w-[320px]">
              <button onClick={() => setShell("leaderboard")}
                className="w-full py-3.5 rounded-2xl font-display font-bold tracking-wide flex items-center justify-center gap-2"
                style={{ background: `${color}22`, border: `1px solid ${color}50`, color }}>
                <Trophy size={16} /> {s.arenaViewLeaderboard}
              </button>
              <Link href="/games">
                <button className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white/50 font-display font-bold tracking-wide text-sm">
                  {s.arenaBackToGames}
                </button>
              </Link>
            </div>
          </motion.div>
        )}

        {/* ── LEADERBOARD ── */}
        {shell === "leaderboard" && (
          <motion.div key="lb" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
            className="absolute inset-0 flex flex-col overflow-y-auto">
            <div className="px-5 pt-10 pb-4 flex items-center gap-3 sticky top-0 z-10"
              style={{ background: "rgba(6,4,15,0.95)", backdropFilter: "blur(12px)" }}>
              <button onClick={() => setShell("lobby")} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                <ArrowLeft size={17} className="text-white/70" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-display font-black text-lg text-white uppercase">{title}</div>
                <div className="text-xs text-white/30 font-display">
                  {lbTab === "alltime"
                    ? s.arenaAlltimePlayers(alltimeEntries)
                    : s.arenaPlayersResets(entries, countdown)}
                </div>
              </div>
            </div>

            {/* Tab toggle */}
            <div className="mx-4 mb-3 flex rounded-xl overflow-hidden border border-white/10 bg-white/5">
              <button
                onClick={() => setLbTab(period)}
                className="flex-1 py-2.5 text-xs font-display font-bold tracking-wide uppercase transition-all"
                style={lbTab !== "alltime"
                  ? { background: color, color: "#000" }
                  : { color: "rgba(255,255,255,0.4)" }}>
                {period === "weekly" ? s.arenaTabThisWeek : s.arenaTabToday}
              </button>
              <button
                onClick={() => setLbTab("alltime")}
                className="flex-1 py-2.5 text-xs font-display font-bold tracking-wide uppercase transition-all flex items-center justify-center gap-1"
                style={lbTab === "alltime"
                  ? { background: color, color: "#000" }
                  : { color: "rgba(255,255,255,0.4)" }}>
                <Trophy size={12} /> {s.arenaTabAllTime}
              </button>
            </div>

            {/* Live pool banner — only for current-period tab */}
            {lbTab !== "alltime" && (
              <div className="mx-4 mb-3 px-4 py-3 rounded-2xl flex items-center justify-between"
                style={{ background: `linear-gradient(135deg, ${color}20, ${color}08)`, border: `1px solid ${color}40` }}>
                <div>
                  <div className="text-[10px] text-white/30 font-display uppercase tracking-widest mb-0.5">{s.arenaLivePrizePool}</div>
                  <div className="font-display font-black text-xl flex items-center gap-1.5" style={{ color }}>
                    <Coins size={16} /><AnimatedNumber value={pool} suffix=" SKZ" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-white/30 font-display uppercase tracking-widest mb-0.5">{s.arenaWinnerTakes}</div>
                  <div className="font-display font-black text-xl text-yellow-400">
                    <AnimatedNumber value={winnerTake} suffix=" SKZ" />
                  </div>
                </div>
              </div>
            )}

            {/* All-time banner */}
            {lbTab === "alltime" && (
              <div className="mx-4 mb-3 px-4 py-3 rounded-2xl flex items-center gap-3"
                style={{ background: `linear-gradient(135deg, ${color}15, ${color}05)`, border: `1px solid ${color}30` }}>
                <Trophy size={18} style={{ color }} className="shrink-0" />
                <div>
                  <div className="font-display font-bold text-sm text-white">{s.arenaHallOfFame}</div>
                  <div className="text-[11px] text-white/40 font-display">{s.arenaHallOfFameSub}</div>
                </div>
              </div>
            )}

            {/* Leaderboard list */}
            <div className="px-4 flex flex-col gap-0 pb-8">
              {alltimeLoading && lbTab === "alltime" ? (
                <div className="text-center text-white/30 text-sm font-display py-12">{s.loading}</div>
              ) : (
                (() => {
                  const list = lbTab === "alltime" ? alltimeLeaders : leaders;
                  if (list.length === 0) {
                    return (
                      <div className="text-center text-white/30 text-sm font-display py-12">
                        {lbTab === "alltime" ? s.arenaNoRecords : s.arenaNoEntries}
                      </div>
                    );
                  }
                  return list.map((l, i) => (
                    <motion.div key={`${lbTab}-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-1.5 border transition-all ${l.isYou ? "border-yellow-400/40" : "border-transparent hover:bg-white/5"}`}
                      style={l.isYou ? { background: `${color}15`, borderColor: `${color}50` } : { background: "rgba(255,255,255,0.03)" }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-display font-black text-sm shrink-0"
                        style={{ background: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "rgba(255,255,255,0.1)", color: i < 3 ? "#000" : "#fff" }}>
                        {i === 0 ? <Crown size={16} /> : l.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-bold text-sm text-white flex items-center gap-1">
                          {l.name}{l.isYou && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-display" style={{ background: `${color}30`, color }}>YOU</span>}
                        </div>
                        <div className="text-xs text-white/30 font-display">{formatTime(l.time)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-display font-bold text-sm" style={{ color: i === 0 ? "#ffd700" : "rgba(255,255,255,0.8)" }}>{l.score} pts</div>
                        {i === 0 && <div className="text-[10px] text-yellow-400 font-display flex items-center justify-end gap-0.5"><Star size={9} />{lbTab === "alltime" ? "Legend" : "Leader"}</div>}
                      </div>
                    </motion.div>
                  ));
                })()
              )}
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
