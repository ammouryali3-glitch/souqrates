import { useEffect, useState } from "react";
import {
  Store, Coins, Trophy, Target, Gift, Sparkles, Plus, Pencil, Trash2,
  Package, Boxes, Tag, AlertTriangle, type LucideIcon,
} from "lucide-react";
import { useAdmin, admin, type Product } from "../../lib/admin-store";
import { CATEGORIES, type Category } from "../../lib/shop-products";
import type { TokenPackage, InventoryItem } from "../../lib/admin-types";
import {
  Card, SectionHeader, StatCard, Label, Field, Area, Select, Toggle, Button,
  Pill, Table, Th, Td, EmptyState, Modal, fmt, fmtCur,
} from "./_ui";

// ── Economy factors ───────────────────────────────────────────────────────────
function FactorSetting({ label, desc, icon: Icon, value, onChange, presets, suffix = "×" }: {
  label: string; desc: string; icon: LucideIcon; value: number;
  onChange: (v: number) => void; presets: number[]; suffix?: string;
}) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => { setTxt(String(value)); }, [value]);
  return (
    <Card>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={15} className="text-primary/80" />
        <div className="flex-1">
          <div className="text-sm font-display font-bold text-white">{label}</div>
          <div className="text-[10px] text-white/40 font-display">{desc}</div>
        </div>
        <div className="text-base font-display font-black text-primary">{value}{suffix}</div>
      </div>
      <Field type="number" step="0.1" min="0" value={txt}
        onChange={(e) => { setTxt(e.target.value); const n = parseFloat(e.target.value); if (Number.isFinite(n) && n >= 0) onChange(n); }} />
      <div className="flex gap-1.5 mt-2">
        {presets.map((p) => (
          <button key={p} onClick={() => onChange(p)}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-display font-bold border transition-colors ${value === p ? "bg-primary/20 border-primary/40 text-primary" : "bg-white/5 border-white/10 text-white/45"}`}>
            {p}{suffix}
          </button>
        ))}
      </div>
    </Card>
  );
}

function EconomyControls() {
  const { settings } = useAdmin();
  const set = (patch: Parameters<typeof admin.setSettings>[0]) => admin.setSettings(patch);
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <Card className={`lg:col-span-2 ${settings.freePlay ? "border-green-400/40 bg-green-500/8" : ""}`}>
        <div className="flex items-center gap-3">
          <Gift size={17} className={settings.freePlay ? "text-green-300" : "text-white/40"} />
          <div className="flex-1">
            <div className="text-sm font-display font-bold text-white">اللعب المجاني</div>
            <div className="text-[11px] text-white/40 font-display">كل الألعاب بدون رسوم دخول</div>
          </div>
          <Toggle on={settings.freePlay} onClick={() => set({ freePlay: !settings.freePlay })} testId="toggle-freeplay" />
        </div>
      </Card>

      <FactorSetting label="مضاعف الأسعار" desc="يضرب رسوم الدخول لكل الألعاب" icon={Coins}
        value={settings.globalPriceFactor} onChange={(v) => set({ globalPriceFactor: v })} presets={[0.5, 1, 1.5, 2]} />
      <FactorSetting label="مضاعف الجوائز" desc="يضرب كل الجوائز المدفوعة للفائزين" icon={Trophy}
        value={settings.globalPrizeFactor} onChange={(v) => set({ globalPrizeFactor: v })} presets={[1, 1.5, 2, 3]} />
      <FactorSetting label="مضاعف الصعوبة" desc="يضرب السكور المطلوب للفوز (أقل = أسهل)" icon={Target}
        value={settings.globalDifficulty} onChange={(v) => set({ globalDifficulty: v })} presets={[0.5, 0.75, 1, 1.5]} />

      <Card>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={15} className="text-primary/80" />
          <div className="flex-1">
            <div className="text-sm font-display font-bold text-white">حصة الفائز (الساحة)</div>
            <div className="text-[10px] text-white/40 font-display">نسبة الفائز من تجمّع الجوائز</div>
          </div>
          <div className="text-base font-display font-black text-primary">{Math.round(settings.winnerCut * 100)}%</div>
        </div>
        <div className="flex gap-1.5">
          {[0.5, 0.75, 0.9, 0.95, 1].map((p) => (
            <button key={p} onClick={() => set({ winnerCut: p })}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-display font-bold border transition-colors ${settings.winnerCut === p ? "bg-primary/20 border-primary/40 text-primary" : "bg-white/5 border-white/10 text-white/45"}`}>
              {Math.round(p * 100)}%
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <Label>الرصيد الابتدائي (للاعب الجديد / بعد إعادة الضبط)</Label>
        <Field type="number" min="0" value={settings.startingBalance} data-testid="input-starting-balance"
          onChange={(e) => set({ startingBalance: Math.max(0, parseInt(e.target.value) || 0) })} />
        <Button variant="primary" icon={Coins} className="w-full mt-2" onClick={() => admin.applyStartingBalance()} data-testid="button-apply-balance">
          تطبيق على الرصيد الحالي
        </Button>
      </Card>
    </div>
  );
}

// ── Token packages ────────────────────────────────────────────────────────────
const EMPTY_PKG: Omit<TokenPackage, "id"> = { skz: 1000, price: 1, currency: "USDT", bonus: 0, active: true };

function PackageModal({ open, initial, onClose, onSave }: {
  open: boolean; initial: Omit<TokenPackage, "id">; onClose: () => void; onSave: (p: Omit<TokenPackage, "id">) => void;
}) {
  const [p, setP] = useState(initial);
  useEffect(() => { setP(initial); }, [initial, open]);
  const set = <K extends keyof Omit<TokenPackage, "id">>(k: K, v: Omit<TokenPackage, "id">[K]) => setP((s) => ({ ...s, [k]: v }));
  return (
    <Modal open={open} onClose={onClose} title="حزمة توكن">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div><Label>عدد SKZ</Label><Field type="number" min="0" value={p.skz} onChange={(e) => set("skz", +e.target.value)} /></div>
          <div><Label>المكافأة (SKZ)</Label><Field type="number" min="0" value={p.bonus} onChange={(e) => set("bonus", +e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>السعر</Label><Field type="number" min="0" step="0.01" value={p.price} onChange={(e) => set("price", +e.target.value)} /></div>
          <div><Label>العملة</Label><Select value={p.currency} onChange={(e) => set("currency", e.target.value as TokenPackage["currency"])}>
            <option value="USDT" className="bg-[#13101f]">USDT</option>
            <option value="TON" className="bg-[#13101f]">TON</option>
          </Select></div>
        </div>
        <label className="flex items-center gap-2 text-sm font-display text-white/70">
          <input type="checkbox" checked={!!p.popular} onChange={(e) => set("popular", e.target.checked)} /> الأكثر رواجاً
        </label>
        <div className="flex gap-2 mt-1">
          <Button variant="green" className="flex-1" onClick={() => onSave(p)} data-testid="button-save-package">حفظ</Button>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        </div>
      </div>
    </Modal>
  );
}

function TokenPackages() {
  const { tokenPackages } = useAdmin();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const editing = tokenPackages.find((p) => p.id === editId);

  return (
    <Card title="حزم التوكن (شراء SKZ)" icon={Coins} action={<Button icon={Plus} onClick={() => setAdding(true)} data-testid="button-add-package">حزمة</Button>}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tokenPackages.map((p) => (
          <div key={p.id} className={`rounded-xl border p-3 ${p.popular ? "border-primary/40 bg-primary/5" : "border-white/10 bg-black/20"}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-display font-black text-white">{fmt(p.skz)} <span className="text-xs text-white/40">SKZ</span></div>
                {p.bonus > 0 && <div className="text-[11px] font-display text-green-300">+{fmt(p.bonus)} مكافأة</div>}
              </div>
              {p.popular && <Pill tone="gold">رائج</Pill>}
            </div>
            <div className="text-sm font-display font-bold text-primary mt-2">{p.price} {p.currency}</div>
            <div className="flex items-center gap-1.5 mt-3">
              <Toggle on={p.active} onClick={() => admin.updateTokenPackage(p.id, { active: !p.active })} testId={`toggle-package-${p.id}`} />
              <span className="flex-1 text-[10px] font-display text-white/40">{p.active ? "مفعّلة" : "معطّلة"}</span>
              <button onClick={() => setEditId(p.id)} className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center"><Pencil size={13} className="text-white/60" /></button>
              <button onClick={() => admin.deleteTokenPackage(p.id)} className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center"><Trash2 size={13} className="text-red-400" /></button>
            </div>
          </div>
        ))}
      </div>
      <PackageModal open={adding} initial={EMPTY_PKG} onClose={() => setAdding(false)}
        onSave={(p) => { admin.addTokenPackage(p); setAdding(false); }} />
      <PackageModal open={!!editing} initial={editing ?? EMPTY_PKG} onClose={() => setEditId(null)}
        onSave={(p) => { if (editId) admin.updateTokenPackage(editId, p); setEditId(null); }} />
    </Card>
  );
}

// ── Digital inventory ─────────────────────────────────────────────────────────
const EMPTY_INV: Omit<InventoryItem, "id"> = {
  title: "", category: "💻 برمجة", priceSkz: 1000, priceTon: 0.3, priceUsdt: 2,
  stock: 0, safeThreshold: 3, codes: [], active: true,
};

function InventoryModal({ open, initial, onClose, onSave }: {
  open: boolean; initial: Omit<InventoryItem, "id">; onClose: () => void; onSave: (i: Omit<InventoryItem, "id">) => void;
}) {
  const [it, setIt] = useState(initial);
  const [codesText, setCodesText] = useState(initial.codes.join("\n"));
  useEffect(() => { setIt(initial); setCodesText(initial.codes.join("\n")); }, [initial, open]);
  const set = <K extends keyof Omit<InventoryItem, "id">>(k: K, v: Omit<InventoryItem, "id">[K]) => setIt((s) => ({ ...s, [k]: v }));
  function save() {
    const codes = codesText.split("\n").map((c) => c.trim()).filter(Boolean);
    onSave({ ...it, codes, stock: codes.length });
  }
  return (
    <Modal open={open} onClose={onClose} title="منتج رقمي" wide>
      <div className="flex flex-col gap-3">
        <div><Label>العنوان</Label><Field value={it.title} onChange={(e) => set("title", e.target.value)} placeholder="دورة React" /></div>
        <div><Label>التصنيف</Label><Field value={it.category} onChange={(e) => set("category", e.target.value)} placeholder="💻 برمجة" /></div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>سعر SKZ</Label><Field type="number" min="0" value={it.priceSkz} onChange={(e) => set("priceSkz", +e.target.value)} /></div>
          <div><Label>سعر TON</Label><Field type="number" min="0" step="0.01" value={it.priceTon} onChange={(e) => set("priceTon", +e.target.value)} /></div>
          <div><Label>سعر USDT</Label><Field type="number" min="0" value={it.priceUsdt} onChange={(e) => set("priceUsdt", +e.target.value)} /></div>
        </div>
        <div><Label>حد التنبيه للمخزون</Label><Field type="number" min="0" value={it.safeThreshold} onChange={(e) => set("safeThreshold", +e.target.value)} /></div>
        <div>
          <Label>الأكواد (كل كود في سطر) — المخزون: {codesText.split("\n").map((c) => c.trim()).filter(Boolean).length}</Label>
          <Area rows={5} value={codesText} onChange={(e) => setCodesText(e.target.value)} placeholder={"CODE-1\nCODE-2"} />
        </div>
        <div className="flex gap-2 mt-1">
          <Button variant="green" className="flex-1" onClick={save} disabled={!it.title.trim()} data-testid="button-save-inventory">حفظ</Button>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        </div>
      </div>
    </Modal>
  );
}

function Inventory() {
  const { inventory } = useAdmin();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const editing = inventory.find((i) => i.id === editId);

  return (
    <Card title="المخزون الرقمي (أكواد التسليم)" icon={Boxes} action={<Button icon={Plus} onClick={() => setAdding(true)} data-testid="button-add-inventory">منتج</Button>}>
      {inventory.length === 0 ? (
        <EmptyState icon={Boxes} text="لا توجد منتجات رقمية" />
      ) : (
        <Table head={<><Th>المنتج</Th><Th>التصنيف</Th><Th>الأسعار</Th><Th>المخزون</Th><Th>الحالة</Th><Th></Th></>}>
          {inventory.map((i) => {
            const low = i.stock <= i.safeThreshold;
            return (
              <tr key={i.id}>
                <Td className="font-bold text-white">{i.title}</Td>
                <Td>{i.category}</Td>
                <Td className="text-white/60">{fmt(i.priceSkz)} SKZ · {i.priceTon} TON · {i.priceUsdt}$</Td>
                <Td>
                  <span className={low ? "text-red-300 font-bold" : "text-white/80"}>
                    {low && <AlertTriangle size={11} className="inline ml-1" />}{i.stock}
                  </span>
                </Td>
                <Td><Toggle on={i.active} onClick={() => admin.updateInventory(i.id, { active: !i.active })} testId={`toggle-inventory-${i.id}`} /></Td>
                <Td>
                  <div className="flex gap-1.5 justify-end">
                    <button onClick={() => setEditId(i.id)} className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center"><Pencil size={13} className="text-white/60" /></button>
                    <button onClick={() => admin.deleteInventory(i.id)} className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center"><Trash2 size={13} className="text-red-400" /></button>
                  </div>
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
      <InventoryModal open={adding} initial={EMPTY_INV} onClose={() => setAdding(false)}
        onSave={(i) => { admin.addInventory(i); setAdding(false); }} />
      <InventoryModal open={!!editing} initial={editing ?? EMPTY_INV} onClose={() => setEditId(null)}
        onSave={(i) => { if (editId) admin.updateInventory(editId, i); setEditId(null); }} />
    </Card>
  );
}

// ── Shop products (storefront) ────────────────────────────────────────────────
const BADGES = ["", "BESTSELLER", "NEW", "FREE", "HOT", "TOP"] as const;
const SHOP_CATS = CATEGORIES.filter((c) => c !== "All") as Category[];
const EMPTY_PRODUCT: Omit<Product, "id"> = {
  title: "", titleAr: "", category: SHOP_CATS[0], price: 100, pages: 50,
  desc: "", rating: 4.5, downloads: 0, image: "https://picsum.photos/seed/skz/600/450",
};

function ProductModal({ open, initial, onClose, onSave }: {
  open: boolean; initial: Omit<Product, "id">; onClose: () => void; onSave: (p: Omit<Product, "id">) => void;
}) {
  const [p, setP] = useState(initial);
  useEffect(() => { setP(initial); }, [initial, open]);
  const set = <K extends keyof Omit<Product, "id">>(k: K, v: Omit<Product, "id">[K]) => setP((s) => ({ ...s, [k]: v }));
  return (
    <Modal open={open} onClose={onClose} title="منتج المتجر" wide>
      <div className="grid sm:grid-cols-2 gap-2">
        <div><Label>الاسم بالعربية</Label><Field value={p.titleAr} onChange={(e) => set("titleAr", e.target.value)} placeholder="دليل التداول" /></div>
        <div><Label>الاسم بالإنجليزية</Label><Field value={p.title} onChange={(e) => set("title", e.target.value)} placeholder="Trading Guide" /></div>
        <div><Label>التصنيف</Label><Select value={p.category} onChange={(e) => set("category", e.target.value as Category)}>
          {SHOP_CATS.map((c) => <option key={c} value={c} className="bg-[#13101f]">{c}</option>)}
        </Select></div>
        <div><Label>الشارة</Label><Select value={p.badge ?? ""} onChange={(e) => set("badge", (e.target.value || undefined) as Product["badge"])}>
          {BADGES.map((b) => <option key={b} value={b} className="bg-[#13101f]">{b || "بدون"}</option>)}
        </Select></div>
        <div><Label>السعر (SKZ)</Label><Field type="number" value={p.price} onChange={(e) => set("price", +e.target.value)} /></div>
        <div><Label>عدد الصفحات</Label><Field type="number" value={p.pages} onChange={(e) => set("pages", +e.target.value)} /></div>
        <div><Label>التقييم (0-5)</Label><Field type="number" step="0.1" value={p.rating} onChange={(e) => set("rating", +e.target.value)} /></div>
        <div><Label>التحميلات</Label><Field type="number" value={p.downloads} onChange={(e) => set("downloads", +e.target.value)} /></div>
        <div className="sm:col-span-2"><Label>رابط الصورة</Label><Field value={p.image} onChange={(e) => set("image", e.target.value)} /></div>
        <div className="sm:col-span-2"><Label>الوصف</Label><Area rows={2} value={p.desc} onChange={(e) => set("desc", e.target.value)} placeholder="وصف المنتج..." /></div>
        <div className="sm:col-span-2 flex gap-2 mt-1">
          <Button variant="green" className="flex-1" onClick={() => onSave(p)} disabled={!p.titleAr.trim()} data-testid="button-save-product">حفظ المنتج</Button>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        </div>
      </div>
    </Modal>
  );
}

function ShopProducts() {
  const { products } = useAdmin();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const editing = products.find((p) => p.id === editId);

  return (
    <Card title="منتجات المتجر (الواجهة)" icon={Tag} action={<Button icon={Plus} onClick={() => setAdding(true)} data-testid="button-add-product">منتج</Button>}>
      {products.length === 0 ? (
        <EmptyState icon={Package} text="لا توجد منتجات بعد" />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-xl border border-white/10 bg-black/20 p-3 flex items-center gap-3">
              <img src={p.image} alt={p.titleAr} className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-display font-bold text-white truncate">{p.titleAr}</div>
                <div className="text-[10px] text-white/35 font-display">{p.category} · {p.price} SKZ</div>
              </div>
              <button onClick={() => setEditId(p.id)} data-testid={`button-edit-product-${p.id}`} className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center shrink-0"><Pencil size={14} className="text-white/60" /></button>
              <button onClick={() => admin.deleteProduct(p.id)} data-testid={`button-delete-product-${p.id}`} className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0"><Trash2 size={14} className="text-red-400" /></button>
            </div>
          ))}
        </div>
      )}
      <ProductModal open={adding} initial={EMPTY_PRODUCT} onClose={() => setAdding(false)}
        onSave={(p) => { admin.addProduct(p); setAdding(false); }} />
      <ProductModal open={!!editing} initial={editing ?? EMPTY_PRODUCT} onClose={() => setEditId(null)}
        onSave={(p) => { if (editId != null) admin.updateProduct(editId, p); setEditId(null); }} />
    </Card>
  );
}

export default function EconomySection() {
  const { tokenPackages, inventory, products } = useAdmin();
  const lowStock = inventory.filter((i) => i.stock <= i.safeThreshold).length;

  return (
    <div>
      <SectionHeader title="الاقتصاد والمتجر" subtitle="مضاعفات الاقتصاد، حزم التوكن، المخزون الرقمي، ومنتجات المتجر" icon={Store} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="حزم التوكن" value={tokenPackages.length} icon={Coins} tone="gold" />
        <StatCard label="منتجات رقمية" value={inventory.length} icon={Boxes} tone="cyan" />
        <StatCard label="منتجات المتجر" value={products.length} icon={Tag} tone="purple" />
        <StatCard label="مخزون منخفض" value={lowStock} icon={AlertTriangle} tone={lowStock > 0 ? "red" : "green"} />
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <div className="text-sm font-display font-black text-white/70 mb-2">مضاعفات الاقتصاد العامة</div>
          <EconomyControls />
        </div>
        <TokenPackages />
        <Inventory />
        <ShopProducts />
      </div>
    </div>
  );
}
