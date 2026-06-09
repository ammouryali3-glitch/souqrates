import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Users, Trophy, Crown, Swords, LogOut } from "lucide-react";
import { Link } from "wouter";
import { useLang } from "@/lib/i18n";
import { sfx } from "@/lib/sound";
import {
  useClanStatus, refreshClanStatus,
  createClan, joinClan, leaveClan,
} from "@/lib/clan";
import { writeBalance } from "@/lib/admin-store";

const ACCENT = "#F5B50A";

export default function ClanPage() {
  const lang = useLang();
  const ar = lang === "ar";
  const status = useClanStatus();
  const [tab, setTab] = useState<"create" | "join">("join");
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [joinTag, setJoinTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showLeave, setShowLeave] = useState(false);

  useEffect(() => { refreshClanStatus(); }, []);

  const showMsg = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }, []);

  const handleCreate = useCallback(async () => {
    if (busy) return;
    const n = name.trim();
    const t = tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (n.length < 3 || n.length > 30) { showMsg(ar ? "الاسم 3-30 حرف" : "Name must be 3-30 chars"); return; }
    if (t.length < 3 || t.length > 6) { showMsg(ar ? "الرمز 3-6 أحرف" : "Tag must be 3-6 chars"); return; }
    setBusy(true);
    try {
      await createClan(n, t);
      sfx.coin();
      showMsg(ar ? "✓ تأسست العشيرة!" : "✓ Clan created!");
    } catch (e) { showMsg((e as Error).message); }
    finally { setBusy(false); }
  }, [busy, name, tag, ar, showMsg]);

  const handleJoin = useCallback(async () => {
    if (busy) return;
    const t = joinTag.trim().toUpperCase();
    if (t.length < 3) { showMsg(ar ? "أدخل الرمز" : "Enter tag"); return; }
    setBusy(true);
    try {
      await joinClan(t);
      sfx.coin();
      showMsg(ar ? "✓ انضممت للعشيرة!" : "✓ Joined clan!");
    } catch (e) { showMsg((e as Error).message); }
    finally { setBusy(false); }
  }, [busy, joinTag, ar, showMsg]);

  const handleLeave = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await leaveClan();
      setShowLeave(false);
      showMsg(ar ? "غادرت العشيرة" : "Left clan");
    } catch (e) { showMsg((e as Error).message); }
    finally { setBusy(false); }
  }, [busy, ar, showMsg]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0d0118" }} dir={ar ? "rtl" : "ltr"}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <Link href="/">
          <button className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
            <ArrowRight size={18} className="text-white/70" style={{ transform: ar ? "none" : "rotate(180deg)" }} />
          </button>
        </Link>
        <h1 className="text-base font-display font-black text-white">{ar ? "العشائر" : "Clans"}</h1>
      </div>

      {!status ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
        </div>
      ) : status.clan ? (
        // ── In a Clan ──
        <div className="flex-1 overflow-y-auto pb-24 px-4 flex flex-col gap-4">
          {/* Clan Banner */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-5 flex flex-col gap-3"
            style={{ background: "linear-gradient(135deg, rgba(245,181,10,0.14), rgba(139,92,246,0.1))", border: "1px solid rgba(245,181,10,0.25)" }}>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black"
                style={{ background: "rgba(245,181,10,0.15)", color: ACCENT }}>
                {status.clan.tag}
              </div>
              <div className="flex-1">
                <div className="text-lg font-display font-black text-white">{status.clan.name}</div>
                <div className="text-[11px] text-white/40">
                  {ar ? `المرتبة #${status.clan.rank}` : `Rank #${status.clan.rank}`}
                  {" · "}
                  {status.clan.memberCount} {ar ? "عضو" : "members"}
                </div>
              </div>
              <button onClick={() => setShowLeave(true)}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,60,60,0.1)" }}>
                <LogOut size={15} className="text-red-400" />
              </button>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 rounded-xl p-2.5 text-center" style={{ background: "rgba(0,0,0,0.25)" }}>
                <div className="text-base font-black" style={{ color: ACCENT }}>{status.clan.totalXp.toLocaleString()}</div>
                <div className="text-[10px] text-white/40">XP</div>
              </div>
              <div className="flex-1 rounded-xl p-2.5 text-center" style={{ background: "rgba(0,0,0,0.25)" }}>
                <div className="text-base font-black text-white">{status.clan.memberCount}</div>
                <div className="text-[10px] text-white/40">{ar ? "أعضاء" : "members"}</div>
              </div>
            </div>
          </motion.div>

          {/* Members */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <Users size={14} style={{ color: ACCENT }} />
              <span className="text-[11px] font-black text-white/70 uppercase tracking-wider">{ar ? "الأعضاء" : "Members"}</span>
            </div>
            {status.clan.members.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
                  style={{ background: i === 0 ? ACCENT : "rgba(255,255,255,0.08)", color: i === 0 ? "#0d0118" : "rgba(255,255,255,0.4)" }}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{m.name}</div>
                  <div className="text-[10px] text-white/40">{ar ? `مستوى ${m.level}` : `Level ${m.level}`}</div>
                </div>
                <div className="text-sm font-black shrink-0" style={{ color: ACCENT }}>{m.xp.toLocaleString()} XP</div>
                {m.id === status.clan!.ownerId && <Crown size={12} style={{ color: ACCENT }} className="shrink-0" />}
              </div>
            ))}
          </div>

          {/* Global Leaderboard */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <Trophy size={14} style={{ color: ACCENT }} />
              <span className="text-[11px] font-black text-white/70 uppercase tracking-wider">{ar ? "أقوى العشائر" : "Top Clans"}</span>
            </div>
            {status.leaderboard.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none", background: c.id === status.clan?.id ? "rgba(245,181,10,0.05)" : "transparent" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
                  style={{ background: i < 3 ? ACCENT : "rgba(255,255,255,0.08)", color: i < 3 ? "#0d0118" : "rgba(255,255,255,0.4)" }}>
                  {c.rank}
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs font-black px-1.5 py-0.5 rounded-md"
                    style={{ background: "rgba(245,181,10,0.12)", color: ACCENT }}>{c.tag}</span>
                  <span className="text-sm font-bold text-white truncate">{c.name}</span>
                </div>
                <div className="text-xs font-black shrink-0" style={{ color: ACCENT }}>{c.totalXp.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // ── No Clan ──
        <div className="flex-1 overflow-y-auto pb-24 px-4 flex flex-col gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-5 text-center flex flex-col items-center gap-2"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="text-4xl">🏰</div>
            <div className="text-base font-black text-white">{ar ? "لا تنتمي لأي عشيرة" : "No Clan"}</div>
            <div className="text-[11px] text-white/40">{ar ? "انضم أو أنشئ عشيرة للتنافس معاً" : "Join or create a clan to compete together"}</div>
          </motion.div>

          {/* Tab toggle */}
          <div className="flex rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {(["join", "create"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 py-2.5 text-xs font-display font-bold tracking-wide uppercase transition-all"
                style={tab === t ? { background: ACCENT, color: "#0d0118" } : { color: "rgba(255,255,255,0.4)" }}>
                {t === "join" ? (ar ? "انضم" : "Join") : (ar ? "أنشئ" : "Create")}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === "join" ? (
              <motion.div key="join" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-2xl p-5 flex flex-col gap-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div>
                  <label className="text-[11px] text-white/50 font-bold uppercase tracking-wider">{ar ? "رمز العشيرة" : "Clan Tag"}</label>
                  <input
                    value={joinTag}
                    onChange={(e) => setJoinTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                    placeholder={ar ? "مثل: SKZ" : "e.g. SKZ"}
                    className="w-full mt-1.5 px-4 py-3 rounded-xl text-white text-base font-black text-center tracking-widest outline-none"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                </div>
                <button onClick={handleJoin} disabled={busy}
                  className="w-full py-3.5 rounded-2xl font-display font-black text-sm transition-opacity"
                  style={{ background: ACCENT, color: "#0d0118", opacity: busy ? 0.6 : 1 }}>
                  {busy ? "…" : (ar ? "انضم الآن" : "Join Now")}
                </button>
              </motion.div>
            ) : (
              <motion.div key="create" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-2xl p-5 flex flex-col gap-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div>
                  <label className="text-[11px] text-white/50 font-bold uppercase tracking-wider">{ar ? "اسم العشيرة (3-30 حرف)" : "Clan Name (3-30 chars)"}</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 30))}
                    placeholder={ar ? "مثل: أساطير سوقراطيس" : "e.g. Souqrates Legends"}
                    className="w-full mt-1.5 px-4 py-3 rounded-xl text-white text-sm outline-none"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-white/50 font-bold uppercase tracking-wider">{ar ? "الرمز (3-6 أحرف)" : "Tag (3-6 chars)"}</label>
                  <input
                    value={tag}
                    onChange={(e) => setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                    placeholder="SKZ"
                    className="w-full mt-1.5 px-4 py-3 rounded-xl text-white text-base font-black text-center tracking-widest outline-none"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                </div>
                <button onClick={handleCreate} disabled={busy}
                  className="w-full py-3.5 rounded-2xl font-display font-black text-sm transition-opacity"
                  style={{ background: ACCENT, color: "#0d0118", opacity: busy ? 0.6 : 1 }}>
                  {busy ? "…" : (ar ? "أنشئ العشيرة" : "Create Clan")}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Global Leaderboard preview */}
          {status.leaderboard.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <Trophy size={14} style={{ color: ACCENT }} />
                <span className="text-[11px] font-black text-white/70 uppercase tracking-wider">{ar ? "أقوى العشائر" : "Top Clans"}</span>
              </div>
              {status.leaderboard.slice(0, 5).map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
                    style={{ background: i < 3 ? ACCENT : "rgba(255,255,255,0.08)", color: i < 3 ? "#0d0118" : "rgba(255,255,255,0.4)" }}>
                    {c.rank}
                  </div>
                  <span className="text-xs font-black px-1.5 py-0.5 rounded-md"
                    style={{ background: "rgba(245,181,10,0.12)", color: ACCENT }}>{c.tag}</span>
                  <span className="text-sm font-bold text-white flex-1 truncate">{c.name}</span>
                  <span className="text-xs font-black shrink-0" style={{ color: ACCENT }}>{c.totalXp.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leave confirm dialog */}
      <AnimatePresence>
        {showLeave && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={() => setShowLeave(false)}>
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
              className="w-full max-w-sm rounded-3xl p-5 flex flex-col gap-3"
              style={{ background: "#1a0b2e", border: "1px solid rgba(255,255,255,0.1)" }}
              onClick={(e) => e.stopPropagation()}>
              <div className="text-base font-black text-white text-center">{ar ? "مغادرة العشيرة؟" : "Leave Clan?"}</div>
              <div className="text-[11px] text-white/40 text-center">{ar ? "لن تتمكن من استعادة مرتبتك" : "You won't keep your clan rank"}</div>
              <button onClick={handleLeave} disabled={busy}
                className="w-full py-3 rounded-xl font-bold text-sm"
                style={{ background: "rgba(255,60,60,0.15)", border: "1px solid rgba(255,60,60,0.3)", color: "#fc8181" }}>
                {busy ? "…" : (ar ? "مغادرة" : "Leave")}
              </button>
              <button onClick={() => setShowLeave(false)}
                className="w-full py-3 rounded-xl text-sm font-bold text-white/50">
                {ar ? "إلغاء" : "Cancel"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-bold text-white whitespace-nowrap"
            style={{ background: "rgba(30,10,50,0.95)", border: "1px solid rgba(245,181,10,0.3)", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
