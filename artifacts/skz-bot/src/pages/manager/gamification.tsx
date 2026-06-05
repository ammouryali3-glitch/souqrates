import React, { useState } from "react";
import {
  Trophy, CalendarCheck, Gift, Share2, Ticket, Plus, Trash2,
  Send, Twitter, Globe, Pencil,
} from "lucide-react";
import {
  Card, SectionHeader, StatCard, Label, Field, Select, Toggle, Button,
  Pill, Table, Th, Td, EmptyState, Modal, BarChart, fmt, fmtCur, compact, dateStr,
} from "./_ui";
import { useAdmin, admin } from "../../lib/admin-store";
import type { SocialTask, PromoCode, Currency } from "../../lib/admin-types";
import { CURRENCIES } from "../../lib/admin-types";

const DAY_LABELS = ["يوم ١", "يوم ٢", "يوم ٣", "يوم ٤", "يوم ٥", "يوم ٦", "يوم ٧"];

const PLATFORM_LABEL: Record<SocialTask["platform"], string> = {
  telegram: "تيليجرام",
  twitter: "X (تويتر)",
  other: "أخرى",
};
const PLATFORM_TONE: Record<SocialTask["platform"], "blue" | "cyan" | "gray"> = {
  telegram: "blue",
  twitter: "cyan",
  other: "gray",
};
const PLATFORM_ICON: Record<SocialTask["platform"], typeof Send> = {
  telegram: Send,
  twitter: Twitter,
  other: Globe,
};

type TaskDraft = {
  title: string;
  platform: SocialTask["platform"];
  url: string;
  reward: number;
  active: boolean;
};

const EMPTY_TASK: TaskDraft = { title: "", platform: "telegram", url: "", reward: 100, active: true };

type PromoDraft = {
  code: string;
  reward: number;
  currency: Currency;
  totalUses: number;
  perUser: number;
  expiryDays: number;
  active: boolean;
};

const EMPTY_PROMO: PromoDraft = { code: "", reward: 500, currency: "SKZ", totalUses: 100, perUser: 1, expiryDays: 30, active: true };

export default function GamificationSection() {
  const { dailyCheckin, socialTasks, promoCodes, settings } = useAdmin();

  // ── Social task modal ──
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskEditId, setTaskEditId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(EMPTY_TASK);

  function openAddTask() {
    setTaskEditId(null);
    setTaskDraft(EMPTY_TASK);
    setTaskOpen(true);
  }
  function openEditTask(t: SocialTask) {
    setTaskEditId(t.id);
    setTaskDraft({ title: t.title, platform: t.platform, url: t.url, reward: t.reward, active: t.active });
    setTaskOpen(true);
  }
  function saveTask() {
    if (!taskDraft.title.trim()) return;
    if (taskEditId) {
      admin.updateSocialTask(taskEditId, { ...taskDraft });
    } else {
      admin.addSocialTask({ ...taskDraft, completions: 0 });
    }
    setTaskOpen(false);
  }

  // ── Promo modal ──
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoDraft, setPromoDraft] = useState<PromoDraft>(EMPTY_PROMO);

  function openAddPromo() {
    setPromoDraft(EMPTY_PROMO);
    setPromoOpen(true);
  }
  function savePromo() {
    if (!promoDraft.code.trim()) return;
    admin.addPromoCode({
      code: promoDraft.code.trim().toUpperCase(),
      reward: promoDraft.reward,
      currency: promoDraft.currency,
      totalUses: promoDraft.totalUses,
      perUser: promoDraft.perUser,
      expiry: Date.now() + promoDraft.expiryDays * 86400000,
      active: promoDraft.active,
    });
    setPromoOpen(false);
  }

  const checkinTotal = dailyCheckin.reduce((a, b) => a + b, 0);
  const activeTasks = socialTasks.filter((t) => t.active).length;
  const activePromos = promoCodes.filter((p) => p.active).length;
  const chartData = dailyCheckin.map((v, i) => ({ label: DAY_LABELS[i] ?? `${i + 1}`, value: v }));

  return (
    <div>
      <SectionHeader
        title="التحفيز والمكافآت"
        subtitle="مكافآت الدخول اليومي، المهام الاجتماعية، وأكواد الترويج"
        icon={Trophy}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="إجمالي مكافأة الأسبوع" value={fmt(checkinTotal)} icon={CalendarCheck} tone="gold" hint="SKZ على ٧ أيام" />
        <StatCard label="المكافأة اليومية" value={settings.dailyBonus > 0 ? fmt(settings.dailyBonus) : "معطلة"} icon={Gift} tone={settings.dailyBonus > 0 ? "green" : "gray"} hint="SKZ يومياً" />
        <StatCard label="مهام نشطة" value={`${activeTasks}/${socialTasks.length}`} icon={Share2} tone="purple" />
        <StatCard label="أكواد نشطة" value={`${activePromos}/${promoCodes.length}`} icon={Ticket} tone="cyan" />
      </div>

      {/* Daily check-in + daily bonus */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card title="مكافأة الدخول اليومي" icon={CalendarCheck} className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-5">
            {dailyCheckin.map((v, i) => (
              <div key={i}>
                <Label>{DAY_LABELS[i] ?? `يوم ${i + 1}`}</Label>
                <Field
                  type="number"
                  min={0}
                  value={v}
                  data-testid={`input-checkin-${i}`}
                  onChange={(e) => admin.setCheckinDay(i, Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
            ))}
          </div>
          <BarChart data={chartData} />
        </Card>

        <Card title="المكافأة اليومية" icon={Gift}>
          <p className="text-xs font-display text-white/40 mb-3 leading-relaxed">
            مبلغ SKZ يُمنح للاعب مرة واحدة كل يوم من الصفحة الرئيسية. ضع ٠ لتعطيلها.
          </p>
          <Label>قيمة المكافأة اليومية (SKZ)</Label>
          <Field
            type="number"
            min={0}
            value={settings.dailyBonus}
            data-testid="input-daily-bonus"
            onChange={(e) => admin.setSettings({ dailyBonus: Math.max(0, Number(e.target.value) || 0) })}
          />
          <div className="mt-3">
            {settings.dailyBonus > 0 ? (
              <Pill tone="green">مفعّلة — {fmt(settings.dailyBonus)} SKZ</Pill>
            ) : (
              <Pill tone="gray">معطّلة</Pill>
            )}
          </div>
        </Card>
      </div>

      {/* Social tasks */}
      <Card
        title="المهام الاجتماعية"
        icon={Share2}
        className="mb-6"
        action={<Button variant="primary" icon={Plus} onClick={openAddTask} data-testid="button-add-task">إضافة مهمة</Button>}
      >
        {socialTasks.length === 0 ? (
          <EmptyState icon={Share2} text="لا توجد مهام اجتماعية بعد" />
        ) : (
          <Table head={<>
            <Th>المهمة</Th>
            <Th>المنصة</Th>
            <Th>المكافأة</Th>
            <Th>الإكمالات</Th>
            <Th>نشطة</Th>
            <Th className="text-left">إجراءات</Th>
          </>}>
            {socialTasks.map((t) => {
              const PIcon = PLATFORM_ICON[t.platform];
              return (
                <tr key={t.id}>
                  <Td>
                    <div className="font-bold text-white">{t.title}</div>
                    <a href={t.url} target="_blank" rel="noreferrer" className="text-[10px] text-white/35 hover:text-primary truncate block max-w-[200px]">{t.url}</a>
                  </Td>
                  <Td><Pill tone={PLATFORM_TONE[t.platform]}><PIcon size={11} /> {PLATFORM_LABEL[t.platform]}</Pill></Td>
                  <Td className="text-primary font-bold">{fmtCur(t.reward, "SKZ")}</Td>
                  <Td>{compact(t.completions)}</Td>
                  <Td>
                    <Toggle on={t.active} testId={`toggle-task-${t.id}`} onClick={() => admin.updateSocialTask(t.id, { active: !t.active })} />
                  </Td>
                  <Td className="text-left">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Button variant="ghost" icon={Pencil} onClick={() => openEditTask(t)} data-testid={`button-edit-task-${t.id}`}>تعديل</Button>
                      <Button variant="red" icon={Trash2} onClick={() => admin.deleteSocialTask(t.id)} data-testid={`button-delete-task-${t.id}`}>حذف</Button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {/* Promo codes */}
      <Card
        title="أكواد الترويج"
        icon={Ticket}
        action={<Button variant="primary" icon={Plus} onClick={openAddPromo} data-testid="button-add-promo">إضافة كود</Button>}
      >
        {promoCodes.length === 0 ? (
          <EmptyState icon={Ticket} text="لا توجد أكواد ترويجية بعد" />
        ) : (
          <Table head={<>
            <Th>الكود</Th>
            <Th>المكافأة</Th>
            <Th>الاستخدام</Th>
            <Th>لكل مستخدم</Th>
            <Th>الانتهاء</Th>
            <Th>الحالة</Th>
            <Th className="text-left">إجراءات</Th>
          </>}>
            {promoCodes.map((p) => {
              const expired = p.expiry < Date.now();
              const pct = p.totalUses > 0 ? Math.min(100, Math.round((p.usedCount / p.totalUses) * 100)) : 0;
              return (
                <tr key={p.id}>
                  <Td><span className="font-mono font-bold text-white tracking-wider">{p.code}</span></Td>
                  <Td className="text-primary font-bold">{fmtCur(p.reward, p.currency)}</Td>
                  <Td>
                    <div className="text-[11px] text-white/60 mb-1">{fmt(p.usedCount)} / {fmt(p.totalUses)}</div>
                    <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </Td>
                  <Td>{fmt(p.perUser)}</Td>
                  <Td className={expired ? "text-red-300" : ""}>{dateStr(p.expiry)}</Td>
                  <Td>
                    {expired ? <Pill tone="gray">منتهٍ</Pill> : p.active ? <Pill tone="green">نشط</Pill> : <Pill tone="red">معطّل</Pill>}
                  </Td>
                  <Td className="text-left">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Toggle on={p.active} testId={`toggle-promo-${p.id}`} onClick={() => admin.updatePromoCode(p.id, { active: !p.active })} />
                      <Button variant="red" icon={Trash2} onClick={() => admin.deletePromoCode(p.id)} data-testid={`button-delete-promo-${p.id}`}>حذف</Button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {/* Social task modal */}
      <Modal open={taskOpen} onClose={() => setTaskOpen(false)} title={taskEditId ? "تعديل مهمة اجتماعية" : "إضافة مهمة اجتماعية"}>
        <div className="space-y-3">
          <div>
            <Label>عنوان المهمة</Label>
            <Field value={taskDraft.title} data-testid="input-task-title" onChange={(e) => setTaskDraft({ ...taskDraft, title: e.target.value })} placeholder="انضم لقناة تيليجرام" />
          </div>
          <div>
            <Label>المنصة</Label>
            <Select value={taskDraft.platform} data-testid="select-task-platform" onChange={(e) => setTaskDraft({ ...taskDraft, platform: e.target.value as SocialTask["platform"] })}>
              <option value="telegram">تيليجرام</option>
              <option value="twitter">X (تويتر)</option>
              <option value="other">أخرى</option>
            </Select>
          </div>
          <div>
            <Label>الرابط</Label>
            <Field value={taskDraft.url} data-testid="input-task-url" onChange={(e) => setTaskDraft({ ...taskDraft, url: e.target.value })} placeholder="https://t.me/..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>المكافأة (SKZ)</Label>
              <Field type="number" min={0} value={taskDraft.reward} data-testid="input-task-reward" onChange={(e) => setTaskDraft({ ...taskDraft, reward: Math.max(0, Number(e.target.value) || 0) })} />
            </div>
            <div>
              <Label>الحالة</Label>
              <div className="flex items-center gap-2 h-[38px]">
                <Toggle on={taskDraft.active} testId="toggle-task-active" onClick={() => setTaskDraft({ ...taskDraft, active: !taskDraft.active })} />
                <span className="text-xs font-display text-white/50">{taskDraft.active ? "نشطة" : "معطّلة"}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="primary" onClick={saveTask} data-testid="button-save-task" className="flex-1">{taskEditId ? "حفظ التعديلات" : "إضافة"}</Button>
            <Button variant="ghost" onClick={() => setTaskOpen(false)}>إلغاء</Button>
          </div>
        </div>
      </Modal>

      {/* Promo modal */}
      <Modal open={promoOpen} onClose={() => setPromoOpen(false)} title="إضافة كود ترويجي">
        <div className="space-y-3">
          <div>
            <Label>الكود</Label>
            <Field value={promoDraft.code} data-testid="input-promo-code" onChange={(e) => setPromoDraft({ ...promoDraft, code: e.target.value.toUpperCase() })} placeholder="WELCOME50" className="font-mono tracking-wider" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>المكافأة</Label>
              <Field type="number" min={0} value={promoDraft.reward} data-testid="input-promo-reward" onChange={(e) => setPromoDraft({ ...promoDraft, reward: Math.max(0, Number(e.target.value) || 0) })} />
            </div>
            <div>
              <Label>العملة</Label>
              <Select value={promoDraft.currency} data-testid="select-promo-currency" onChange={(e) => setPromoDraft({ ...promoDraft, currency: e.target.value as Currency })}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>إجمالي الاستخدامات</Label>
              <Field type="number" min={1} value={promoDraft.totalUses} data-testid="input-promo-total" onChange={(e) => setPromoDraft({ ...promoDraft, totalUses: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
            <div>
              <Label>لكل مستخدم</Label>
              <Field type="number" min={1} value={promoDraft.perUser} data-testid="input-promo-peruser" onChange={(e) => setPromoDraft({ ...promoDraft, perUser: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>ينتهي بعد (أيام)</Label>
              <Field type="number" min={1} value={promoDraft.expiryDays} data-testid="input-promo-expiry" onChange={(e) => setPromoDraft({ ...promoDraft, expiryDays: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
            <div>
              <Label>الحالة</Label>
              <div className="flex items-center gap-2 h-[38px]">
                <Toggle on={promoDraft.active} testId="toggle-promo-active" onClick={() => setPromoDraft({ ...promoDraft, active: !promoDraft.active })} />
                <span className="text-xs font-display text-white/50">{promoDraft.active ? "نشط" : "معطّل"}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="primary" onClick={savePromo} data-testid="button-save-promo" className="flex-1">إضافة الكود</Button>
            <Button variant="ghost" onClick={() => setPromoOpen(false)}>إلغاء</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
