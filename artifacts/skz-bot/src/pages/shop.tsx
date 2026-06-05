import { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ShoppingCart, Star, Download, FileText, X,
  Coins, TrendingUp, Zap, ChevronDown, BookOpen,
  CheckCircle, Package, ArrowLeft, ExternalLink,
} from "lucide-react";
import { products, CATEGORIES, type Category, type Product } from "@/lib/shop-products";

const BALANCE_KEY  = "skz_balance";
const LIBRARY_KEY  = "skz_library";

function getLibrary(): number[] {
  try { return JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]"); } catch { return []; }
}
function addToLibrary(id: number) {
  const lib = getLibrary();
  if (!lib.includes(id)) localStorage.setItem(LIBRARY_KEY, JSON.stringify([...lib, id]));
}

// ── Visual helpers ──────────────────────────────────────────────────────────

const BADGE_STYLE: Record<string, string> = {
  BESTSELLER: "bg-yellow-400/20 text-yellow-300 border-yellow-400/40",
  HOT:        "bg-red-500/20 text-red-300 border-red-500/40",
  NEW:        "bg-green-500/20 text-green-300 border-green-500/40",
  TOP:        "bg-purple-500/20 text-purple-300 border-purple-500/40",
  FREE:       "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
};
const CAT_COLOR: Record<string, string> = {
  "📚 كتب مترجمة":      "#f59e0b",
  "🎓 كورسات":          "#818cf8",
  "📐 قوالب":           "#34d399",
  "💻 برمجة":           "#38bdf8",
  "🎨 تصميم":           "#f472b6",
  "💼 أعمال":           "#fb923c",
  "🤖 ذكاء اصطناعي":   "#a78bfa",
  "📊 مالية":           "#4ade80",
};
const accent = (cat: string) => CAT_COLOR[cat] ?? "#d4af37";

type SortKey = "popular" | "newest" | "price_asc" | "price_desc" | "rating";
const SORT_LABELS: Record<SortKey, string> = {
  popular:    "الأكثر تحميلاً",
  newest:     "الأحدث",
  price_asc:  "السعر: من الأقل",
  price_desc: "السعر: من الأعلى",
  rating:     "الأعلى تقييماً",
};

function formatK(n: number) { return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n); }

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={9}
          className={i <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-white/15 fill-white/15"} />
      ))}
      <span className="text-[10px] text-white/40 ml-0.5 font-display">{rating.toFixed(1)}</span>
    </div>
  );
}

// ── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ product, owned, onOpen }: { product: Product; owned: boolean; onOpen: (p: Product) => void }) {
  const ac = accent(product.category);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.93 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.93 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onOpen(product)}
      className="flex flex-col rounded-2xl overflow-hidden border border-white/8 bg-white/4 cursor-pointer group"
    >
      {/* Image */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
        <img
          src={product.image} alt={product.titleAr}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
        {/* PDF tag */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded-md">
          <FileText size={9} className="text-white/70" />
          <span className="text-[9px] text-white/70 font-display font-bold">PDF · {product.pages}p</span>
        </div>
        {/* Badge */}
        {product.badge && !owned && (
          <div className={`absolute top-2 right-2 text-[9px] font-display font-black px-1.5 py-0.5 rounded-md border ${BADGE_STYLE[product.badge]}`}>
            {product.badge}
          </div>
        )}
        {/* Owned check */}
        {owned && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-500/80 backdrop-blur px-1.5 py-0.5 rounded-md">
            <CheckCircle size={9} className="text-white" />
            <span className="text-[9px] text-white font-display font-bold">مملوك</span>
          </div>
        )}
        {/* Downloads */}
        <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-black/50 backdrop-blur px-1.5 py-0.5 rounded-md">
          <Download size={9} className="text-white/60" />
          <span className="text-[9px] text-white/60 font-display">{formatK(product.downloads)}</span>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 p-2.5 flex-1">
        <div className="text-[10px] font-display font-bold tracking-wide truncate" style={{ color: ac }}>
          {product.category}
        </div>
        <h3 className="text-xs font-display font-bold text-white leading-tight line-clamp-2 min-h-[30px]">
          {product.titleAr}
        </h3>
        <Stars rating={product.rating} />
        <div className="flex items-center justify-between mt-auto pt-1 border-t border-white/6">
          {owned ? (
            <div className="flex items-center gap-1 text-green-400 text-[10px] font-display font-bold">
              <Download size={11} /> تحميل
            </div>
          ) : (
            <div className="flex items-baseline gap-0.5">
              <Coins size={11} className="text-yellow-400 shrink-0" />
              <span className="font-display font-black text-sm text-yellow-300">{product.price}</span>
              <span className="text-[10px] text-white/30 font-display">SKZ</span>
            </div>
          )}
          <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: owned ? "#16a34a30" : `${ac}25`, border: `1px solid ${owned ? "#16a34a50" : `${ac}40`}` }}>
            {owned ? <Download size={12} className="text-green-400" /> : <ShoppingCart size={12} style={{ color: ac }} />}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Product Modal (rendered via Portal to escape overflow:hidden) ─────────────

function ProductModal({ product, owned: initOwned, balance: initBalance, onClose, onBuy }: {
  product: Product; owned: boolean; balance: number;
  onClose: () => void; onBuy: (p: Product) => void;
}) {
  const [bought, setBought] = useState(initOwned);
  const [bal, setBal] = useState(initBalance);
  const ac = accent(product.category);
  const canAfford = bal >= product.price;

  function handleBuy() {
    if (bought || !canAfford) return;
    const nb = bal - product.price;
    setBal(nb);
    localStorage.setItem(BALANCE_KEY, String(nb));
    addToLibrary(product.id);
    setBought(true);
    onBuy(product);
  }

  const modal = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-end justify-center px-3 pb-4"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 340 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[430px] rounded-3xl border overflow-hidden flex flex-col"
        style={{ background: "#0e0b18", borderColor: `${ac}35`, maxHeight: "88vh" }}
      >
        {/* Hero image */}
        <div className="relative shrink-0" style={{ height: 160 }}>
          <img src={product.image} alt={product.titleAr} className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, #0e0b18 100%)` }} />
          <button onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/10">
            <X size={17} className="text-white/80" />
          </button>
          {product.badge && !bought && (
            <div className={`absolute top-3 left-3 text-[10px] font-display font-black px-2 py-0.5 rounded-full border ${BADGE_STYLE[product.badge]}`}>
              {product.badge}
            </div>
          )}
          {bought && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-green-500/80 backdrop-blur px-2.5 py-1 rounded-full">
              <CheckCircle size={11} className="text-white" />
              <span className="text-[11px] text-white font-display font-bold">في مكتبتك</span>
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 pb-5 pt-1" style={{ WebkitOverflowScrolling: "touch" }}>
          {/* Category + Titles */}
          <div className="text-[10px] font-display font-bold tracking-widest mb-1 mt-2" style={{ color: ac }}>
            {product.category}
          </div>
          <h2 className="font-display font-black text-xl text-white leading-tight">{product.titleAr}</h2>
          <p className="text-[11px] text-white/35 font-display mt-0.5 mb-3 italic">{product.title}</p>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Stars rating={product.rating} />
            <div className="flex items-center gap-1 text-[10px] text-white/40 font-display">
              <Download size={10} />{formatK(product.downloads)} تحميل
            </div>
            <div className="flex items-center gap-1 text-[10px] text-white/40 font-display">
              <FileText size={10} />{product.pages} صفحة PDF
            </div>
          </div>

          {/* Description */}
          <div className="px-4 py-3 rounded-2xl border border-white/8 bg-white/4 mb-4">
            <p className="text-sm text-white/75 leading-relaxed">{product.desc}</p>
          </div>

          {/* Features list */}
          <div className="flex flex-col gap-2 mb-5">
            {[
              ["📥", "تحميل فوري بعد الشراء"],
              ["🔒", "ملف PDF عالي الجودة"],
              ["🔄", "تحديثات مستقبلية مجانية"],
              ["✅", "محتوى مرخص قانونياً للبيع والتوزيع"],
              ["📱", "يعمل على جميع الأجهزة والتطبيقات"],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-2.5">
                <span className="text-base w-5 text-center">{icon}</span>
                <span className="text-xs text-white/55 font-display">{text}</span>
              </div>
            ))}
          </div>

          {/* Price + CTA */}
          <div className="rounded-2xl border p-4 flex flex-col gap-3" style={{ borderColor: `${ac}30`, background: `${ac}0a` }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-white/30 font-display mb-0.5">السعر</div>
                <div className="flex items-baseline gap-1">
                  <Coins size={16} className="text-yellow-400" />
                  <span className="font-display font-black text-2xl text-yellow-300">{product.price}</span>
                  <span className="text-sm text-white/30 font-display">SKZ</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-white/30 font-display mb-0.5">رصيدك</div>
                <div className="font-display font-bold text-base text-white">{bal} SKZ</div>
              </div>
            </div>

            {bought ? (
              <div className="w-full py-3.5 rounded-2xl bg-green-500/20 border border-green-500/40 flex items-center justify-center gap-2">
                <CheckCircle size={16} className="text-green-400" />
                <span className="font-display font-black text-sm text-green-300">تم الشراء — في مكتبتك!</span>
              </div>
            ) : (
              <>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleBuy}
                  disabled={!canAfford}
                  className="w-full py-3.5 rounded-2xl font-display font-black text-sm tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-35"
                  style={{ background: `linear-gradient(135deg, ${ac}, ${ac}99)`, color: "#000", boxShadow: canAfford ? `0 0 24px ${ac}44` : "none" }}
                >
                  <ShoppingCart size={16} />
                  شراء مقابل {product.price} SKZ
                </motion.button>
                {!canAfford && (
                  <div className="text-center text-[11px] text-red-400/70 font-display">
                    تحتاج {product.price - bal} SKZ إضافية للشراء
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  return createPortal(modal, document.body);
}

// ── My Library Panel ──────────────────────────────────────────────────────────

function LibraryPanel({ library }: { library: number[] }) {
  const owned = useMemo(() => products.filter(p => library.includes(p.id)), [library]);

  if (owned.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
          <BookOpen size={32} className="text-white/20" />
        </div>
        <div className="text-center">
          <div className="font-display font-black text-lg text-white/40">مكتبتك فارغة</div>
          <div className="text-xs text-white/25 font-display mt-1">اشترِ منتجاً لتراه هنا فوراً</div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-28">
      {/* Stats bar */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/4 border border-white/8">
        <Package size={18} className="text-yellow-400 shrink-0" />
        <div>
          <div className="text-sm font-display font-black text-white">{owned.length} منتج مكتسب</div>
          <div className="text-[10px] text-white/30 font-display">
            إجمالي: {owned.reduce((s, p) => s + p.price, 0).toLocaleString()} SKZ
          </div>
        </div>
        <div className="ml-auto text-[11px] text-white/30 font-display">{owned.reduce((s, p) => s + p.pages, 0)} صفحة</div>
      </div>

      {/* Library items */}
      {owned.map((p, i) => {
        const ac = accent(p.category);
        return (
          <motion.div key={p.id}
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3 p-3 rounded-2xl border border-white/8 bg-white/4">
            {/* Thumbnail */}
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10">
              <img src={p.image} alt={p.titleAr} className="w-full h-full object-cover" />
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-display font-bold mb-0.5" style={{ color: ac }}>{p.category}</div>
              <div className="text-sm font-display font-bold text-white leading-tight line-clamp-2">{p.titleAr}</div>
              <div className="flex items-center gap-2 mt-1">
                <Stars rating={p.rating} />
                <span className="text-[10px] text-white/30 font-display">· {p.pages}p PDF</span>
              </div>
            </div>
            {/* Download btn */}
            <button
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors"
              style={{ background: `${ac}20`, borderColor: `${ac}40` }}>
              <Download size={15} style={{ color: ac }} />
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Main Shop Component ───────────────────────────────────────────────────────

export default function Shop() {
  const [tab, setTab] = useState<"store" | "library">("store");
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("popular");
  const [showSort, setShowSort] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [balance, setBalance] = useState(() => parseInt(localStorage.getItem(BALANCE_KEY) || "1000"));
  const [library, setLibrary] = useState<number[]>(() => getLibrary());

  const handleBuy = useCallback((p: Product) => {
    setBalance(b => b - p.price);
    setLibrary(getLibrary());
  }, []);

  const filtered = useMemo(() => {
    let list = products;
    if (activeCategory !== "All") list = list.filter(p => p.category === activeCategory);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p =>
        p.titleAr.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    switch (sort) {
      case "popular":    return [...list].sort((a, b) => b.downloads - a.downloads);
      case "newest":     return [...list].sort((a, b) => b.id - a.id);
      case "price_asc":  return [...list].sort((a, b) => a.price - b.price);
      case "price_desc": return [...list].sort((a, b) => b.price - a.price);
      case "rating":     return [...list].sort((a, b) => b.rating - a.rating);
      default:           return list;
    }
  }, [activeCategory, search, sort]);

  return (
    <div className="flex flex-col gap-0">
      {/* ── Header ── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-2xl font-display font-black text-white tracking-wider uppercase">Marketplace</h1>
            <p className="text-xs text-white/40 mt-0.5 font-display">
              {products.length} منتج رقمي · مرخص للبيع والتحميل
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/30 px-2.5 py-1 rounded-full">
              <Coins size={11} className="text-yellow-400" />
              <span className="text-[11px] text-yellow-300 font-display font-bold">{balance} SKZ</span>
            </div>
            {library.length > 0 && (
              <button onClick={() => setTab("library")}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/25">
                <Package size={10} className="text-green-400" />
                <span className="text-[10px] text-green-400 font-display">{library.length} منتج</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Switch */}
        <div className="flex items-center gap-0 mt-3 rounded-2xl border border-white/10 bg-white/4 p-1">
          {([["store","🛒 السوق"], ["library","📚 مكتبتي"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2 rounded-xl text-xs font-display font-bold transition-all flex items-center justify-center gap-1.5 ${tab === key ? "bg-yellow-400/15 text-yellow-300 border border-yellow-400/30" : "text-white/40"}`}>
              {label}
              {key === "library" && library.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-yellow-400/20 text-yellow-300 text-[9px] font-display font-black flex items-center justify-center">
                  {library.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Library Tab ── */}
      <AnimatePresence mode="wait">
        {tab === "library" && (
          <motion.div key="lib" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <LibraryPanel library={library} />
          </motion.div>
        )}

        {/* ── Store Tab ── */}
        {tab === "store" && (
          <motion.div key="store" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>

            {/* Search + Sort */}
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="ابحث عن كتاب، كورس، قالب..."
                  className="w-full pl-9 pr-8 py-2.5 rounded-2xl bg-white/6 border border-white/10 text-white text-xs font-display placeholder:text-white/25 focus:outline-none focus:border-white/25"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X size={12} className="text-white/30" />
                  </button>
                )}
              </div>
              {/* Sort */}
              <div className="relative">
                <button onClick={() => setShowSort(v => !v)}
                  className="flex items-center gap-1 px-3 py-2.5 rounded-2xl bg-white/6 border border-white/10 text-white/50 text-[11px] font-display whitespace-nowrap">
                  <ChevronDown size={12} />{SORT_LABELS[sort].split(":")[0]}
                </button>
                <AnimatePresence>
                  {showSort && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      className="absolute top-full right-0 mt-1 z-40 rounded-2xl border border-white/10 overflow-hidden min-w-[160px] shadow-2xl"
                      style={{ background: "#13101f" }}>
                      {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                        <button key={k} onClick={() => { setSort(k); setShowSort(false); }}
                          className={`w-full text-right px-4 py-2.5 text-xs font-display transition-colors hover:bg-white/8 ${sort === k ? "text-yellow-300 bg-yellow-400/10" : "text-white/60"}`}>
                          {SORT_LABELS[k]}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3" style={{ scrollbarWidth: "none" }}>
              {CATEGORIES.map(cat => {
                const count = cat === "All" ? products.length : products.filter(p => p.category === cat).length;
                const color = cat === "All" ? "#d4af37" : (CAT_COLOR[cat] ?? "#d4af37");
                const active = activeCategory === cat;
                return (
                  <button key={cat} onClick={() => setActiveCategory(cat)}
                    className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-display font-bold transition-all shrink-0 border"
                    style={active
                      ? { background: `${color}25`, borderColor: `${color}60`, color }
                      : { background: "transparent", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}>
                    {cat === "All" ? "🌐 الكل" : cat}
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-display"
                      style={active ? { background: `${color}30`, color } : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] text-white/30 font-display">
                {filtered.length} نتيجة{search ? ` لـ "${search}"` : ""}
              </span>
              {activeCategory !== "All" && (
                <button onClick={() => setActiveCategory("All")}
                  className="text-[11px] text-white/30 font-display flex items-center gap-1">
                  <X size={10} />إلغاء الفلتر
                </button>
              )}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 gap-2.5 pb-28">
              <AnimatePresence mode="popLayout">
                {filtered.map(p => (
                  <ProductCard key={p.id} product={p} owned={library.includes(p.id)} onOpen={setSelected} />
                ))}
              </AnimatePresence>
              {filtered.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="col-span-2 text-center py-16 text-white/30 font-display">
                  <div className="text-4xl mb-3">🔍</div>
                  <div className="text-sm font-bold">لا توجد نتائج</div>
                  <div className="text-xs mt-1 opacity-60">جرّب بحثاً مختلفاً</div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Product Modal via Portal ── */}
      <AnimatePresence>
        {selected && (
          <ProductModal
            key={selected.id}
            product={selected}
            owned={library.includes(selected.id)}
            balance={balance}
            onClose={() => setSelected(null)}
            onBuy={handleBuy}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
