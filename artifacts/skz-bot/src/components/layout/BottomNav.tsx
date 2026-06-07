import { Link, useLocation } from "wouter";
import { Home, Gamepad2, ShoppingCart, Wallet, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useLang, setLang, t } from "@/lib/i18n";

export function BottomNav() {
  const [location] = useLocation();
  const lang = useLang();
  const s = t[lang];

  const tabs = [
    { path: "/",          icon: Home,        label: s.home },
    { path: "/games",     icon: Gamepad2,    label: s.games },
    { path: "/shop",      icon: ShoppingCart, label: s.shop },
    { path: "/wallet",    icon: Wallet,      label: s.wallet },
    { path: "/referrals", icon: Users,       label: s.referrals },
  ];

  return (
    <div
      className="absolute bottom-0 w-full z-50"
      style={{
        background: "rgba(10,8,20,0.92)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex justify-around items-end pt-2 pb-4 px-2 max-w-sm mx-auto">
        {tabs.map((tab) => {
          const isActive = location === tab.path;
          const Icon = tab.icon;
          return (
            <Link key={tab.path} href={tab.path}>
              <div className="relative flex flex-col items-center justify-center gap-1 w-[58px] cursor-pointer">
                {/* Active indicator pill at top */}
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute -top-2 w-8 h-0.5 rounded-full"
                    style={{
                      background: "linear-gradient(90deg, #c9a227, #f0d060)",
                      boxShadow: "0 0 8px rgba(212,175,55,0.8)",
                    }}
                    transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                  />
                )}

                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200"
                  style={isActive ? {
                    background: "linear-gradient(135deg, rgba(201,162,39,0.2), rgba(240,208,96,0.1))",
                    boxShadow: "0 0 12px rgba(212,175,55,0.2)",
                  } : {}}
                >
                  <Icon
                    size={21}
                    strokeWidth={isActive ? 2.5 : 1.8}
                    style={{ color: isActive ? "#f0d060" : "rgba(255,255,255,0.4)" }}
                  />
                </div>

                <span
                  className="text-[10px] font-medium leading-none transition-all duration-200"
                  style={{ color: isActive ? "#f0d060" : "rgba(255,255,255,0.35)" }}
                >
                  {tab.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Minimal footer */}
      <div className="flex items-center justify-between pb-2 px-6 max-w-sm mx-auto">
        <button
          onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          className="text-[9px] font-bold tracking-widest transition-colors"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          {s.langSwitch}
        </button>
        <div className="flex items-center gap-4">
          <Link href="/contact">
            <span className="text-[9px] transition-colors" style={{ color: location === "/contact" ? "#c9a227" : "rgba(255,255,255,0.2)" }}>
              {s.navContact}
            </span>
          </Link>
          <Link href="/policies">
            <span className="text-[9px] transition-colors" style={{ color: location === "/policies" ? "#c9a227" : "rgba(255,255,255,0.2)" }}>
              {s.navPolicies}
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
