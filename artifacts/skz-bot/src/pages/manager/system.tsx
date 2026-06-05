import { useEffect, useState } from "react";
import {
  Settings2, Power, Sparkles, RotateCcw, Coins, Plus, Minus, Check, Trash2,
  Pencil, ShieldCheck, KeyRound, DatabaseBackup, UserCog, Wrench,
} from "lucide-react";
import { useAdmin, useBalance, admin } from "../../lib/admin-store";
import { ACCENTS } from "../../lib/games-data";
import type { AdminRole, Permission } from "../../lib/admin-types";
import { ALL_PERMISSIONS } from "../../lib/admin-types";
import {
  Card, SectionHeader, StatCard, Label, Field, Area, Select, Toggle, Button,
  Pill, EmptyState, Modal, timeAgo,
} from "./_ui";

const PERM_LABEL: Record<Permission, string> = {
  users: "المستخدمون", games: "الألعاب", economy: "الاقتصاد", finance: "المالية",
  security: "الأمان", gamification: "التحفيز", content: "المحتوى", affiliate: "الإحالة", system: "النظام",
};
const ROLE_LABEL: Record<AdminRole["role"], string> = {
  owner: "المالك", moderator: "مشرف", support: "دعم", accountant: "محاسب",
};

// ── Live mini-app balance ─────────────────────────────────────────────────────
function LiveBalance() {
  const balance = useBalance();
  const [amount, setAmount] = useState("100");
  const amt = parseInt(amount) || 0;
  return (
    <Card title="رصيد المستخدم الحالي (المعاينة الحية)" icon={Coins}>
      <div className="flex items-center gap-2 mb-3">
        <Coins size={22} className="text-primary" />
        <span className="text-3xl font-display font-black text-primary">{balance}</span>
        <span className="text-sm text-white/40 font-display">SKZ</span>
      </div>
      <Label>المبلغ</Label>
      <Field type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div className="flex gap-1.5 my-2">
        {[100, 500, 1000, 5000].map((v) => (
          <button key={v} onClick={() => setAmount(String(v))} className="flex-1 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-[11px] font-display">{v}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="green" icon={Plus} className="flex-1" onClick={() => admin.addBalance(amt)} data-testid="button-add-balance">إضافة</Button>
        <Button variant="red" icon={Minus} className="flex-1" onClick={() => admin.deductBalance(amt)} data-testid="button-deduct-balance">خصم</Button>
        <Button variant="ghost" icon={Check} className="flex-1" onClick={() => admin.setBalance(amt)} data-testid="button-set-balance">تعيين</Button>
      </div>
    </Card>
  );
}

// ── App identity + section toggles ────────────────────────────────────────────
function AppSettings() {
  const { settings } = useAdmin();
  const rows: { key: keyof typeof settings; label: string; desc: string }[] = [
    { key: "shopEnabled", label: "المتجر", desc: "إظهار قسم السوق" },
    { key: "arenaEnabled", label: "ساحة الجوائز", desc: "إظهار ألعاب الجوائز" },
    { key: "skillEnabled", label: "ألعاب المهارة", desc: "إظهار ألعاب المهارة" },
    { key: "maintenance", label: "وضع الصيانة", desc: "إيقاف التطبيق مؤقتاً للمستخدمين" },
  ];
  const accentKeys = Object.keys(ACCENTS) as (keyof typeof ACCENTS)[];
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card title="هوية التطبيق" icon={Sparkles}>
        <Label>اسم التطبيق</Label>
        <Field value={settings.appName} data-testid="input-app-name" onChange={(e) => admin.setSettings({ appName: e.target.value })} placeholder="SKZ" />
        <div className="mt-2"><Label>رسالة الترحيب</Label>
          <Area rows={2} value={settings.welcomeMessage} data-testid="input-welcome" onChange={(e) => admin.setSettings({ welcomeMessage: e.target.value })} placeholder="أهلاً بك في..." />
        </div>
        <div className="mt-2"><Label>اللون المميّز</Label>
          <div className="flex gap-2 flex-wrap mt-1">
            {accentKeys.map((k) => {
              const c = ACCENTS[k].dot;
              const active = settings.accent === c;
              return <button key={k} onClick={() => admin.setSettings({ accent: c })} data-testid={`accent-${k}`}
                className={`w-8 h-8 rounded-full border-2 transition-transform ${active ? "scale-110 border-white" : "border-white/20"}`} style={{ background: c }} />;
            })}
          </div>
        </div>
        <div className="mt-2"><Label>عدّاد المتصلين (يظهر في الساحة)</Label>
          <Field value={settings.onlineCount} onChange={(e) => admin.setSettings({ onlineCount: e.target.value })} placeholder="12.4k" />
        </div>
      </Card>

      <Card title="أقسام التطبيق" icon={Power}>
        <div className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <div key={r.key} className={`flex items-center gap-3 rounded-xl p-2.5 border ${r.key === "maintenance" && settings.maintenance ? "border-amber-500/40 bg-amber-500/8" : "border-white/8 bg-black/20"}`}>
              {r.key === "maintenance" ? <Wrench size={16} className="text-amber-300/80" /> : <Power size={16} className="text-white/40" />}
              <div className="flex-1">
                <div className="text-sm font-display font-bold text-white">{r.label}</div>
                <div className="text-[11px] text-white/40 font-display">{r.desc}</div>
              </div>
              <Toggle on={!!settings[r.key]} onClick={() => admin.setSettings({ [r.key]: !settings[r.key] })} testId={`toggle-${r.key}`} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Admin roles ───────────────────────────────────────────────────────────────
const EMPTY_ROLE: Omit<AdminRole, "id"> = { name: "", handle: "", role: "support", permissions: [], active: true };

function RoleModal({ open, initial, onClose, onSave }: {
  open: boolean; initial: Omit<AdminRole, "id">; onClose: () => void; onSave: (r: Omit<AdminRole, "id">) => void;
}) {
  const [r, setR] = useState(initial);
  useEffect(() => { if (open) setR(initial); }, [open, initial]);
  const set = <K extends keyof Omit<AdminRole, "id">>(k: K, v: Omit<AdminRole, "id">[K]) => setR((s) => ({ ...s, [k]: v }));
  function togglePerm(p: Permission) {
    setR((s) => ({ ...s, permissions: s.permissions.includes(p) ? s.permissions.filter((x) => x !== p) : [...s.permissions, p] }));
  }
  return (
    <Modal open={open} onClose={onClose} title="عضو إداري">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div><Label>الاسم</Label><Field value={r.name} onChange={(e) => set("name", e.target.value)} placeholder="أحمد" /></div>
          <div><Label>المعرّف</Label><Field value={r.handle} onChange={(e) => set("handle", e.target.value)} placeholder="@admin" /></div>
        </div>
        <div><Label>الدور</Label><Select value={r.role} onChange={(e) => set("role", e.target.value as AdminRole["role"])}>
          {(Object.keys(ROLE_LABEL) as AdminRole["role"][]).map((k) => <option key={k} value={k} className="bg-[#13101f]">{ROLE_LABEL[k]}</option>)}
        </Select></div>
        <div>
          <Label>الصلاحيات</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {ALL_PERMISSIONS.map((p) => (
              <label key={p} className="flex items-center gap-2 text-xs font-display text-white/70 rounded-lg bg-black/20 border border-white/10 px-2.5 py-1.5">
                <input type="checkbox" checked={r.permissions.includes(p)} onChange={() => togglePerm(p)} /> {PERM_LABEL[p]}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2 mt-1">
          <Button variant="green" className="flex-1" onClick={() => onSave(r)} disabled={!r.name.trim()} data-testid="button-save-role">حفظ</Button>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        </div>
      </div>
    </Modal>
  );
}

function Roles() {
  const { roles } = useAdmin();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const editing = roles.find((r) => r.id === editId);
  return (
    <Card title="الفريق الإداري والصلاحيات" icon={ShieldCheck} action={<Button icon={Plus} onClick={() => setAdding(true)} data-testid="button-add-role">عضو</Button>}>
      {roles.length === 0 ? <EmptyState icon={UserCog} text="لا يوجد أعضاء" /> : (
        <div className="grid sm:grid-cols-2 gap-3">
          {roles.map((r) => (
            <div key={r.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-yellow-600 to-amber-400 flex items-center justify-center shrink-0"><UserCog size={16} className="text-black" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-display font-bold text-white truncate">{r.name}</div>
                  <div className="text-[10px] text-white/40 font-display">{r.handle}</div>
                </div>
                <Pill tone={r.role === "owner" ? "gold" : "purple"}>{ROLE_LABEL[r.role]}</Pill>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {r.role === "owner" ? <span className="text-[10px] font-display text-white/40">كل الصلاحيات</span>
                  : r.permissions.length === 0 ? <span className="text-[10px] font-display text-white/30">بدون صلاحيات</span>
                  : r.permissions.map((p) => <span key={p} className="text-[9px] font-display text-white/55 bg-white/8 px-1.5 py-0.5 rounded-full">{PERM_LABEL[p]}</span>)}
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <Toggle on={r.active} onClick={() => admin.updateRole(r.id, { active: !r.active })} testId={`toggle-role-${r.id}`} />
                <span className="flex-1 text-[10px] font-display text-white/40">{r.active ? "نشط" : "معطّل"}</span>
                {r.role !== "owner" && <>
                  <button onClick={() => setEditId(r.id)} className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center"><Pencil size={13} className="text-white/60" /></button>
                  <button onClick={() => admin.deleteRole(r.id)} className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center"><Trash2 size={13} className="text-red-400" /></button>
                </>}
              </div>
            </div>
          ))}
        </div>
      )}
      <RoleModal open={adding} initial={EMPTY_ROLE} onClose={() => setAdding(false)} onSave={(r) => { admin.addRole(r); setAdding(false); }} />
      <RoleModal open={!!editing} initial={editing ?? EMPTY_ROLE} onClose={() => setEditId(null)} onSave={(r) => { if (editId) admin.updateRole(editId, r); setEditId(null); }} />
    </Card>
  );
}

// ── API keys ──────────────────────────────────────────────────────────────────
function ApiKeys() {
  const { apiKeys } = useAdmin();
  const [editId, setEditId] = useState<string | null>(null);
  const [val, setVal] = useState("");
  return (
    <Card title="مفاتيح API والتكاملات" icon={KeyRound}>
      <div className="flex flex-col gap-2">
        {apiKeys.map((k) => (
          <div key={k.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center gap-2">
              <KeyRound size={14} className="text-white/40" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-display font-bold text-white">{k.label}</div>
                {editId === k.id ? (
                  <Field value={val} onChange={(e) => setVal(e.target.value)} className="mt-1.5" autoFocus />
                ) : (
                  <div className="text-[11px] text-white/40 font-display font-mono truncate mt-0.5">{k.value}</div>
                )}
              </div>
              {editId === k.id ? (
                <>
                  <Button variant="green" icon={Check} onClick={() => { admin.updateApiKey(k.id, val); setEditId(null); }}>حفظ</Button>
                  <Button variant="ghost" onClick={() => setEditId(null)}>إلغاء</Button>
                </>
              ) : (
                <button onClick={() => { setEditId(k.id); setVal(k.value); }} className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center"><Pencil size={14} className="text-white/60" /></button>
              )}
            </div>
            <div className="text-[10px] text-white/25 font-display mt-1">آخر تحديث {timeAgo(k.updatedAt)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Backup ────────────────────────────────────────────────────────────────────
function Backup() {
  const { backup } = useAdmin();
  return (
    <Card title="النسخ الاحتياطي" icon={DatabaseBackup} action={<Button variant="primary" icon={DatabaseBackup} onClick={() => admin.runBackupNow()} data-testid="button-backup-now">نسخ الآن</Button>}>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1">
          <div className="text-sm font-display font-bold text-white">النسخ التلقائي</div>
          <div className="text-[11px] text-white/40 font-display">آخر نسخة: {timeAgo(backup.lastBackupAt)}</div>
        </div>
        <Toggle on={backup.autoBackup} onClick={() => admin.setBackup({ autoBackup: !backup.autoBackup })} testId="toggle-autobackup" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>كل (ساعة)</Label><Field type="number" min="1" value={backup.intervalHours} onChange={(e) => admin.setBackup({ intervalHours: Math.max(1, parseInt(e.target.value) || 1) })} /></div>
        <div><Label>الوجهة</Label><Select value={backup.destination} onChange={(e) => admin.setBackup({ destination: e.target.value as typeof backup.destination })}>
          <option value="telegram" className="bg-[#13101f]">تيليجرام</option>
          <option value="cloud" className="bg-[#13101f]">التخزين السحابي</option>
          <option value="local" className="bg-[#13101f]">محلي</option>
        </Select></div>
      </div>
    </Card>
  );
}

// ── Danger zone ───────────────────────────────────────────────────────────────
function DangerZone() {
  const [confirm, setConfirm] = useState(false);
  return (
    <Card className="border-red-500/30" title="منطقة الخطر" icon={RotateCcw}>
      <div className="text-[11px] text-white/40 font-display mb-3">يُعيد ضبط كل الإعدادات والمنتجات والرصيد والبيانات إلى الوضع الافتراضي.</div>
      {confirm ? (
        <div className="flex gap-2">
          <Button variant="red" className="flex-1" onClick={() => { admin.resetAll(); setConfirm(false); }} data-testid="button-confirm-reset">تأكيد إعادة الضبط</Button>
          <Button variant="ghost" onClick={() => setConfirm(false)}>إلغاء</Button>
        </div>
      ) : (
        <Button variant="red" icon={RotateCcw} className="w-full" onClick={() => setConfirm(true)} data-testid="button-reset-all">إعادة ضبط الكل</Button>
      )}
    </Card>
  );
}

export default function SystemSection() {
  const { roles, apiKeys } = useAdmin();
  const activeAdmins = roles.filter((r) => r.active).length;
  return (
    <div>
      <SectionHeader title="النظام والإدارة" subtitle="الإعدادات، الفريق الإداري، المفاتيح، النسخ الاحتياطي، والمعاينة الحية" icon={Settings2} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="أعضاء الفريق" value={roles.length} icon={UserCog} tone="purple" />
        <StatCard label="أعضاء نشطون" value={activeAdmins} icon={ShieldCheck} tone="green" />
        <StatCard label="مفاتيح API" value={apiKeys.length} icon={KeyRound} tone="cyan" />
        <StatCard label="إصدار اللوحة" value="2.0" icon={Settings2} tone="gold" />
      </div>

      <div className="flex flex-col gap-5">
        <AppSettings />
        <div className="grid lg:grid-cols-2 gap-4">
          <LiveBalance />
          <Backup />
        </div>
        <Roles />
        <ApiKeys />
        <DangerZone />
      </div>
    </div>
  );
}
