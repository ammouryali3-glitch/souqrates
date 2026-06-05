import { useState } from "react";
import {
  Megaphone, Bell, Plus, Trash2, FileText, MessageSquare, Send, Save,
  Users as UsersIcon, ScrollText, type LucideIcon,
} from "lucide-react";
import { useAdmin, admin, type AppNotification, type NotifType } from "../../lib/admin-store";
import type { Broadcast, SupportTicket, CmsTexts } from "../../lib/admin-types";
import {
  Card, SectionHeader, StatCard, Label, Field, Area, Select, Toggle, Button,
  Pill, EmptyState, Modal, dateStr, timeAgo, compact, fmt,
} from "./_ui";

function toLocalInput(ms: number) {
  const d = new Date(ms - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}
function fromLocalInput(s: string) {
  return s ? new Date(s).getTime() : Date.now();
}

// ── Broadcasts ────────────────────────────────────────────────────────────────
const AUDIENCE: { id: Broadcast["audience"]; label: string }[] = [
  { id: "all", label: "الجميع" },
  { id: "active", label: "النشطون" },
  { id: "non-depositors", label: "غير المودعين" },
  { id: "vip", label: "VIP" },
];
const AUD_LABEL = Object.fromEntries(AUDIENCE.map((a) => [a.id, a.label]));

function BroadcastModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [b, setB] = useState<Omit<Broadcast, "id">>({
    title: "", body: "", audience: "all", scheduledAt: Date.now() + 60 * 60 * 1000,
    status: "draft", reach: 0,
  });
  const [when, setWhen] = useState(toLocalInput(Date.now() + 60 * 60 * 1000));
  const set = <K extends keyof Omit<Broadcast, "id">>(k: K, v: Omit<Broadcast, "id">[K]) => setB((s) => ({ ...s, [k]: v }));
  function save(status: Broadcast["status"]) {
    admin.addBroadcast({ ...b, status, scheduledAt: fromLocalInput(when) });
    onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title="رسالة بث جديدة" wide>
      <div className="flex flex-col gap-3">
        <div><Label>العنوان</Label><Field value={b.title} onChange={(e) => set("title", e.target.value)} placeholder="عرض خاص!" /></div>
        <div><Label>النص</Label><Area rows={3} value={b.body} onChange={(e) => set("body", e.target.value)} placeholder="نص الرسالة..." /></div>
        <div className="grid sm:grid-cols-2 gap-2">
          <div><Label>الجمهور</Label><Select value={b.audience} onChange={(e) => set("audience", e.target.value as Broadcast["audience"])}>
            {AUDIENCE.map((a) => <option key={a.id} value={a.id} className="bg-[#13101f]">{a.label}</option>)}
          </Select></div>
          <div><Label>وقت الإرسال</Label><Field type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <div><Label>نص الزر (اختياري)</Label><Field value={b.buttonText ?? ""} onChange={(e) => set("buttonText", e.target.value || undefined)} placeholder="افتح التطبيق" /></div>
          <div><Label>رابط الزر (اختياري)</Label><Field value={b.buttonUrl ?? ""} onChange={(e) => set("buttonUrl", e.target.value || undefined)} placeholder="/wallet" /></div>
        </div>
        <div className="flex gap-2 mt-1">
          <Button variant="green" icon={Send} className="flex-1" onClick={() => save("scheduled")} disabled={!b.title.trim() || !b.body.trim()} data-testid="button-schedule-broadcast">جدولة</Button>
          <Button variant="ghost" onClick={() => save("draft")} disabled={!b.title.trim()}>حفظ كمسودة</Button>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        </div>
      </div>
    </Modal>
  );
}

function Broadcasts() {
  const { broadcasts } = useAdmin();
  const [adding, setAdding] = useState(false);
  const toneFor = (s: Broadcast["status"]): "green" | "cyan" | "gray" => (s === "sent" ? "green" : s === "scheduled" ? "cyan" : "gray");
  const labelFor = (s: Broadcast["status"]) => (s === "sent" ? "مُرسلة" : s === "scheduled" ? "مجدولة" : "مسودة");
  return (
    <Card title="البث الجماعي" icon={Send} action={<Button icon={Plus} onClick={() => setAdding(true)} data-testid="button-add-broadcast">رسالة بث</Button>}>
      {broadcasts.length === 0 ? (
        <EmptyState icon={Send} text="لا توجد رسائل بث" />
      ) : (
        <div className="flex flex-col gap-2">
          {broadcasts.map((b) => (
            <div key={b.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-display font-bold text-white">{b.title}</span>
                    <Pill tone={toneFor(b.status)}>{labelFor(b.status)}</Pill>
                    <Pill tone="purple">{AUD_LABEL[b.audience]}</Pill>
                  </div>
                  <div className="text-xs text-white/55 font-display mt-1">{b.body}</div>
                  <div className="text-[10px] text-white/30 font-display mt-1">
                    {b.status === "sent" ? `وصلت إلى ${compact(b.reach)} · ${timeAgo(b.scheduledAt)}` : `الجمهور المتوقع ${compact(b.reach)} · ${dateStr(b.scheduledAt)}`}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {b.status === "scheduled" && (
                    <Button variant="green" onClick={() => admin.updateBroadcast(b.id, { status: "sent" })} data-testid={`button-send-broadcast-${b.id}`}>إرسال الآن</Button>
                  )}
                  <button onClick={() => admin.deleteBroadcast(b.id)} className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center"><Trash2 size={14} className="text-red-400" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <BroadcastModal open={adding} onClose={() => setAdding(false)} />
    </Card>
  );
}

// ── In-app notifications (timed banner) ───────────────────────────────────────
const NOTIF_TYPES: { id: NotifType; label: string }[] = [
  { id: "info", label: "معلومة" }, { id: "success", label: "نجاح" },
  { id: "warning", label: "تحذير" }, { id: "promo", label: "عرض" },
];

function Notifications() {
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
    <Card title="شريط الإشعارات داخل التطبيق" icon={Bell}>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <div><Label>العنوان</Label><Field value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عرض خاص!" /></div>
          <div><Label>الرسالة</Label><Area rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="نص الإشعار..." /></div>
          <div>
            <Label>النوع</Label>
            <div className="flex gap-1.5">
              {NOTIF_TYPES.map((t) => (
                <button key={t.id} onClick={() => setType(t.id)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-display font-bold border transition-colors ${type === t.id ? "bg-accent/25 border-accent/50 text-fuchsia-200" : "bg-white/5 border-white/10 text-white/40"}`}>
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
              <button key={h} onClick={() => quick(h)} className="flex-1 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-[11px] font-display">
                {h < 24 ? `${h} ساعة` : h === 24 ? "يوم" : "أسبوع"}
              </button>
            ))}
          </div>
          <Button variant="accent" icon={Plus} className="mt-1" onClick={add} disabled={!title.trim() || !message.trim()} data-testid="button-add-notification">نشر الإشعار</Button>
        </div>

        <div className="flex flex-col gap-2">
          {notifications.length === 0 ? (
            <EmptyState icon={Bell} text="لا توجد إشعارات" />
          ) : notifications.map((n) => {
            const st = statusOf(n);
            return (
              <div key={n.id} className="rounded-xl border border-white/10 bg-black/20 p-3 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-display font-bold text-white truncate">{n.title}</span>
                    <span className={`text-[10px] font-display font-bold ${st.c}`}>● {st.t}</span>
                  </div>
                  <div className="text-xs text-white/55 font-display mt-0.5">{n.message}</div>
                  <div className="text-[10px] text-white/30 font-display mt-1">{dateStr(n.startAt)} ← {dateStr(n.endAt)}</div>
                </div>
                <button onClick={() => admin.deleteNotification(n.id)} data-testid={`button-delete-notification-${n.id}`} className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0"><Trash2 size={14} className="text-red-400" /></button>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// ── Support tickets ───────────────────────────────────────────────────────────
function Tickets() {
  const { tickets } = useAdmin();
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const active = tickets.find((t) => t.id === openId);
  const tone = (s: SupportTicket["status"]): "yellow" | "blue" | "gray" => (s === "open" ? "yellow" : s === "answered" ? "blue" : "gray");
  const label = (s: SupportTicket["status"]) => (s === "open" ? "مفتوحة" : s === "answered" ? "تم الرد" : "مغلقة");

  function send() {
    if (!active || !reply.trim()) return;
    admin.replyTicket(active.id, reply.trim());
    setReply("");
  }
  return (
    <Card title="تذاكر الدعم" icon={MessageSquare}>
      {tickets.length === 0 ? (
        <EmptyState icon={MessageSquare} text="لا توجد تذاكر" />
      ) : (
        <div className="flex flex-col gap-2">
          {tickets.map((t) => (
            <button key={t.id} onClick={() => { setOpenId(t.id); setReply(""); }} className="text-right rounded-xl border border-white/10 bg-black/20 p-3 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-sm font-display font-bold text-white flex-1 truncate">{t.subject}</span>
                <Pill tone={tone(t.status)}>{label(t.status)}</Pill>
              </div>
              <div className="text-[11px] text-white/40 font-display mt-1">{t.userName} · {timeAgo(t.updatedAt)} · {t.messages.length} رسالة</div>
            </button>
          ))}
        </div>
      )}
      <Modal open={!!active} onClose={() => setOpenId(null)} title={active?.subject ?? ""} wide>
        {active && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Pill tone={tone(active.status)}>{label(active.status)}</Pill>
              <span className="text-xs font-display text-white/50">{active.userName}</span>
            </div>
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {active.messages.map((m, i) => (
                <div key={i} className={`rounded-xl p-2.5 text-sm font-display ${m.from === "admin" ? "bg-primary/15 border border-primary/25 text-white ml-8" : "bg-white/5 border border-white/10 text-white/80 mr-8"}`}>
                  <div className="text-[10px] text-white/40 mb-1">{m.from === "admin" ? "الإدارة" : active.userName} · {timeAgo(m.at)}</div>
                  {m.text}
                </div>
              ))}
            </div>
            <Area rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="اكتب رداً..." />
            <div className="flex gap-2">
              <Button variant="green" icon={Send} className="flex-1" onClick={send} disabled={!reply.trim()} data-testid="button-reply-ticket">إرسال الرد</Button>
              {active.status !== "closed"
                ? <Button variant="ghost" onClick={() => { admin.setTicketStatus(active.id, "closed"); setOpenId(null); }}>إغلاق التذكرة</Button>
                : <Button variant="ghost" onClick={() => admin.setTicketStatus(active.id, "open")}>إعادة فتح</Button>}
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}

// ── CMS texts + TOS ───────────────────────────────────────────────────────────
const CMS_FIELDS: { key: keyof CmsTexts; label: string; rows: number }[] = [
  { key: "welcome", label: "رسالة الترحيب", rows: 2 },
  { key: "gameHelp", label: "شرح الألعاب", rows: 2 },
  { key: "shopTerms", label: "شروط المتجر", rows: 2 },
  { key: "winMessage", label: "رسالة الفوز", rows: 1 },
  { key: "lossMessage", label: "رسالة الخسارة", rows: 1 },
  { key: "tos", label: "الشروط والأحكام", rows: 4 },
];

function CmsEditor() {
  const { cms, settings } = useAdmin();
  return (
    <Card title="نصوص التطبيق (CMS)" icon={FileText} action={
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-display text-white/50">بوابة الموافقة على الشروط</span>
        <Toggle on={settings.tosEnabled} onClick={() => admin.setSettings({ tosEnabled: !settings.tosEnabled })} testId="toggle-tos" />
      </div>
    }>
      <div className="grid lg:grid-cols-2 gap-3">
        {CMS_FIELDS.map((f) => (
          <div key={f.key} className={f.rows >= 4 ? "lg:col-span-2" : ""}>
            <Label>{f.label}</Label>
            <Area rows={f.rows} value={cms[f.key]} data-testid={`cms-${f.key}`}
              onChange={(e) => admin.setCms({ [f.key]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-[11px] font-display text-green-300/70">
        <Save size={13} /> التغييرات تُحفظ تلقائياً وتُطبّق على التطبيق فوراً.
      </div>
    </Card>
  );
}

export default function ContentSection() {
  const { broadcasts, tickets, notifications } = useAdmin();
  const now = Date.now();
  const activeNotif = notifications.filter((n) => now >= n.startAt && now <= n.endAt).length;
  const openTickets = tickets.filter((t) => t.status === "open").length;
  const scheduled = broadcasts.filter((b) => b.status === "scheduled").length;

  return (
    <div>
      <SectionHeader title="المحتوى والبث" subtitle="البث الجماعي، الإشعارات، نصوص التطبيق، وتذاكر الدعم" icon={Megaphone} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="بث مجدول" value={scheduled} icon={Send} tone="cyan" />
        <StatCard label="إشعارات نشطة" value={activeNotif} icon={Bell} tone="purple" />
        <StatCard label="تذاكر مفتوحة" value={openTickets} icon={MessageSquare} tone={openTickets > 0 ? "gold" : "green"} />
        <StatCard label="إجمالي الجمهور" value={compact(24310)} icon={UsersIcon} tone="blue" hint="مشترك" />
      </div>

      <div className="flex flex-col gap-5">
        <Broadcasts />
        <Notifications />
        <Tickets />
        <CmsEditor />
      </div>
    </div>
  );
}
