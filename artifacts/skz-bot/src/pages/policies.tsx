import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, FileText, RefreshCcw } from "lucide-react";
import { useAdmin } from "@/lib/admin-store";
import { useLang } from "@/lib/i18n";

type Tab = "privacy" | "terms" | "refund";

export default function Policies() {
  const { policies, settings } = useAdmin();
  const lang = useLang();
  const c = settings.accent;
  const [tab, setTab] = useState<Tab>("privacy");

  const tabs: { id: Tab; icon: typeof ShieldCheck; labelAr: string; labelEn: string }[] = [
    { id: "privacy", icon: ShieldCheck, labelAr: "الخصوصية",  labelEn: "Privacy" },
    { id: "terms",   icon: FileText,    labelAr: "الشروط",    labelEn: "Terms" },
    { id: "refund",  icon: RefreshCcw,  labelAr: "الاسترداد", labelEn: "Refund" },
  ];

  const content: Record<Tab, string> = {
    privacy: policies.privacyPolicy,
    terms:   policies.termsOfService,
    refund:  policies.refundPolicy,
  };

  const titles: Record<Tab, { ar: string; en: string }> = {
    privacy: { ar: "سياسة الخصوصية", en: "Privacy Policy" },
    terms:   { ar: "شروط الاستخدام", en: "Terms of Service" },
    refund:  { ar: "سياسة الاسترداد", en: "Refund Policy" },
  };

  const text = content[tab];

  return (
    <div className="flex flex-col gap-4" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center mt-2 gap-2"
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1"
          style={{ background: `${c}20`, border: `1.5px solid ${c}40` }}
        >
          <FileText size={26} style={{ color: c }} />
        </div>
        <h1 className="font-display font-black text-2xl text-white">
          {lang === "ar" ? "السياسات والشروط" : "Policies & Terms"}
        </h1>
      </motion.div>

      {/* Tab switcher */}
      <div className="flex rounded-2xl overflow-hidden border border-white/10 bg-white/5">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-display font-bold tracking-wide uppercase transition-all"
              style={active ? { background: c, color: "#000" } : { color: "rgba(255,255,255,0.4)" }}
            >
              <Icon size={14} />
              {lang === "ar" ? t.labelAr : t.labelEn}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/10 bg-white/3 p-4"
      >
        <h2 className="font-display font-black text-base text-white mb-3">
          {lang === "ar" ? titles[tab].ar : titles[tab].en}
        </h2>
        {text ? (
          <div className="text-sm text-white/60 font-display leading-relaxed whitespace-pre-wrap">
            {text}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <FileText size={28} className="text-white/15" />
            <p className="text-sm text-white/25 font-display">
              {lang === "ar" ? "لم يتم إضافة هذه السياسة بعد" : "Policy not set yet"}
            </p>
          </div>
        )}
      </motion.div>

      {/* Footer */}
      <p className="text-center text-[11px] text-white/20 font-display pb-2">
        Souqrates System ©{new Date().getFullYear()}
      </p>
    </div>
  );
}
