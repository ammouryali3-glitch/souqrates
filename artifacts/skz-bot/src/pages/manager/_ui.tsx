import React from "react";
import type { LucideIcon } from "lucide-react";
import type { Currency } from "../../lib/admin-types";

// ── Formatting ────────────────────────────────────────────────────────────────
export function fmt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}
export function fmtCur(n: number, c: Currency): string {
  const v = c === "SKZ" || c === "USDT" ? Math.round(n) : Number(n.toFixed(2));
  return `${new Intl.NumberFormat("en-US").format(v)} ${c}`;
}
export function compact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  const d = Math.floor(h / 24);
  return `قبل ${d} يوم`;
}
export function dateStr(ts: number): string {
  return new Date(ts).toLocaleDateString("ar", { day: "numeric", month: "short", year: "numeric" });
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({
  children, className = "", title, icon: Icon, action,
}: {
  children: React.ReactNode; className?: string; title?: string; icon?: LucideIcon; action?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl bg-[#0f0c1d]/80 border border-white/8 p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={16} className="text-primary" />}
            {title && <h3 className="text-sm font-display font-bold text-white">{title}</h3>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, icon: Icon, action }: {
  title: string; subtitle?: string; icon?: LucideIcon; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-5 flex-wrap">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-primary/30 to-accent/30 border border-white/10 flex items-center justify-center">
            <Icon size={20} className="text-primary" />
          </div>
        )}
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-black text-white tracking-wide">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-white/40 font-display mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
const TONE: Record<string, string> = {
  gold: "from-yellow-500/15 to-amber-600/5 border-yellow-500/25 text-yellow-300",
  green: "from-green-500/15 to-emerald-600/5 border-green-500/25 text-green-300",
  red: "from-red-500/15 to-rose-600/5 border-red-500/25 text-red-300",
  blue: "from-blue-500/15 to-indigo-600/5 border-blue-500/25 text-blue-300",
  purple: "from-purple-500/15 to-fuchsia-600/5 border-purple-500/25 text-purple-300",
  cyan: "from-cyan-500/15 to-teal-600/5 border-cyan-500/25 text-cyan-300",
};
export function StatCard({ label, value, icon: Icon, tone = "gold", hint }: {
  label: string; value: React.ReactNode; icon: LucideIcon; tone?: keyof typeof TONE | string; hint?: string;
}) {
  const t = TONE[tone] ?? TONE.gold;
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${t} border p-4 relative overflow-hidden`}>
      <Icon size={56} className="absolute -left-2 -bottom-3 opacity-10" />
      <div className="flex items-center gap-2 mb-2">
        <Icon size={15} className="opacity-80" />
        <span className="text-[11px] font-display text-white/55">{label}</span>
      </div>
      <div className="text-2xl font-display font-black text-white">{value}</div>
      {hint && <div className="text-[10px] font-display text-white/40 mt-1">{hint}</div>}
    </div>
  );
}

// ── Form atoms ────────────────────────────────────────────────────────────────
export function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-display font-bold text-white/45 mb-1">{children}</label>;
}

export function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-sm font-display focus:outline-none focus:border-primary/50 transition-colors ${props.className ?? ""}`}
    />
  );
}

export function Area(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-sm font-display focus:outline-none focus:border-primary/50 transition-colors resize-none ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-sm font-display focus:outline-none focus:border-primary/50 ${props.className ?? ""}`}
    />
  );
}

export function Toggle({ on, onClick, testId }: { on: boolean; onClick: () => void; testId?: string }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${on ? "bg-primary" : "bg-white/15"}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? "right-0.5" : "right-5"}`} />
    </button>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
const BTN: Record<string, string> = {
  primary: "bg-primary/20 border-primary/40 text-primary hover:bg-primary/30",
  green: "bg-green-500/20 border-green-400/40 text-green-300 hover:bg-green-500/30",
  red: "bg-red-500/20 border-red-400/40 text-red-300 hover:bg-red-500/30",
  ghost: "bg-white/5 border-white/10 text-white/60 hover:bg-white/10",
  accent: "bg-accent/20 border-accent/40 text-accent hover:bg-accent/30",
};
export function Button({ variant = "primary", icon: Icon, children, className = "", ...rest }: {
  variant?: keyof typeof BTN; icon?: LucideIcon; children?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`px-3.5 py-2 rounded-xl border text-xs font-display font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${BTN[variant]} ${className}`}
    >
      {Icon && <Icon size={14} />} {children}
    </button>
  );
}

// ── Badge / Pill ──────────────────────────────────────────────────────────────
const PILL: Record<string, string> = {
  green: "bg-green-500/15 text-green-300 border-green-500/30",
  red: "bg-red-500/15 text-red-300 border-red-500/30",
  yellow: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  blue: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  purple: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  gray: "bg-white/8 text-white/50 border-white/15",
};
export function Pill({ tone = "gray", children }: { tone?: keyof typeof PILL; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-display font-bold ${PILL[tone]}`}>
      {children}
    </span>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────
export function Table({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-right border-collapse">
        <thead>
          <tr className="text-[11px] font-display text-white/40 border-b border-white/10">{head}</tr>
        </thead>
        <tbody className="divide-y divide-white/5">{children}</tbody>
      </table>
    </div>
  );
}
export function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`py-2.5 px-2 font-bold whitespace-nowrap ${className}`}>{children}</th>;
}
export function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`py-2.5 px-2 text-sm font-display text-white/80 whitespace-nowrap ${className}`}>{children}</td>;
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="text-center py-12">
      <Icon size={32} className="text-white/15 mx-auto mb-3" />
      <div className="text-sm font-display text-white/35">{text}</div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[88vh] overflow-y-auto rounded-2xl bg-[#0f0c1d] border border-white/12 p-5 shadow-2xl`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-display font-bold text-white">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/8 text-white/60 flex items-center justify-center text-lg leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Mini bar chart ────────────────────────────────────────────────────────────
export function BarChart({ data, color = "#f5b301", height = 120 }: {
  data: { label: string; value: number }[]; color?: string; height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 group">
          <div
            className="w-full rounded-t-md transition-all group-hover:opacity-80"
            style={{ height: `${(d.value / max) * (height - 22)}px`, background: `linear-gradient(to top, ${color}40, ${color})`, minHeight: 2 }}
            title={`${d.label}: ${fmt(d.value)}`}
          />
          <span className="text-[9px] font-display text-white/30">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Sparkline (svg line) ──────────────────────────────────────────────────────
export function Sparkline({ data, color = "#f5b301", height = 48 }: { data: number[]; color?: string; height?: number }) {
  const max = Math.max(1, ...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 6) - 3}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
