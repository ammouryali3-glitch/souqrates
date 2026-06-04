import { Link, useLocation } from "wouter";
import { Home, Gamepad2, ShoppingCart, Wallet, Users } from "lucide-react";
import { motion } from "framer-motion";

export function BottomNav() {
  const [location] = useLocation();

  const tabs = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/games", icon: Gamepad2, label: "Games" },
    { path: "/shop", icon: ShoppingCart, label: "Shop" },
    { path: "/wallet", icon: Wallet, label: "Wallet" },
    { path: "/referrals", icon: Users, label: "Referrals" },
  ];

  return (
    <div className="absolute bottom-0 w-full px-4 pb-6 pt-3 bg-card/80 backdrop-blur-xl border-t border-white/10 z-50 rounded-t-3xl">
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
    </div>
  );
}
