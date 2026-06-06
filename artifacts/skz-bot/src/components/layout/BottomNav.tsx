import { Link, useLocation } from "wouter";
import { Home, Gamepad2, ShoppingCart, Wallet, Users, Mail, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { useLang, setLang, t } from "@/lib/i18n";

export function BottomNav() {
  const [location] = useLocation();
  const lang = useLang();
  const s = t[lang];

  const tabs = [
    { path: "/", icon: Home, label: s.home },
    { path: "/games", icon: Gamepad2, label: s.games },
    { path: "/shop", icon: ShoppingCart, label: s.shop },
    { path: "/wallet", icon: Wallet, label: s.wallet },
    { path: "/referrals", icon: Users, label: s.referrals },
  ];

  return (
    <div className="absolute bottom-0 w-full px-4 pb-4 pt-3 bg-card/80 backdrop-blur-xl border-t border-white/10 z-50 rounded-t-3xl">
      <div className="flex justify-between items-center max-w-sm mx-auto">
        {tabs.map((tab) => {
          const isActive = location === tab.path;
          const Icon = tab.icon;
          return (
            <Link key={tab.path} href={tab.path}>
              <div className="relative flex flex-col items-center justify-center w-14 h-12 cursor-pointer group">
                {isActive && (
                  <motion.div
                    layoutId="bubble"
                    className="absolute inset-0 bg-primary/10 rounded-2xl -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon
                  size={22}
                  className={`transition-colors duration-300 ${
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span
                  className={`text-[10px] mt-1 font-medium transition-all duration-300 ${
                    isActive ? "text-primary opacity-100" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute -top-3 w-1 h-1 rounded-full bg-primary shadow-[0_0_8px_2px_rgba(212,175,55,0.5)]" />
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer row: language toggle + contact + policies */}
      <div className="flex items-center justify-between mt-2 max-w-sm mx-auto">
        <button
          onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/6 border border-white/10 text-white/35 text-[10px] font-bold tracking-wider hover:text-white/60 transition-all"
        >
          {s.langSwitch}
        </button>

        <div className="flex items-center gap-3">
          <Link href="/contact">
            <div className={`flex items-center gap-1 text-[10px] font-display transition-colors ${location === "/contact" ? "text-primary" : "text-white/30 hover:text-white/55"}`}>
              <Mail size={11} />
              {lang === "ar" ? "تواصل" : "Contact"}
            </div>
          </Link>
          <Link href="/policies">
            <div className={`flex items-center gap-1 text-[10px] font-display transition-colors ${location === "/policies" ? "text-primary" : "text-white/30 hover:text-white/55"}`}>
              <FileText size={11} />
              {lang === "ar" ? "السياسات" : "Policies"}
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
