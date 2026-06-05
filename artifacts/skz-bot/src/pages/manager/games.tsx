import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gamepad2, Trophy, Target, Coins, Zap, Star, Save, RotateCcw, Pencil,
  Percent, type LucideIcon,
} from "lucide-react";
import { useAdmin, admin, type TicketPatch } from "../../lib/admin-store";
import { ARENA_GAMES, SKILL_GAMES, ACCENTS, type GameDef } from "../../lib/games-data";
import { getDefaultTickets, type BaseTicket } from "../../lib/tickets-data";
import { Card, SectionHeader, StatCard, Label, Field, Area, Toggle } from "./_ui";

function posNum(v: string, fallback = 1) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const TIER_AR: Record<string, string> = {
  rookie: "مبتدئ", bronze: "برونزي", silver: "فضي", gold: "ذهبي", diamond: "ماسي",
};

function FactorInput({ label, icon: Icon, value, onChange, testId }: {
  label: string; icon: LucideIcon; value: string; onChange: (v: string) => void; testId: string;
}) {
  return (
    <div>
      <Label><span className="inline-flex items-center gap-1"><Icon size={11} /> {label}</span></Label>
      <Field type="number" step="0.1" min="0" value={value} data-testid={testId} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TicketCell({ label, icon: Icon, def, val, onSet, onClear, testId }: {
  label: string; icon: LucideIcon; def: number; val: number | undefined;
  onSet: (n: number) => void; onClear: () => void; testId?: string;
}) {
  const current = val ?? def;
  const overridden = typeof val === "number";
  const [txt, setTxt] = useState(String(current));
  useEffect(() => { setTxt(String(current)); }, [current]);
  return (
    <div>
      <div className="text-[10px] font-display text-white/45 mb-0.5 flex items-center gap-1">
        <Icon size={10} /> {label}
        {overridden && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />}
      </div>
      <input
        type="number" min="0" inputMode="numeric" value={txt} data-testid={testId}
        onChange={(e) => {
          const s = e.target.value;
          setTxt(s);
          if (s.trim() === "") return;
          const n = Math.max(0, parseInt(s, 10) || 0);
          if (n === def) onClear();
          else onSet(n);
        }}
        className={`w-full px-2 py-2 rounded-lg bg-black/40 border text-white text-sm font-display font-bold text-center focus:outline-none ${overridden ? "border-yellow-400/50 text-yellow-200" : "border-white/12"}`}
      />
      <div className="text-[9px] text-white/25 font-display text-center mt-0.5">الأصلي: {def}</div>
    </div>
  );
}

function TicketEditor({ gameId }: { gameId: string }) {
  const { ticketOverrides } = useAdmin();
  const defaults = getDefaultTickets(gameId);
  const ov = ticketOverrides[gameId];
  if (defaults.length === 0) return null;
  const dirty = !!ov && Object.keys(ov).length > 0;
  return (
    <div className="rounded-xl bg-black/25 border border-yellow-400/15 p-3 mt-1">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-xs font-display font-bold text-yellow-300 flex items-center gap-1.5">
          <Trophy size={13} /> تعديل كل التذاكر ({defaults.length})
        </div>
        {dirty && (
          <button onClick={() => admin.resetGameTickets(gameId)} data-testid={`button-reset-tickets-${gameId}`}
            className="text-[10px] font-display text-white/50 flex items-center gap-1 px-2 py-1 rounded-lg bg-white/6">
            <RotateCcw size={11} /> استعادة الأصلي
          </button>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {defaults.map((t) => {
          const po = ov?.[t.id];
          const edited = !!po && Object.keys(po).length > 0;
          return (
            <div key={t.id} className={`rounded-xl border p-2.5 ${edited ? "border-yellow-400/30 bg-yellow-400/5" : "border-white/8 bg-white/4"}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-display font-black text-white">{TIER_AR[t.id] ?? t.name}</span>
                <span className="text-[10px] text-white/30 font-display">{t.name}</span>
                {edited && <span className="text-[9px] font-display text-yellow-300 bg-yellow-400/15 px-1.5 py-0.5 rounded-full">معدّل</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <TicketCell label="سعر الدخول" icon={Coins} def={t.price} val={po?.price}
                  onSet={(n) => admin.setTicketField(gameId, t.id, "price", n)} onClear={() => admin.clearTicketField(gameId, t.id, "price")} testId={`ticket-${gameId}-${t.id}-price`} />
                <TicketCell label="الجائزة" icon={Trophy} def={t.prize} val={po?.prize}
                  onSet={(n) => admin.setTicketField(gameId, t.id, "prize", n)} onClear={() => admin.clearTicketField(gameId, t.id, "prize")} testId={`ticket-${gameId}-${t.id}-prize`} />
                <TicketCell label="سكور الفوز" icon={Target} def={t.target} val={po?.target}
                  onSet={(n) => admin.setTicketField(gameId, t.id, "target", n)} onClear={() => admin.clearTicketField(gameId, t.id, "target")} testId={`ticket-${gameId}-${t.id}-target`} />
                <TicketCell label="الوقت (ث)" icon={Zap} def={t.time} val={po?.time}
                  onSet={(n) => admin.setTicketField(gameId, t.id, "time", n)} onClear={() => admin.clearTicketField(gameId, t.id, "time")} testId={`ticket-${gameId}-${t.id}-time`} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-white/35 font-display mt-2 leading-relaxed">
        القيم تُطبّق فوراً على اللعبة. المضاعفات العامة (قسم الاقتصاد) تُضرب فوق هذه القيم.
      </div>
    </div>
  );
}

function GameRow({ game, defaultRake }: { game: GameDef; defaultRake: number }) {
  const { gameOverrides, ticketOverrides } = useAdmin();
  const o = gameOverrides[game.id];
  const enabled = o?.enabled !== false;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(o?.title ?? game.title);
  const [tagline, setTagline] = useState(o?.tagline ?? game.tagline);
  const [desc, setDesc] = useState(o?.desc ?? game.desc);
  const [prize, setPrize] = useState(o?.prize ?? game.prize ?? "");
  const [entry, setEntry] = useState(String(o?.entry ?? game.entry ?? ""));
  const [feat, setFeat] = useState(!!o?.featured);
  const [prizeF, setPrizeF] = useState(String(o?.prizeFactor ?? 1));
  const [rake, setRake] = useState(String(o?.rake ?? defaultRake));
  const a = ACCENTS[game.accent];

  const defs = game.type === "skill" ? getDefaultTickets(game.id) : [];
  const tov = ticketOverrides[game.id];
  const eff = (t: BaseTicket, f: keyof TicketPatch) => tov?.[t.id]?.[f] ?? t[f];
  const summary = defs.length
    ? `دخول ${eff(defs[0], "price")}–${eff(defs[defs.length - 1], "price")} · جائزة ${eff(defs[0], "prize")}–${eff(defs[defs.length - 1], "prize")}`
    : `ساحة · ${o?.prize ?? game.prize} SKZ`;
  const tweaked = !!tov && Object.keys(tov).length > 0;

  function saveMeta() {
    admin.setGameOverride(game.id, {
      enabled,
      featured: feat,
      title: title.trim() || game.title,
      tagline: tagline.trim() || game.tagline,
      desc: desc.trim() || game.desc,
      rake: posNum(rake, defaultRake),
      ...(game.type === "arena"
        ? {
            prize: prize.trim() || game.prize,
            entry: entry.trim() === "" ? game.entry : Math.max(0, parseInt(entry) || 0),
            prizeFactor: posNum(prizeF),
          }
        : {}),
    });
    setOpen(false);
  }

  function resetLocal() {
    admin.resetGame(game.id);
    setTitle(game.title); setTagline(game.tagline); setDesc(game.desc);
    setPrize(game.prize ?? ""); setEntry(String(game.entry ?? ""));
    setFeat(false); setPrizeF("1"); setRake(String(defaultRake));
    setOpen(false);
  }

  return (
    <Card className={enabled ? "" : "opacity-60"}>
      <div className="flex items-center gap-3">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.dot }} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-display font-bold text-white truncate flex items-center gap-1.5">
            {o?.featured && <Star size={12} className="text-yellow-400 fill-yellow-400 shrink-0" />}
            {o?.title ?? game.title}
            {tweaked && <span className="text-[9px] font-display text-yellow-300 bg-yellow-400/15 px-1.5 py-0.5 rounded-full shrink-0">معدّل</span>}
          </div>
          <div className="text-[10px] text-white/40 font-display truncate">{summary} · عمولة {o?.rake ?? defaultRake}%</div>
        </div>
        <button onClick={() => setOpen((v) => !v)} data-testid={`button-edit-game-${game.id}`}
          className="px-3 h-9 rounded-xl bg-white/8 flex items-center justify-center gap-1.5 shrink-0">
          <Pencil size={14} className="text-white/70" />
          <span className="text-[11px] font-display font-bold text-white/70">{open ? "إغلاق" : "تعديل"}</span>
        </button>
        <Toggle on={enabled} onClick={() => admin.setGameOverride(game.id, { enabled: !enabled })} testId={`toggle-game-${game.id}`} />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-col gap-2.5 pt-3 mt-3 border-t border-white/8">
              <div className="grid sm:grid-cols-2 gap-2.5">
                <div><Label>العنوان</Label><Field value={title} data-testid={`input-title-${game.id}`} onChange={(e) => setTitle(e.target.value)} /></div>
                <div><Label>السطر الوصفي</Label><Field value={tagline} onChange={(e) => setTagline(e.target.value)} /></div>
              </div>
              <div><Label>الوصف</Label><Area rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>

              <div className="grid sm:grid-cols-2 gap-2.5">
                <FactorInput label="عمولة المنصة %" icon={Percent} value={rake} onChange={setRake} testId={`input-rake-${game.id}`} />
                {game.type === "arena" && (
                  <FactorInput label="مضاعف الجائزة ×" icon={Trophy} value={prizeF} onChange={setPrizeF} testId={`input-prizef-${game.id}`} />
                )}
              </div>

              {game.type === "arena" ? (
                <div className="rounded-xl bg-black/25 border border-yellow-400/15 p-3 mt-1 flex flex-col gap-2.5">
                  <div className="text-xs font-display font-bold text-yellow-300 flex items-center gap-1.5"><Trophy size={13} /> اقتصاد الساحة</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>الجائزة (نص)</Label><Field value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="+18K" /></div>
                    <div><Label>رسوم الدخول</Label><Field type="number" min="0" value={entry} data-testid={`input-entry-${game.id}`} onChange={(e) => setEntry(e.target.value)} /></div>
                  </div>
                  <div className="text-[10px] text-white/30 font-display">حصة الفائز = التجمّع × نسبة الفائز × مضاعف الجائزة (تُضبط النسبة من قسم الاقتصاد).</div>
                </div>
              ) : (
                <TicketEditor gameId={game.id} />
              )}

              <div className="flex items-center gap-2 px-1 mt-1">
                <Star size={15} className="text-yellow-400/70" />
                <span className="flex-1 text-xs font-display text-white/70">تمييز اللعبة (تثبيت بأعلى القائمة)</span>
                <Toggle on={feat} onClick={() => setFeat((v) => !v)} />
              </div>

              <div className="flex gap-2 mt-1">
                <button onClick={saveMeta} data-testid={`button-save-game-${game.id}`}
                  className="flex-1 py-2.5 rounded-xl bg-green-500/20 border border-green-400/40 text-green-300 text-xs font-display font-bold flex items-center justify-center gap-1.5">
                  <Save size={14} /> حفظ المعلومات
                </button>
                <button onClick={resetLocal} data-testid={`button-reset-game-${game.id}`}
                  className="px-4 py-2.5 rounded-xl bg-white/8 text-white/60 text-xs font-display font-bold flex items-center justify-center gap-1.5">
                  <RotateCcw size={14} /> افتراضي
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default function GamesSection() {
  const { gameOverrides, settings } = useAdmin();
  const hidden = Object.values(gameOverrides).filter((o) => o.enabled === false).length;
  const featured = Object.values(gameOverrides).filter((o) => o.featured).length;
  const total = ARENA_GAMES.length + SKILL_GAMES.length;

  return (
    <div>
      <SectionHeader title="الألعاب والأرباح" subtitle="تحكّم كامل بكل لعبة — التذاكر، الجوائز، العمولة، والتمييز" icon={Gamepad2} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="إجمالي الألعاب" value={total} icon={Gamepad2} tone="blue" />
        <StatCard label="ألعاب نشطة" value={total - hidden} icon={Gamepad2} tone="green" />
        <StatCard label="ألعاب مخفية" value={hidden} icon={Gamepad2} tone="red" />
        <StatCard label="ألعاب مميّزة" value={featured} icon={Star} tone="gold" />
      </div>

      <Card className="mb-5 border-primary/25" title="عمولة المنصة العامة" icon={Percent}>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-xs text-white/50 font-display leading-relaxed">
              نسبة المنصة الافتراضية من كل لعبة (يمكن تجاوزها لكل لعبة على حدة من زر التعديل).
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Field type="number" min="0" max="100" value={settings.platformRake} data-testid="input-platform-rake"
              onChange={(e) => admin.setSettings({ platformRake: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
              className="w-24 text-center" />
            <span className="text-lg font-display font-black text-primary">%</span>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <div>
          <div className="text-sm font-display font-black text-yellow-400/90 mb-2 flex items-center gap-1.5"><Trophy size={14} /> ساحة الجوائز ({ARENA_GAMES.length})</div>
          <div className="flex flex-col gap-2">{ARENA_GAMES.map((g) => <GameRow key={g.id} game={g} defaultRake={settings.platformRake} />)}</div>
        </div>
        <div>
          <div className="text-sm font-display font-black text-cyan-400/90 mb-2 flex items-center gap-1.5"><Gamepad2 size={14} /> ألعاب المهارة ({SKILL_GAMES.length})</div>
          <div className="flex flex-col gap-2">{SKILL_GAMES.map((g) => <GameRow key={g.id} game={g} defaultRake={settings.platformRake} />)}</div>
        </div>
      </div>
    </div>
  );
}
