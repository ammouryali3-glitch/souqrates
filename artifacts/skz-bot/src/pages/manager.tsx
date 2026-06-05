import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, LayoutDashboard, Gamepad2, Store, Bell, UserCog, Settings2,
  Coins, Plus, Minus, Trash2, Pencil, Check, X, Power, Ban, ShieldCheck,
  AlertTriangle, Package, Trophy, Save, RotateCcw,
} from "lucide-react";
import {
  useAdmin, useBalance, syncBalance, admin, getLibraryIds,
  type AppNotification, type NotifType, type Product,
} from "@/lib/admin-store";
import { ARENA_GAMES, SKILL_GAMES, ACCENTS, type GameDef } from "@/lib/games-data";
import { CATEGORIES, type Category } from "@/lib/shop-products";

type Tab = "overview" | "games" | "shop" | "notify" | "user" | "settings";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "نظرة عامة", icon: LayoutDashboard },
  { id: "games", label: "الألعاب", icon: Gamepad2 },
  { id: "shop", label: "المتجر", icon: Store },
  { id: "notify", label: "الإشعارات", icon: Bell },
  { id: "user", label: "المستخدم", icon: UserCog },
  { id: "settings", label: "الإعدادات", icon: Settings2 },
];

// ── tiny UI atoms ─────────────────────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/4 p-4 ${className}`}>{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-display font-bold text-white/40 mb-1">{children}</div>;
}
function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-sm font-display placeholder:text-white/25 focus:outline-none focus:border-yellow-400/40"
    />
  );
}
function Area(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-sm font-display placeholder:text-white/25 focus:outline-none focus:border-yellow-400/40 resize-none"
    />
  );
}
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${on ? "bg-green-500/80" : "bg-white/15"}`}>
      <motion.div animate={{ x: on ? 20 : 0 }} className="w-5 h-5 rounded-full bg-white shadow" />
    </button>
  );
}

// ── datetime helpers ──────────────────────────────────────────────────────────
function toLocalInput(ms: number) {
  const d = new Date(ms - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}
function fromLocalInput(s: string) {
  return s ? new Date(s).getTime() : Date.now();
}

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview({ go }: { go: (t: Tab) => void }) {
  const state = useAdmin();
  const balance = useBalance();
  const now = Date.now();
  const activeNotif = state.notifications.filter((n) => now >= n.startAt && now <= n.endAt).length;
  const hiddenGames = Object.values(state.gameOverrides).filter((o) => o.enabled === false).length;
  const lib = getLibraryIds().length;

  const stats: { label: string; value: string | number; icon: typeof Coins; color: string; tab: Tab }[] = [
    { label: "الرصيد", value: `${balance} SKZ`, icon: Coins, color: "text-yellow-300", tab: "user" },
    { label: "المنتجات", value: state.products.length, icon: Package, color: "text-cyan-300", tab: "shop" },
    { label: "إشعارات نشطة", value: activeNotif, icon: Bell, color: "text-fuchsia-300", tab: "notify" },
    { label: "ألعاب مخفية", value: hiddenGames, icon: Gamepad2, color: "text-orange-300", tab: "games" },
    { label: "مكتبة المستخدم", value: lib, icon: Store, color: "text-green-300", tab: "shop" },
    { label: "الحالة", value: state.banned ? "محظور" : "نشط", icon: ShieldCheck, color: state.banned ? "text-red-400" : "text-green-300", tab: "user" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <button key={s.label} onClick={() => go(s.tab)} className="text-right">
            <Card className="h-full active:scale-95 transition-transform">
              <s.icon size={18} className={s.color} />
              <div className="text-xl font-display font-black text-white mt-2">{s.value}</div>
              <div className="text-[11px] text-white/40 font-display">{s.label}</div>
            </Card>
          </button>
        ))}
      </div>
      {state.settings.maintenance && (
        <Card className="border-amber-400/40 bg-amber-500/10 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-300" />
          <span className="text-xs text-amber-200 font-display">وضع الصيانة مُفعّل حالياً</span>
        </Card>
      )}
    </div>
  );
}

// ── Games ─────────────────────────────────────────────────────────────────────
function GameRow({ game }: { game: GameDef }) {
  const { gameOverrides } = useAdmin();
  const o = gameOverrides[game.id];
  const enabled = o?.enabled !== false;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(o?.title ?? game.title);
  const [tagline, setTagline] = useState(o?.tagline ?? game.tagline);
  const [prize, setPrize] = useState(o?.prize ?? game.prize ?? "");
  const [entry, setEntry] = useState(String(o?.entry ?? game.entry ?? ""));
  const a = ACCENTS[game.accent];

  function save() {
    admin.setGameOverride(game.id, {
      enabled,
      title: title.trim() || game.title,
      tagline: tagline.trim() || game.tagline,
      ...(game.type === "arena"
        ? { prize: prize.trim() || game.prize, entry: parseInt(entry) || game.entry }
        : {}),
    });
    setOpen(false);
  }

  return (
    <Card className={enabled ? "" : "opacity-60"}>
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: a.dot }} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-display font-bold text-white truncate">{o?.title ?? game.title}</div>
          <div className="text-[10px] text-white/35 font-display">
            {game.type === "arena" ? `ساحة · ${o?.prize ?? game.prize} SKZ` : `مهارة · ${game.category}`}
          </div>
        </div>
        <button onClick={() => setOpen((v) => !v)}
          data-testid={`button-edit-game-${game.id}`}
          className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
          <Pencil size={14} className="text-white/60" />
        </button>
        <Toggle on={enabled} onClick={() => admin.setGameOverride(game.id, { enabled: !enabled })} />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="flex flex-col gap-2 pt-3 mt-3 border-t border-white/8">
              <div><Label>العنوان</Label><Field value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div><Label>السطر الوصفي</Label><Field value={tagline} onChange={(e) => setTagline(e.target.value)} /></div>
              {game.type === "arena" && (
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>الجائزة</Label><Field value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="+18K" /></div>
                  <div><Label>رسوم الدخول</Label><Field type="number" value={entry} onChange={(e) => setEntry(e.target.value)} /></div>
                </div>
              )}
              <div className="flex gap-2 mt-1">
                <button onClick={save} data-testid={`button-save-game-${game.id}`}
                  className="flex-1 py-2 rounded-xl bg-green-500/20 border border-green-400/40 text-green-300 text-xs font-display font-bold flex items-center justify-center gap-1.5">
                  <Save size={13} /> حفظ
                </button>
                <button onClick={() => { admin.resetGame(game.id); setTitle(game.title); setTagline(game.tagline); setPrize(game.prize ?? ""); setEntry(String(game.entry ?? "")); setOpen(false); }}
                  className="px-4 py-2 rounded-xl bg-white/8 text-white/60 text-xs font-display font-bold flex items-center justify-center gap-1.5">
                  <RotateCcw size={13} /> افتراضي
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function GamesTab() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-xs font-display font-bold text-yellow-400/80 mb-2 flex items-center gap-1.5"><Trophy size={12} /> ساحة الجوائز ({ARENA_GAMES.length})</div>
        <div className="flex flex-col gap-2">{ARENA_GAMES.map((g) => <GameRow key={g.id} game={g} />)}</div>
      </div>
      <div>
        <div className="text-xs font-display font-bold text-cyan-400/80 mb-2 flex items-center gap-1.5"><Gamepad2 size={12} /> ألعاب المهارة ({SKILL_GAMES.length})</div>
        <div className="flex flex-col gap-2">{SKILL_GAMES.map((g) => <GameRow key={g.id} game={g} />)}</div>
      </div>
    </div>
  );
}

// ── Shop ──────────────────────────────────────────────────────────────────────
const BADGES = ["", "BESTSELLER", "NEW", "FREE", "HOT", "TOP"] as const;
const SHOP_CATS = CATEGORIES.filter((c) => c !== "All") as Category[];

const EMPTY_PRODUCT: Omit<Product, "id"> = {
  title: "", titleAr: "", category: SHOP_CATS[0], price: 100, pages: 50,
  desc: "", rating: 4.5, downloads: 0, image: "https://picsum.photos/seed/skz/600/450",
};

function ProductForm({ initial, onSave, onCancel }: {
  initial: Omit<Product, "id">; onSave: (p: Omit<Product, "id">) => void; onCancel: () => void;
}) {
  const [p, setP] = useState(initial);
  const set = <K extends keyof Omit<Product, "id">>(k: K, v: Omit<Product, "id">[K]) => setP((s) => ({ ...s, [k]: v }));
  return (
    <Card className="border-yellow-400/30">
      <div className="flex flex-col gap-2">
        <div><Label>الاسم بالعربية</Label><Field value={p.titleAr} onChange={(e) => set("titleAr", e.target.value)} placeholder="دليل التداول" /></div>
        <div><Label>الاسم بالإنجليزية</Label><Field value={p.title} onChange={(e) => set("title", e.target.value)} placeholder="Trading Guide" /></div>
        <div>
          <Label>التصنيف</Label>
          <select value={p.category} onChange={(e) => set("category", e.target.value as Category)}
            className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-sm font-display focus:outline-none">
            {SHOP_CATS.map((c) => <option key={c} value={c} className="bg-[#13101f]">{c}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>السعر (SKZ)</Label><Field type="number" value={p.price} onChange={(e) => set("price", +e.target.value)} /></div>
          <div><Label>عدد الصفحات</Label><Field type="number" value={p.pages} onChange={(e) => set("pages", +e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>التقييم (0-5)</Label><Field type="number" step="0.1" value={p.rating} onChange={(e) => set("rating", +e.target.value)} /></div>
          <div><Label>التحميلات</Label><Field type="number" value={p.downloads} onChange={(e) => set("downloads", +e.target.value)} /></div>
        </div>
        <div>
          <Label>الشارة</Label>
          <select value={p.badge ?? ""} onChange={(e) => set("badge", (e.target.value || undefined) as Product["badge"])}
            className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-sm font-display focus:outline-none">
            {BADGES.map((b) => <option key={b} value={b} className="bg-[#13101f]">{b || "بدون"}</option>)}
          </select>
        </div>
        <div><Label>رابط الصورة</Label><Field value={p.image} onChange={(e) => set("image", e.target.value)} /></div>
        <div><Label>الوصف</Label><Area rows={3} value={p.desc} onChange={(e) => set("desc", e.target.value)} placeholder="وصف المنتج..." /></div>
        <div className="flex gap-2 mt-1">
          <button onClick={() => onSave(p)} data-testid="button-save-product"
            disabled={!p.titleAr.trim()}
            className="flex-1 py-2.5 rounded-xl bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 text-sm font-display font-bold flex items-center justify-center gap-1.5 disabled:opacity-40">
            <Check size={14} /> حفظ المنتج
          </button>
          <button onClick={onCancel} className="px-4 py-2.5 rounded-xl bg-white/8 text-white/60 text-sm font-display font-bold">إلغاء</button>
        </div>
      </div>
    </Card>
  );
}

function ShopTab() {
  const { products } = useAdmin();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {!adding && editId === null && (
        <button onClick={() => setAdding(true)} data-testid="button-add-product"
          className="py-2.5 rounded-xl bg-yellow-400/15 border border-yellow-400/30 text-yellow-300 text-sm font-display font-bold flex items-center justify-center gap-1.5">
          <Plus size={15} /> إضافة منتج جديد
        </button>
      )}
      {adding && (
        <ProductForm initial={EMPTY_PRODUCT}
          onSave={(p) => { admin.addProduct(p); setAdding(false); }}
          onCancel={() => setAdding(false)} />
      )}
      {products.length === 0 && !adding && (
        <Card className="text-center py-10">
          <Package size={28} className="text-white/20 mx-auto mb-2" />
          <div className="text-sm font-display text-white/40">لا توجد منتجات بعد</div>
        </Card>
      )}
      {products.map((p) =>
        editId === p.id ? (
          <ProductForm key={p.id} initial={p}
            onSave={(patch) => { admin.updateProduct(p.id, patch); setEditId(null); }}
            onCancel={() => setEditId(null)} />
        ) : (
          <Card key={p.id}>
            <div className="flex items-center gap-3">
              <img src={p.image} alt={p.titleAr} className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-display font-bold text-white truncate">{p.titleAr}</div>
                <div className="text-[10px] text-white/35 font-display">{p.category} · {p.price} SKZ</div>
              </div>
              <button onClick={() => setEditId(p.id)} data-testid={`button-edit-product-${p.id}`}
                className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
                <Pencil size={14} className="text-white/60" />
              </button>
              <button onClick={() => admin.deleteProduct(p.id)} data-testid={`button-delete-product-${p.id}`}
                className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                <Trash2 size={14} className="text-red-400" />
              </button>
            </div>
          </Card>
        ),
      )}
    </div>
  );
}

// ── Notifications ─────────────────────────────────────────────────────────────
const NOTIF_TYPES: { id: NotifType; label: string }[] = [
  { id: "info", label: "معلومة" },
  { id: "success", label: "نجاح" },
  { id: "warning", label: "تحذير" },
  { id: "promo", label: "عرض" },
];

function NotifyTab() {
  const { notifications } = useAdmin();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<NotifType>("info");
  const [start, setStart] = useState(() => toLocalInput(Date.now()));
  const [end, setEnd] = useState(() => toLocalInput(Date.now() + 60 * 60 * 1000));
  const now = Date.now();

  function quick(hours: number) {
    setStart(toLocalInput(Date.now()));
    setEnd(toLocalInput(Date.now() + hours * 60 * 60 * 1000));
  }

  function add() {
    if (!title.trim() || !message.trim()) return;
    admin.addNotification({ title: title.trim(), message: message.trim(), type, startAt: fromLocalInput(start), endAt: fromLocalInput(end) });
    setTitle(""); setMessage("");
  }

  const statusOf = (n: AppNotification) =>
    now < n.startAt ? { t: "مجدول", c: "text-cyan-300" } : now > n.endAt ? { t: "منتهٍ", c: "text-white/30" } : { t: "نشط الآن", c: "text-green-300" };

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-fuchsia-400/30 flex flex-col gap-2">
        <div className="text-sm font-display font-bold text-white mb-1">إشعار جديد</div>
        <div><Label>العنوان</Label><Field value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عرض خاص!" /></div>
        <div><Label>الرسالة</Label><Area rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="نص الإشعار..." /></div>
        <div>
          <Label>النوع</Label>
          <div className="flex gap-1.5">
            {NOTIF_TYPES.map((t) => (
              <button key={t.id} onClick={() => setType(t.id)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-display font-bold border transition-colors ${type === t.id ? "bg-fuchsia-500/25 border-fuchsia-400/50 text-fuchsia-200" : "bg-white/5 border-white/10 text-white/40"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>يبدأ</Label><Field type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><Label>ينتهي</Label><Field type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <div className="flex gap-1.5">
          {[1, 6, 24, 168].map((h) => (
            <button key={h} onClick={() => quick(h)}
              className="flex-1 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-[11px] font-display">
              {h < 24 ? `${h} ساعة` : h === 24 ? "يوم" : "أسبوع"}
            </button>
          ))}
        </div>
        <button onClick={add} data-testid="button-add-notification"
          disabled={!title.trim() || !message.trim()}
          className="mt-1 py-2.5 rounded-xl bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-200 text-sm font-display font-bold flex items-center justify-center gap-1.5 disabled:opacity-40">
          <Plus size={14} /> نشر الإشعار
        </button>
      </Card>

      {notifications.length > 0 && (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => {
            const st = statusOf(n);
            return (
              <Card key={n.id}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-display font-bold text-white truncate">{n.title}</span>
                      <span className={`text-[10px] font-display font-bold ${st.c}`}>● {st.t}</span>
                    </div>
                    <div className="text-xs text-white/55 font-display mt-0.5">{n.message}</div>
                    <div className="text-[10px] text-white/30 font-display mt-1">
                      {new Date(n.startAt).toLocaleString("ar")} ← {new Date(n.endAt).toLocaleString("ar")}
                    </div>
                  </div>
                  <button onClick={() => admin.deleteNotification(n.id)} data-testid={`button-delete-notification-${n.id}`}
                    className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── User ──────────────────────────────────────────────────────────────────────
function UserTab() {
  const state = useAdmin();
  const balance = useBalance();
  const [amount, setAmount] = useState("100");
  const amt = parseInt(amount) || 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Label>الرصيد الحالي</Label>
        <div className="flex items-center gap-2 mb-3">
          <Coins size={20} className="text-yellow-400" />
          <span className="text-3xl font-display font-black text-yellow-300">{balance}</span>
          <span className="text-sm text-white/40 font-display">SKZ</span>
        </div>
        <Label>المبلغ</Label>
        <div className="flex gap-2 mb-2">
          <Field type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex gap-1.5 mb-3">
          {[100, 500, 1000, 5000].map((v) => (
            <button key={v} onClick={() => setAmount(String(v))}
              className="flex-1 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-[11px] font-display">{v}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => admin.addBalance(amt)} data-testid="button-add-balance"
            className="flex-1 py-2.5 rounded-xl bg-green-500/20 border border-green-400/40 text-green-300 text-sm font-display font-bold flex items-center justify-center gap-1.5">
            <Plus size={14} /> إضافة
          </button>
          <button onClick={() => admin.deductBalance(amt)} data-testid="button-deduct-balance"
            className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-400/40 text-red-300 text-sm font-display font-bold flex items-center justify-center gap-1.5">
            <Minus size={14} /> خصم
          </button>
          <button onClick={() => admin.setBalance(amt)} data-testid="button-set-balance"
            className="flex-1 py-2.5 rounded-xl bg-white/8 text-white/60 text-sm font-display font-bold flex items-center justify-center gap-1.5">
            <Check size={14} /> تعيين
          </button>
        </div>
      </Card>

      <Card className={state.banned ? "border-red-500/40 bg-red-500/5" : ""}>
        <div className="flex items-center gap-3">
          {state.banned ? <Ban size={20} className="text-red-400" /> : <ShieldCheck size={20} className="text-green-400" />}
          <div className="flex-1">
            <div className="text-sm font-display font-bold text-white">{state.banned ? "المستخدم محظور" : "المستخدم نشط"}</div>
            <div className="text-[11px] text-white/40 font-display">{state.banned ? "لا يمكنه استخدام التطبيق" : "وصول كامل للتطبيق"}</div>
          </div>
          <button onClick={() => admin.setBanned(!state.banned)} data-testid="button-toggle-ban"
            className={`px-4 py-2 rounded-xl text-xs font-display font-bold border ${state.banned ? "bg-green-500/20 border-green-400/40 text-green-300" : "bg-red-500/20 border-red-400/40 text-red-300"}`}>
            {state.banned ? "رفع الحظر" : "حظر"}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function SettingsTab() {
  const { settings } = useAdmin();
  const [confirmReset, setConfirmReset] = useState(false);

  const rows: { key: keyof typeof settings; label: string; desc: string }[] = [
    { key: "shopEnabled", label: "المتجر", desc: "إظهار قسم السوق" },
    { key: "arenaEnabled", label: "ساحة الجوائز", desc: "إظهار ألعاب الجوائز" },
    { key: "skillEnabled", label: "ألعاب المهارة", desc: "إظهار ألعاب المهارة" },
    { key: "maintenance", label: "وضع الصيانة", desc: "شارة تنبيه في اللوحة" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <Card key={r.key}>
          <div className="flex items-center gap-3">
            <Power size={16} className="text-white/40" />
            <div className="flex-1">
              <div className="text-sm font-display font-bold text-white">{r.label}</div>
              <div className="text-[11px] text-white/40 font-display">{r.desc}</div>
            </div>
            <Toggle on={!!settings[r.key]} onClick={() => admin.setSettings({ [r.key]: !settings[r.key] })} />
          </div>
        </Card>
      ))}
      <Card>
        <Label>عدّاد المتصلين (يظهر في الساحة)</Label>
        <Field value={settings.onlineCount} onChange={(e) => admin.setSettings({ onlineCount: e.target.value })} placeholder="12.4k" />
      </Card>

      <Card className="border-red-500/30">
        <div className="text-sm font-display font-bold text-red-300 mb-1">منطقة الخطر</div>
        <div className="text-[11px] text-white/40 font-display mb-3">يُعيد ضبط كل الإعدادات والمنتجات والرصيد والمكتبة.</div>
        {confirmReset ? (
          <div className="flex gap-2">
            <button onClick={() => { admin.resetAll(); setConfirmReset(false); }} data-testid="button-confirm-reset"
              className="flex-1 py-2.5 rounded-xl bg-red-500/30 border border-red-400/50 text-red-200 text-sm font-display font-bold">
              تأكيد إعادة الضبط
            </button>
            <button onClick={() => setConfirmReset(false)} className="px-4 py-2.5 rounded-xl bg-white/8 text-white/60 text-sm font-display font-bold">إلغاء</button>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)} data-testid="button-reset-all"
            className="w-full py-2.5 rounded-xl bg-red-500/15 border border-red-400/30 text-red-300 text-sm font-display font-bold flex items-center justify-center gap-1.5">
            <RotateCcw size={14} /> إعادة ضبط الكل
          </button>
        )}
      </Card>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Manager() {
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => { syncBalance(); }, []);

  return (
    <div className="flex flex-col h-full bg-[#0a0815]" dir="rtl">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/8 bg-[#0d0a1a]">
        <div className="flex items-center gap-3">
          <Link href="/">
            <button data-testid="button-exit-manager" className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
              <ArrowRight size={17} className="text-white/70" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-display font-black text-white tracking-wide">لوحة التحكم</h1>
            <p className="text-[11px] text-white/35 font-display">إدارة كاملة — بدون مبرمج</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-yellow-600 to-amber-400 flex items-center justify-center">
            <UserCog size={17} className="text-black" />
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto mt-3 pb-1" style={{ scrollbarWidth: "none" }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} data-testid={`tab-${t.id}`}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-display font-bold border transition-colors shrink-0 ${tab === t.id ? "bg-yellow-400/15 border-yellow-400/40 text-yellow-300" : "bg-white/4 border-white/10 text-white/45"}`}>
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {tab === "overview" && <Overview go={setTab} />}
            {tab === "games" && <GamesTab />}
            {tab === "shop" && <ShopTab />}
            {tab === "notify" && <NotifyTab />}
            {tab === "user" && <UserTab />}
            {tab === "settings" && <SettingsTab />}
          </motion.div>
        </AnimatePresence>
        <div className="h-8" />
      </div>
    </div>
  );
}
