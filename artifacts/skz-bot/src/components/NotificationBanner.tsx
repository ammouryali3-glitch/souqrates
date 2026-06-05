import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Info, CheckCircle2, AlertTriangle, Gift } from "lucide-react";
import { useAdmin, type NotifType } from "@/lib/admin-store";

const STYLE: Record<NotifType, { wrap: string; icon: typeof Info; iconColor: string }> = {
  info:    { wrap: "from-cyan-500/20 to-blue-500/10 border-cyan-400/40",    icon: Info,         iconColor: "text-cyan-300" },
  success: { wrap: "from-green-500/20 to-emerald-500/10 border-green-400/40", icon: CheckCircle2, iconColor: "text-green-300" },
  warning: { wrap: "from-amber-500/20 to-orange-500/10 border-amber-400/40",  icon: AlertTriangle, iconColor: "text-amber-300" },
  promo:   { wrap: "from-fuchsia-500/20 to-purple-500/10 border-fuchsia-400/40", icon: Gift,      iconColor: "text-fuchsia-300" },
};

export function NotificationBanner() {
  const { notifications } = useAdmin();
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const active = useMemo(
    () =>
      notifications
        .filter((n) => now >= n.startAt && now <= n.endAt && !dismissed.includes(n.id))
        .sort((a, b) => b.startAt - a.startAt),
    [notifications, now, dismissed],
  );

  const current = active[0];
  if (!current) return null;
  const s = STYLE[current.type];
  const Icon = s.icon;

  return (
    <div className="px-4 pt-3" dir="rtl">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          data-testid="notification-banner"
          className={`relative flex items-start gap-3 rounded-2xl border bg-gradient-to-l ${s.wrap} backdrop-blur px-3.5 py-3 shadow-lg`}
        >
          <div className={`mt-0.5 shrink-0 ${s.iconColor}`}><Icon size={18} /></div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-display font-bold text-white leading-tight">{current.title}</div>
            <div className="text-xs text-white/70 font-display mt-0.5 leading-snug">{current.message}</div>
          </div>
          <button
            onClick={() => setDismissed((d) => [...d, current.id])}
            data-testid="button-dismiss-notification"
            className="shrink-0 w-6 h-6 rounded-full bg-black/30 flex items-center justify-center"
          >
            <X size={13} className="text-white/70" />
          </button>
          {active.length > 1 && (
            <div className="absolute -bottom-2 right-3 flex gap-1">
              {active.slice(0, 4).map((n) => (
                <div key={n.id} className={`w-1.5 h-1.5 rounded-full ${n.id === current.id ? "bg-white/80" : "bg-white/25"}`} />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
