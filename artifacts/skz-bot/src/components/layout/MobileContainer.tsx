import React, { useEffect, useState } from "react";

export function MobileContainer({ children }: { children: React.ReactNode }) {
  // Enforce dark mode
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="min-h-screen bg-black w-full flex justify-center overflow-hidden font-sans">
      <div className="w-full max-w-[430px] bg-background relative flex flex-col h-[100dvh] shadow-2xl border-x border-white/5 overflow-hidden">
        {/* Glow effect at the top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-primary/20 blur-[100px] pointer-events-none rounded-full" />
        
        {children}
      </div>
    </div>
  );
}
