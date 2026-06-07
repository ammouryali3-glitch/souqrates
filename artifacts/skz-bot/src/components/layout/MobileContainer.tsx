import React, { useEffect } from "react";

export function MobileContainer({ children, hideHeader = false }: { children: React.ReactNode; hideHeader?: boolean }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg && !tg.isExpanded) tg.expand();
  }, []);

  return (
    <div className="min-h-screen bg-black w-full flex justify-center overflow-hidden font-sans">
      <div className="w-full max-w-[430px] bg-background relative flex flex-col h-[100dvh] shadow-2xl border-x border-white/5 overflow-hidden">

        {!hideHeader && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70%] h-28 bg-primary/15 blur-[80px] pointer-events-none rounded-full" />
        )}

        {!hideHeader && (
          <header className="flex items-center justify-between px-5 pt-5 pb-3 relative z-10">
            <div className="flex items-center gap-2.5">
              <img
                src="/souqrates-logo.png"
                alt="Souqrates"
                className="w-9 h-9 object-contain drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]"
              />
              <div className="flex flex-col leading-none">
                <span
                  className="font-display font-black text-[15px] tracking-widest"
                  style={{
                    background: "linear-gradient(90deg, #f0d060, #c9a227)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  SOUQRATES
                </span>
                <span className="text-[9px] text-white/30 tracking-[0.25em] font-display uppercase">System</span>
              </div>
            </div>

            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.5)]" />
            </div>
          </header>
        )}

        {children}
      </div>
    </div>
  );
}
