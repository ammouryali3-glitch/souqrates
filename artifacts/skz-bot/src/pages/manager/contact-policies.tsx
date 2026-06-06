import { Save, Mail, Phone, MapPin, Clock, MessageCircle, Twitter, Instagram, ShieldCheck, FileText, RefreshCcw, Send } from "lucide-react";
import { useAdmin, admin } from "../../lib/admin-store";
import type { ContactInfo, PolicyTexts } from "../../lib/admin-types";
import { Card, SectionHeader, StatCard, Label, Field, Area, Button } from "./_ui";

// ── Contact info editor ───────────────────────────────────────────────────────
function ContactEditor() {
  const { contactInfo } = useAdmin();

  function set(k: keyof ContactInfo, v: string) {
    admin.setContactInfo({ [k]: v });
  }

  const fields: { key: keyof ContactInfo; label: string; placeholder: string; icon: typeof Mail }[] = [
    { key: "email",            label: "البريد الإلكتروني العام",   placeholder: "info@example.com",          icon: Mail },
    { key: "supportEmail",     label: "بريد الدعم الفني",          placeholder: "support@example.com",       icon: Send },
    { key: "phone",            label: "رقم الهاتف",                placeholder: "+966 5x xxx xxxx",           icon: Phone },
    { key: "address",          label: "العنوان البريدي",           placeholder: "الرياض، المملكة العربية السعودية", icon: MapPin },
    { key: "telegramChannel",  label: "رابط قناة تيليغرام",        placeholder: "https://t.me/channel",      icon: MessageCircle },
    { key: "telegramSupport",  label: "رابط دعم تيليغرام",         placeholder: "https://t.me/support",      icon: MessageCircle },
    { key: "twitter",          label: "رابط تويتر / X",            placeholder: "https://x.com/account",     icon: Twitter },
    { key: "instagram",        label: "رابط إنستغرام",             placeholder: "https://instagram.com/account", icon: Instagram },
    { key: "workingHours",     label: "ساعات العمل",               placeholder: "السبت – الخميس، 9ص – 6م",  icon: Clock },
  ];

  return (
    <Card title="بيانات التواصل" icon={Mail} action={
      <div className="flex items-center gap-1.5 text-[11px] font-display text-green-300/70">
        <Save size={12} /> تُحفظ تلقائياً
      </div>
    }>
      <div className="grid sm:grid-cols-2 gap-3">
        {fields.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.key}>
              <Label>
                <span className="flex items-center gap-1.5">
                  <Icon size={11} className="text-white/40" /> {f.label}
                </span>
              </Label>
              <Field
                value={contactInfo[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Policies editor ───────────────────────────────────────────────────────────
function PoliciesEditor() {
  const { policies } = useAdmin();

  function set(k: keyof PolicyTexts, v: string) {
    admin.setPolicies({ [k]: v });
  }

  const sections: { key: keyof PolicyTexts; label: string; icon: typeof ShieldCheck; placeholder: string }[] = [
    {
      key: "privacyPolicy",
      label: "سياسة الخصوصية",
      icon: ShieldCheck,
      placeholder: "اكتب سياسة الخصوصية هنا — كيف تجمع البيانات، ما تستخدمه، وحقوق المستخدم...",
    },
    {
      key: "termsOfService",
      label: "شروط الاستخدام",
      icon: FileText,
      placeholder: "اكتب شروط الاستخدام هنا — قواعد استخدام التطبيق، الالتزامات، والمسؤوليات...",
    },
    {
      key: "refundPolicy",
      label: "سياسة الاسترداد",
      icon: RefreshCcw,
      placeholder: "اكتب سياسة الاسترداد هنا — حالات الاسترداد المقبولة، الإجراءات، والمدة الزمنية...",
    },
  ];

  return (
    <Card title="السياسات القانونية" icon={FileText} action={
      <div className="flex items-center gap-1.5 text-[11px] font-display text-green-300/70">
        <Save size={12} /> تُحفظ تلقائياً وتظهر في التطبيق فوراً
      </div>
    }>
      <div className="flex flex-col gap-4">
        {sections.map((sec) => {
          const Icon = sec.icon;
          return (
            <div key={sec.key}>
              <Label>
                <span className="flex items-center gap-1.5">
                  <Icon size={11} className="text-white/40" /> {sec.label}
                </span>
              </Label>
              <Area
                rows={6}
                value={policies[sec.key]}
                onChange={(e) => set(sec.key, e.target.value)}
                placeholder={sec.placeholder}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function ContactPoliciesSection() {
  const { contactInfo, policies } = useAdmin();

  const filledContact = Object.values(contactInfo).filter(Boolean).length;
  const filledPolicies = Object.values(policies).filter(Boolean).length;

  return (
    <div>
      <SectionHeader
        title="التواصل والسياسات"
        subtitle="بيانات التواصل المعروضة للمستخدمين، والسياسات القانونية للتطبيق"
        icon={Mail}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="حقول التواصل المكتملة" value={filledContact} icon={Mail} tone="cyan" />
        <StatCard label="سياسات مكتوبة" value={filledPolicies} icon={FileText} tone="green" />
        <StatCard label="قنوات متاحة" value={filledContact} icon={MessageCircle} tone="purple" />
        <StatCard label="البريد الإلكتروني" value={contactInfo.email ? "✓" : "—"} icon={Send} tone={contactInfo.email ? "green" : "gray"} />
      </div>

      <div className="flex flex-col gap-5">
        <ContactEditor />
        <PoliciesEditor />
      </div>
    </div>
  );
}
