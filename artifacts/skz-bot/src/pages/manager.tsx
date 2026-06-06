import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, Users, Gamepad2, Store, Share2, Wallet, ShieldAlert,
  Trophy, Megaphone, Settings2, Menu, X, ArrowRight, UserCog, AlertTriangle,
  Search, CornerDownLeft, LogOut, ShieldOff, Mail, type LucideIcon,
} from "lucide-react";
import { useAdmin, admin, syncBalance, refreshFromApi } from "../lib/admin-store";
import { ARENA_GAMES, SKILL_GAMES } from "../lib/games-data";
import {
  fetchAdminSession, logoutAdmin, hasPermission,
  AdminSessionContext,
} from "../lib/admin-auth";
import type { AdminSessionInfo } from "../lib/admin-auth";
import type { Permission } from "../lib/admin-types";

import AdminLogin from "./manager/login";
import ChangePasswordScreen from "./manager/change-password";
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
import ContactPoliciesSection from "./manager/contact-policies";

type SectionId =
  | "overview" | "users" | "games" | "economy" | "affiliate"
  | "finance" | "security" | "gamification" | "content" | "system"
  | "contact-policies";

const NAV: { id: SectionId; label: string; icon: LucideIcon; group: string; perm?: Permission }[] = [
  { id: "overview",          label: "نظرة عامة",          icon: LayoutDashboard, group: "الرئيسية" },
  { id: "users",             label: "المستخدمون",          icon: Users,           group: "الإدارة",  perm: "users" },
  { id: "games",             label: "الألعاب والأرباح",    icon: Gamepad2,        group: "الإدارة",  perm: "games" },
  { id: "economy",           label: "الاقتصاد والمتجر",   icon: Store,           group: "الإدارة",  perm: "economy" },
  { id: "affiliate",         label: "نظام الإحالة",        icon: Share2,          group: "الإدارة",  perm: "affiliate" },
  { id: "finance",           label: "المالية والسحوبات",  icon: Wallet,          group: "المالية",  perm: "finance" },
  { id: "security",          label: "الأمان والتدقيق",    icon: ShieldAlert,     group: "المالية",  perm: "security" },
  { id: "gamification",      label: "التحفيز والمكافآت",  icon: Trophy,          group: "النمو",    perm: "gamification" },
  { id: "content",           label: "المحتوى والبث",      icon: Megaphone,       group: "النمو",    perm: "content" },
  { id: "contact-policies",  label: "التواصل والسياسات",  icon: Mail,            group: "النمو",    perm: "content" },
  { id: "system",            label: "النظام والإدارة",    icon: Settings2,       group: "النظام",   perm: "system" },
];

const GROUPS = ["الرئيسية", "الإدارة", "المالية", "النمو", "النظام"];

// ── Access denied placeholder ─────────────────────────────────────────────────
function AccessDenied({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center">
        <ShieldOff size={28} className="text-red-400" />
      </div>
      <div>
        <div className="text-base font-display font-black text-white">لا تملك صلاحية الوصول</div>
        <div className="text-sm text-white/40 font-display mt-1">
          قسم "{label}" غير متاح لدورك الحالي.
        </div>
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
function Dashboard({
  session,
  onLogout,
}: {
  session: AdminSessionInfo;
  onLogout: () => void;
}) {
  const [section, setSection] = useState<SectionId>("overview");
  const [open, setOpen] = useState(false);
  const [userSeed, setUserSeed] = useState<{ q: string; n: number }>({ q: "", n: 0 });
  const { settings } = useAdmin();

  const isOwner = session.role === "owner";

  useEffect(() => {
    document.documentElement.classList.add("dark");
    syncBalance();
  }, []);

  // If the current section is no longer accessible, bounce back to overview.
  useEffect(() => {
    const navItem = NAV.find((n) => n.id === section);
    if (navItem?.perm && !hasPermission(session, navItem.perm)) {
      setSection("overview");
    }
  }, [section, session]);

  const active = NAV.find((n) => n.id === section)!;
  const visibleNav = NAV.filter((n) => !n.perm || hasPermission(session, n.perm));

  function go(id: SectionId) {
    const navItem = NAV.find((n) => n.id === id);
    if (navItem?.perm && !hasPermission(session, navItem.perm)) return;
    setSection(id);
    setOpen(false);
  }

  function searchToUser(q: string) {
    if (!hasPermission(session, "users")) return;
    setUserSeed((s) => ({ q, n: s.n + 1 }));
    go("users");
  }

  async function handleLogout() {
    await logoutAdmin();
    onLogout();
  }

  function renderSection() {
    const navItem = NAV.find((n) => n.id === section);
    const label = navItem?.label ?? section;
    if (navItem?.perm && !hasPermission(session, navItem.perm)) {
      return <AccessDenied label={label} />;
    }
    switch (section) {
      case "overview":     return <OverviewSection onNavigate={go} />;
      case "users":        return <UsersSection seed={userSeed} />;
      case "games":        return <GamesSection />;
      case "economy":      return <EconomySection />;
      case "affiliate":    return <AffiliateSection />;
      case "finance":      return <FinanceSection />;
      case "security":     return <SecuritySection />;
      case "gamification": return <GamificationSection />;
      case "content":           return <ContentSection />;
      case "contact-policies":  return <ContactPoliciesSection />;
      case "system":            return <SystemSection />;
    }
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
          {GROUPS.map((g) => {
            const groupItems = visibleNav.filter((n) => n.group === g);
            if (groupItems.length === 0) return null;
            return (
              <div key={g}>
                <div className="px-3 mb-2 text-[10px] font-display font-bold text-white/25 tracking-wider">{g}</div>
                <div className="space-y-1">
                  {groupItems.map((n) => {
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
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-white/8 shrink-0 flex flex-col gap-1.5">
          <button
            onClick={handleLogout}
            data-testid="button-logout-admin"
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-display font-bold transition-colors border border-red-500/20"
          >
            <LogOut size={16} /> تسجيل الخروج
          </button>
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
          <div className="hidden sm:flex items-center gap-2 min-w-0 shrink-0">
            <active.icon size={18} className="text-primary shrink-0" />
            <span className="font-display font-bold text-white truncate hidden md:block">{active.label}</span>
          </div>

          <GlobalSearch
            onSection={go}
            onUser={searchToUser}
            canSearchUsers={hasPermission(session, "users")}
            allowedNav={visibleNav}
          />

          {isOwner && (
            <button
              onClick={() => admin.setSettings({ maintenance: !settings.maintenance })}
              data-testid="button-toggle-maintenance"
              title="تبديل وضع الصيانة"
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-display font-bold border transition-colors shrink-0 ${
                settings.maintenance
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                  : "bg-white/5 border-white/10 text-white/45 hover:text-white/70"
              }`}
            >
              <AlertTriangle size={13} /> {settings.maintenance ? "الصيانة: مفعّلة" : "الصيانة: معطّلة"}
            </button>
          )}

          <div className="flex items-center gap-2 pr-1 shrink-0">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-display font-bold text-white">{session.name}</div>
              <div className="text-[10px] text-white/35 font-display">{session.handle}</div>
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
              {renderSection()}
            </motion.div>
          </AnimatePresence>
          <div className="h-10" />
        </main>
      </div>
    </div>
  );
}

// ── Auth gate ─────────────────────────────────────────────────────────────────
export default function Manager() {
  const [session, setSession] = useState<AdminSessionInfo | null | "loading">("loading");

  useEffect(() => {
    fetchAdminSession().then(setSession);
  }, []);

  // When session transitions to authenticated, pull the full admin state from
  // the server so the dashboard sees live data without a page refresh.
  useEffect(() => {
    if (session && session !== "loading") {
      refreshFromApi().catch(() => {});
    }
  }, [session]);

  if (session === "loading") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#070510]">
        <span className="w-8 h-8 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (session === null) {
    return <AdminLogin onSuccess={setSession} />;
  }

  if (session.mustChangePassword) {
    return (
      <AdminSessionContext.Provider value={session}>
        <ChangePasswordScreen session={session} onDone={setSession} />
      </AdminSessionContext.Provider>
    );
  }

  return (
    <AdminSessionContext.Provider value={session}>
      <Dashboard session={session} onLogout={() => setSession(null)} />
    </AdminSessionContext.Provider>
  );
}

// ── Global search ─────────────────────────────────────────────────────────────
function GlobalSearch({
  onSection,
  onUser,
  canSearchUsers,
  allowedNav,
}: {
  onSection: (id: SectionId) => void;
  onUser: (q: string) => void;
  canSearchUsers: boolean;
  allowedNav: typeof NAV;
}) {
  const { users } = useAdmin();
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const term = q.trim().toLowerCase();

  const games = [...ARENA_GAMES, ...SKILL_GAMES];
  const navHits = term ? allowedNav.filter((n) => n.label.toLowerCase().includes(term)).slice(0, 4) : [];
  const userHits = term && canSearchUsers
    ? users
        .filter((u) => `${u.name} ${u.username} ${u.tgId} ${u.wallet} ${u.refCode}`.toLowerCase().includes(term))
        .slice(0, 5)
    : [];
  const gameHits = term ? games.filter((g) => `${g.title} ${g.tagline}`.toLowerCase().includes(term)).slice(0, 4) : [];
  const showDrop = focused && term.length >= 1;
  const hasHits = navHits.length + userHits.length + gameHits.length > 0;

  function reset() {
    setQ("");
    setFocused(false);
  }

  return (
    <div className="relative flex-1 max-w-md mx-auto">
      <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-white/30 pointer-events-none" />
      <input
        data-testid="input-global-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && term && canSearchUsers) onUser(q.trim());
          if (e.key === "Escape") reset();
        }}
        placeholder="بحث شامل — مستخدمون، ألعاب، أقسام…"
        className="w-full h-10 rounded-xl bg-black/30 border border-white/12 pr-9 pl-3 text-sm font-display text-white placeholder:text-white/30 focus:outline-none focus:border-primary/40"
      />
      {showDrop && (
        <div className="absolute z-50 top-12 right-0 left-0 rounded-2xl bg-[#0f0c1d] border border-white/12 shadow-2xl shadow-black/60 overflow-hidden max-h-[70vh] overflow-y-auto">
          {!hasHits ? (
            <div className="px-4 py-6 text-center text-xs font-display text-white/40">لا نتائج مطابقة</div>
          ) : (
            <div className="py-1.5">
              {navHits.length > 0 && (
                <div>
                  <div className="px-4 pt-2 pb-1 text-[10px] font-display font-bold text-white/30">الأقسام</div>
                  {navHits.map((n) => (
                    <button
                      key={n.id}
                      data-testid={`search-section-${n.id}`}
                      onMouseDown={(e) => { e.preventDefault(); onSection(n.id); reset(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-display text-white/75 hover:bg-white/6 text-right"
                    >
                      <n.icon size={15} className="text-primary shrink-0" /> {n.label}
                    </button>
                  ))}
                </div>
              )}
              {userHits.length > 0 && (
                <div>
                  <div className="px-4 pt-2 pb-1 text-[10px] font-display font-bold text-white/30">المستخدمون</div>
                  {userHits.map((u) => (
                    <button
                      key={u.id}
                      data-testid={`search-user-${u.id}`}
                      onMouseDown={(e) => { e.preventDefault(); onUser(u.username); reset(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-white/6 text-right"
                    >
                      <Users size={15} className="text-accent shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-display font-bold text-white truncate">{u.name}</div>
                        <div className="text-[10px] text-white/40 font-display truncate">{u.username} · {u.refCode}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {gameHits.length > 0 && (
                <div>
                  <div className="px-4 pt-2 pb-1 text-[10px] font-display font-bold text-white/30">الألعاب</div>
                  {gameHits.map((g) => (
                    <button
                      key={g.id}
                      data-testid={`search-game-${g.id}`}
                      onMouseDown={(e) => { e.preventDefault(); onSection("games"); reset(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-display text-white/75 hover:bg-white/6 text-right"
                    >
                      <Gamepad2 size={15} className="text-cyan-300 shrink-0" /> {g.title}
                    </button>
                  ))}
                </div>
              )}
              <div className="px-4 py-2 mt-1 border-t border-white/8 flex items-center gap-1.5 text-[10px] font-display text-white/30">
                <CornerDownLeft size={11} /> اضغط Enter للبحث في المستخدمين
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export type { SectionId };
