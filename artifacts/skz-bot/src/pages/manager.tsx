import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, Users, Gamepad2, Store, Share2, Wallet, ShieldAlert,
  Trophy, Megaphone, Settings2, Menu, X, ArrowRight, UserCog, AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { useAdmin, syncBalance } from "../lib/admin-store";

import OverviewSection from "./manager/overview";
import UsersSection from "./manager/users";
import GamesSection from "./manager/games";
import EconomySection from "./manager/economy";
import AffiliateSection from "./manager/affiliate";
import FinanceSection from "./manager/finance";
import SecuritySection from "./manager/security";
import GamificationSection from "./manager/gamification";
import ContentSection from "./manager/content";
import SystemSection from "./manager/system";

type SectionId =
  | "overview" | "users" | "games" | "economy" | "affiliate"
  | "finance" | "security" | "gamification" | "content" | "system";

const NAV: { id: SectionId; label: string; icon: LucideIcon; group: string }[] = [
  { id: "overview", label: "نظرة عامة", icon: LayoutDashboard, group: "الرئيسية" },
  { id: "users", label: "المستخدمون", icon: Users, group: "الإدارة" },
  { id: "games", label: "الألعاب والأرباح", icon: Gamepad2, group: "الإدارة" },
  { id: "economy", label: "الاقتصاد والمتجر", icon: Store, group: "الإدارة" },
  { id: "affiliate", label: "نظام الإحالة", icon: Share2, group: "الإدارة" },
  { id: "finance", label: "المالية والسحوبات", icon: Wallet, group: "المالية" },
  { id: "security", label: "الأمان والتدقيق", icon: ShieldAlert, group: "المالية" },
  { id: "gamification", label: "التحفيز والمكافآت", icon: Trophy, group: "النمو" },
  { id: "content", label: "المحتوى والبث", icon: Megaphone, group: "النمو" },
  { id: "system", label: "النظام والإدارة", icon: Settings2, group: "النظام" },
];

const GROUPS = ["الرئيسية", "الإدارة", "المالية", "النمو", "النظام"];

export default function Manager() {
  const [section, setSection] = useState<SectionId>("overview");
  const [open, setOpen] = useState(false);
  const { settings } = useAdmin();

  useEffect(() => {
    document.documentElement.classList.add("dark");
    syncBalance();
  }, []);

  const active = NAV.find((n) => n.id === section)!;

  function go(id: SectionId) {
    setSection(id);
    setOpen(false);
  }

  return (
    <div dir="rtl" className="flex h-[100dvh] bg-[#070510] text-white overflow-hidden font-sans">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static z-40 h-full w-72 shrink-0 bg-[#0b0817] border-l border-white/8 flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-center gap-3 px-5 h-16 border-b border-white/8 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.4)]">
            <span className="font-display font-bold text-black text-sm tracking-tighter">SK</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-black text-base tracking-wide truncate">{settings.appName}</div>
            <div className="text-[10px] text-white/35 font-display">لوحة التحكم الكاملة</div>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center">
            <X size={16} className="text-white/60" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {GROUPS.map((g) => (
            <div key={g}>
              <div className="px-3 mb-2 text-[10px] font-display font-bold text-white/25 tracking-wider">{g}</div>
              <div className="space-y-1">
                {NAV.filter((n) => n.group === g).map((n) => {
                  const on = n.id === section;
                  return (
                    <button
                      key={n.id}
                      onClick={() => go(n.id)}
                      data-testid={`nav-${n.id}`}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-display font-bold transition-colors ${
                        on ? "bg-gradient-to-l from-primary/25 to-accent/15 border border-primary/30 text-white" : "text-white/50 hover:text-white hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <n.icon size={18} className={on ? "text-primary" : ""} />
                      {n.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-white/8 shrink-0">
          <Link href="/">
            <button data-testid="button-exit-manager" className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm font-display font-bold transition-colors">
              <ArrowRight size={16} /> العودة للتطبيق
            </button>
          </Link>
        </div>
      </aside>

      {/* Backdrop (mobile) */}
      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/60 lg:hidden" />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 shrink-0 border-b border-white/8 bg-[#0b0817]/80 backdrop-blur-md flex items-center gap-3 px-4 sm:px-6">
          <button onClick={() => setOpen(true)} className="lg:hidden w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
            <Menu size={18} className="text-white/70" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <active.icon size={18} className="text-primary shrink-0" />
            <span className="font-display font-bold text-white truncate">{active.label}</span>
          </div>
          {settings.maintenance && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-display font-bold">
              <AlertTriangle size={13} /> وضع الصيانة
            </div>
          )}
          <div className="flex items-center gap-2 pr-1">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-display font-bold text-white">المالك</div>
              <div className="text-[10px] text-white/35 font-display">@owner</div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-yellow-600 to-amber-400 flex items-center justify-center">
              <UserCog size={17} className="text-black" />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-[1500px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {section === "overview" && <OverviewSection onNavigate={go} />}
              {section === "users" && <UsersSection />}
              {section === "games" && <GamesSection />}
              {section === "economy" && <EconomySection />}
              {section === "affiliate" && <AffiliateSection />}
              {section === "finance" && <FinanceSection />}
              {section === "security" && <SecuritySection />}
              {section === "gamification" && <GamificationSection />}
              {section === "content" && <ContentSection />}
              {section === "system" && <SystemSection />}
            </motion.div>
          </AnimatePresence>
          <div className="h-10" />
        </main>
      </div>
    </div>
  );
}

export type { SectionId };
