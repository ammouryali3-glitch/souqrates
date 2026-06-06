import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Clock, Send, MessageCircle, Twitter, Instagram } from "lucide-react";
import { useAdmin } from "@/lib/admin-store";
import { useLang, t } from "@/lib/i18n";

export default function Contact() {
  const { contactInfo, settings } = useAdmin();
  const lang = useLang();
  const s = t[lang];
  const c = settings.accent;

  const cards = [
    {
      icon: Mail,
      label: lang === "ar" ? "البريد الإلكتروني" : "Email",
      value: contactInfo.email,
      sub: lang === "ar" ? "للاستفسارات العامة" : "General inquiries",
      href: contactInfo.email ? `mailto:${contactInfo.email}` : undefined,
    },
    {
      icon: Send,
      label: lang === "ar" ? "بريد الدعم الفني" : "Support Email",
      value: contactInfo.supportEmail,
      sub: lang === "ar" ? "للمشكلات التقنية" : "Technical issues",
      href: contactInfo.supportEmail ? `mailto:${contactInfo.supportEmail}` : undefined,
    },
    {
      icon: Phone,
      label: lang === "ar" ? "الهاتف" : "Phone",
      value: contactInfo.phone,
      sub: lang === "ar" ? "الاتصال المباشر" : "Direct call",
      href: contactInfo.phone ? `tel:${contactInfo.phone}` : undefined,
    },
    {
      icon: MapPin,
      label: lang === "ar" ? "العنوان البريدي" : "Address",
      value: contactInfo.address,
      sub: "",
      href: undefined,
    },
    {
      icon: MessageCircle,
      label: lang === "ar" ? "قناة تيليغرام" : "Telegram Channel",
      value: contactInfo.telegramChannel,
      sub: lang === "ar" ? "أخبار ومستجدات" : "News & updates",
      href: contactInfo.telegramChannel ? contactInfo.telegramChannel : undefined,
    },
    {
      icon: MessageCircle,
      label: lang === "ar" ? "دعم تيليغرام" : "Telegram Support",
      value: contactInfo.telegramSupport,
      sub: lang === "ar" ? "تواصل مع الدعم" : "Chat with support",
      href: contactInfo.telegramSupport ? contactInfo.telegramSupport : undefined,
    },
    {
      icon: Twitter,
      label: lang === "ar" ? "تويتر / X" : "Twitter / X",
      value: contactInfo.twitter,
      sub: "",
      href: contactInfo.twitter ? contactInfo.twitter : undefined,
    },
    {
      icon: Instagram,
      label: lang === "ar" ? "إنستغرام" : "Instagram",
      value: contactInfo.instagram,
      sub: "",
      href: contactInfo.instagram ? contactInfo.instagram : undefined,
    },
  ].filter((item) => !!item.value);

  return (
    <div className="flex flex-col gap-5" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center mt-2 gap-2"
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1"
          style={{ background: `${c}20`, border: `1.5px solid ${c}40` }}
        >
          <Mail size={26} style={{ color: c }} />
        </div>
        <h1 className="font-display font-black text-2xl text-white">
          {lang === "ar" ? "تواصل معنا" : "Contact Us"}
        </h1>
        <p className="text-xs text-white/45 max-w-[260px] font-display">
          {lang === "ar"
            ? "نحن هنا للمساعدة — اختر قناة التواصل المناسبة لك"
            : "We're here to help — choose the right channel for you"}
        </p>
      </motion.div>

      {/* Working hours banner */}
      {contactInfo.workingHours && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl border"
          style={{ background: `${c}12`, borderColor: `${c}35` }}
        >
          <Clock size={16} style={{ color: c }} className="shrink-0" />
          <div>
            <div className="text-[11px] text-white/40 font-display uppercase tracking-widest mb-0.5">
              {lang === "ar" ? "ساعات العمل" : "Working Hours"}
            </div>
            <div className="text-sm font-display font-bold text-white">{contactInfo.workingHours}</div>
          </div>
        </motion.div>
      )}

      {/* Contact cards */}
      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Mail size={32} className="text-white/20" />
          <p className="text-sm text-white/30 font-display">
            {lang === "ar" ? "لا توجد بيانات تواصل بعد" : "No contact info available yet"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cards.map((card, i) => {
            const Icon = card.icon;
            const inner = (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-colors"
                style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${c}18` }}
                >
                  <Icon size={18} style={{ color: c }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-white/35 font-display uppercase tracking-wider mb-0.5">
                    {card.label}
                  </div>
                  <div className="text-sm font-display font-semibold text-white truncate">{card.value}</div>
                  {card.sub && (
                    <div className="text-[10px] text-white/30 font-display mt-0.5">{card.sub}</div>
                  )}
                </div>
                {card.href && (
                  <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
                    <Send size={12} className="text-white/40" />
                  </div>
                )}
              </motion.div>
            );
            return card.href ? (
              <a key={i} href={card.href} target="_blank" rel="noopener noreferrer">
                {inner}
              </a>
            ) : (
              <div key={i}>{inner}</div>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center text-[11px] text-white/20 font-display pb-2"
      >
        Souqrates System ©{new Date().getFullYear()}
      </motion.p>
    </div>
  );
}
