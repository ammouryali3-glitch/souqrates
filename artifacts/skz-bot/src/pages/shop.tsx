import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShoppingCart, Star, Download, FileText, X, Coins, TrendingUp, Zap, ChevronDown } from "lucide-react";
import { products, CATEGORIES, type Category, type Product } from "@/lib/shop-products";

const BALANCE_KEY = "skz_balance";

const BADGE_STYLE: Record<string, string> = {
  BESTSELLER: "bg-yellow-400/20 text-yellow-300 border-yellow-400/40",
  HOT:        "bg-red-500/20 text-red-300 border-red-500/40",
  NEW:        "bg-green-500/20 text-green-300 border-green-500/40",
  TOP:        "bg-purple-500/20 text-purple-300 border-purple-500/40",
  FREE:       "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
};

const CAT_COLOR: Record<string, string> = {
  "📚 كتب مترجمة": "#f59e0b",
  "🎓 كورسات":     "#818cf8",
  "📐 قوالب":      "#34d399",
  "💻 برمجة":      "#38bdf8",
  "🎨 تصميم":      "#f472b6",
  "💼 أعمال":      "#fb923c",
  "🤖 ذكاء اصطناعي": "#a78bfa",
  "📊 مالية":      "#4ade80",
};

type SortKey = "popular" | "newest" | "price_asc" | "price_desc" | "rating";

const SORT_LABELS: Record<SortKey, string> = {
  popular:    "الأكثر تحميلاً",
  newest:     "الأحدث",
  price_asc:  "السعر: من الأقل",
  price_desc: "السعر: من الأعلى",
  rating:     "الأعلى تقييماً",
};

function formatK(n: number) {
  return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);
}

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

function ProductCard({ product, onOpen }: { product: Product; onOpen: (p: Product) => void }) {
  const accent = CAT_COLOR[product.category] ?? "#d4af37";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.93 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.93 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onOpen(product)}
      className="flex flex-col rounded-2xl overflow-hidden border border-white/8 bg-white/4 cursor-pointer group"
      style={{ boxShadow: `0 0 0 0 ${accent}00` }}
    >
      {/* Image */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
        <img
          src={product.image}
          alt={product.titleAr}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        {/* PDF badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded-md">
          <FileText size={9} className="text-white/70" />
          <span className="text-[9px] text-white/70 font-display font-bold">PDF · {product.pages}p</span>
        </div>
        {product.badge && (
          <div className={`absolute top-2 right-2 text-[9px] font-display font-black px-1.5 py-0.5 rounded-md border ${BADGE_STYLE[product.badge]}`}>
            {product.badge}
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
        <div className="text-[10px] font-display font-bold tracking-wide truncate" style={{ color: accent }}>
          {product.category}
        </div>
        <h3 className="text-xs font-display font-bold text-white leading-tight line-clamp-2 min-h-[30px]">
          {product.titleAr}
        </h3>
        <Stars rating={product.rating} />
        <div className="flex items-center justify-between mt-auto pt-1 border-t border-white/6">
          <div className="flex items-baseline gap-0.5">
            <Coins size={11} className="text-yellow-400 shrink-0" />
            <span className="font-display font-black text-sm text-yellow-300">{product.price}</span>
            <span className="text-[10px] text-white/30 font-display">SKZ</span>
          </div>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: `${accent}25`, border: `1px solid ${accent}40` }}>
            <ShoppingCart size={12} style={{ color: accent }} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [balance, setBalance] = useState(() => parseInt(localStorage.getItem(BALANCE_KEY) || "1000"));
  const [bought, setBought] = useState(false);
  const accent = CAT_COLOR[product.category] ?? "#d4af37";

  function handleBuy() {
    if (balance < product.price) return;
    const nb = balance - product.price;
    setBalance(nb);
    localStorage.setItem(BALANCE_KEY, String(nb));
    setBought(true);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center px-2 pb-3"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[400px] rounded-3xl border overflow-hidden"
        style={{ background: "#0e0b18", borderColor: `${accent}30` }}
      >
        {/* Hero */}
        <div className="relative h-36 overflow-hidden">
          <img src={product.image} alt={product.titleAr} className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent 20%, #0e0b18 100%)` }} />
          <button onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
            <X size={16} className="text-white/70" />
          </button>
          {product.badge && (
            <div className={`absolute top-3 left-3 text-[10px] font-display font-black px-2 py-0.5 rounded-full border ${BADGE_STYLE[product.badge]}`}>
              {product.badge}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-5 pb-5 -mt-2">
          <div className="text-[10px] font-display font-bold tracking-widest mb-1" style={{ color: accent }}>
            {product.category}
          </div>
          <h2 className="font-display font-black text-xl text-white leading-tight mb-0.5">{product.titleAr}</h2>
          <div className="text-[11px] text-white/40 font-display mb-3 italic">{product.title}</div>

          {/* Stats row */}
          <div className="flex items-center gap-3 mb-3">
            <Stars rating={product.rating} />
            <div className="flex items-center gap-1 text-[10px] text-white/40">
              <Download size={10} />{formatK(product.downloads)} تحميل
            </div>
            <div className="flex items-center gap-1 text-[10px] text-white/40">
              <FileText size={10} />{product.pages} صفحة PDF
            </div>
          </div>

          <p className="text-xs text-white/60 leading-relaxed mb-4">{product.desc}</p>

          {/* Features */}
          <div className="flex flex-col gap-1.5 mb-4">
            {["📥 تحميل فوري بعد الشراء", "🔒 ملف PDF مؤمن عالي الجودة", "🔄 تحديثات مستقبلية مجانية", "✅ محتوى مرخص بالكامل"].map(f => (
              <div key={f} className="text-[11px] text-white/50 font-display flex items-center gap-2">
                <span>{f}</span>
              </div>
            ))}
          </div>

          {/* Price + Buy */}
          <div className="flex items-center gap-3">
            <div className="flex-1 flex flex-col">
              <div className="text-[10px] text-white/30 font-display">السعر</div>
              <div className="flex items-baseline gap-1">
                <Coins size={14} className="text-yellow-400" />
                <span className="font-display font-black text-2xl text-yellow-300">{product.price}</span>
                <span className="text-sm text-white/30 font-display">SKZ</span>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleBuy}
              disabled={bought || balance < product.price}
              className="flex-1 py-3.5 rounded-2xl font-display font-black text-sm tracking-wider flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
              style={!bought ? { background: `linear-gradient(135deg, ${accent}, ${accent}99)`, color: "#000", boxShadow: `0 0 20px ${accent}44` } : { background: "#16a34a30", border: "1px solid #16a34a50", color: "#4ade80" }}>
              {bought ? "✓ تم الشراء!" : <><ShoppingCart size={14} />شراء الآن</>}
            </motion.button>
          </div>
          {balance < product.price && !bought && (
            <div className="text-[10px] text-red-400/70 text-center mt-2 font-display">
              رصيدك {balance} SKZ — تحتاج {product.price - balance} SKZ إضافية
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Shop() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("popular");
  const [showSort, setShowSort] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    let list = products;
    if (activeCategory !== "All") list = list.filter(p => p.category === activeCategory);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => p.titleAr.toLowerCase().includes(q) || p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    switch (sort) {
      case "popular":    return [...list].sort((a,b) => b.downloads - a.downloads);
      case "newest":     return [...list].sort((a,b) => b.id - a.id);
      case "price_asc":  return [...list].sort((a,b) => a.price - b.price);
      case "price_desc": return [...list].sort((a,b) => b.price - a.price);
      case "rating":     return [...list].sort((a,b) => b.rating - a.rating);
      default:           return list;
    }
  }, [activeCategory, search, sort]);

  const totalDownloads = useMemo(() => products.reduce((acc, p) => acc + p.downloads, 0), []);

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-2xl font-display font-black text-white tracking-wider uppercase">Marketplace</h1>
            <p className="text-xs text-white/40 mt-0.5 font-display">
              {products.length} منتج رقمي · مرخص للبيع والتحميل
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 px-2.5 py-1 rounded-full">
              <TrendingUp size={11} className="text-green-400" />
              <span className="text-[10px] text-green-400 font-display font-bold">{formatK(totalDownloads)} تحميل</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5">
              <Zap size={10} className="text-yellow-400" />
              <span className="text-[10px] text-white/40 font-display">PDF · تحميل فوري</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث عن كتاب، كورس، قالب..."
            className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-white/6 border border-white/10 text-white text-xs font-display placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={12} className="text-white/30" />
            </button>
          )}
        </div>
        {/* Sort */}
        <div className="relative">
          <button
            onClick={() => setShowSort(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-white/6 border border-white/10 text-white/60 text-xs font-display whitespace-nowrap"
          >
            <ChevronDown size={12} />
            {SORT_LABELS[sort].split(":")[0]}
          </button>
          <AnimatePresence>
            {showSort && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="absolute top-full right-0 mt-1.5 z-40 rounded-2xl border border-white/10 overflow-hidden min-w-[160px]"
                style={{ background: "#13101f" }}
              >
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
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-display ${active ? "" : "bg-white/8 text-white/30"}`}
                style={active ? { background: `${color}30`, color } : {}}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-white/30 font-display">
          {filtered.length} نتيجة {search ? `لـ "${search}"` : ""}
        </span>
        {activeCategory !== "All" && (
          <button onClick={() => setActiveCategory("All")} className="text-[11px] text-white/30 font-display flex items-center gap-1">
            <X size={10} /> إلغاء الفلتر
          </button>
        )}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 gap-2.5 pb-28">
        <AnimatePresence mode="popLayout">
          {filtered.map(p => (
            <ProductCard key={p.id} product={p} onOpen={setSelected} />
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="col-span-2 text-center py-16 text-white/30 font-display">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-sm font-bold">لا توجد نتائج</div>
            <div className="text-xs mt-1">جرّب بحثاً مختلفاً</div>
          </motion.div>
        )}
      </div>

      {/* Product Modal */}
      <AnimatePresence>
        {selected && <ProductModal product={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
