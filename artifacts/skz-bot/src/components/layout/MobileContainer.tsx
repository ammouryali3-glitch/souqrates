import React, { useEffect, useState } from "react";

import { User } from "lucide-react";

export function MobileContainer({ children, hideHeader = false }: { children: React.ReactNode; hideHeader?: boolean }) {
  // Enforce dark mode
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Re-call expand() after React mounts — catches cases where the initial
  // call in main.tsx fired before Telegram's viewport was fully ready.
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg && !tg.isExpanded) tg.expand();
  }, []);

  return (
    <div className="min-h-screen bg-black w-full flex justify-center overflow-hidden font-sans">
      <div className="w-full max-w-[430px] bg-background relative flex flex-col h-[100dvh] shadow-2xl border-x border-white/5 overflow-hidden">
        {/* Glow effect at the top */}
        {!hideHeader && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-primary/20 blur-[100px] pointer-events-none rounded-full" />
        )}

        {/* Top App Bar */}
        {!hideHeader && (
        <header className="flex items-center justify-between px-5 pt-6 pb-2 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.4)]">
              <span className="font-display font-bold text-primary-foreground text-sm tracking-tighter">SQ</span>
            </div>
            <h1 className="font-display font-black text-lg tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">SOUQRATES</h1>
          </div>
          <div className="w-9 h-9 rounded-full bg-card/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white hover:border-primary/50 transition-colors cursor-pointer shadow-sm">
            <User size={18} />
          </div>
        </header>
        )}

        {children}
      </div>
    </div>
  );
}
