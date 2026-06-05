import {
  LayoutDashboard, Users, Wallet, Gamepad2, TrendingUp, Trophy, Coins,
  ArrowDownToLine, ArrowUpFromLine, AlertTriangle, Megaphone, ShieldAlert,
  ChevronLeft, type LucideIcon,
} from "lucide-react";
import { useAdmin } from "../../lib/admin-store";
import {
  Card, SectionHeader, StatCard, Pill, BarChart, Sparkline,
  fmt, fmtCur, compact, timeAgo,
} from "./_ui";

const DAYS = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

function QuickLink({ label, icon: Icon, onClick, tone }: {
  label: string; icon: LucideIcon; onClick: () => void; tone: string;
}) {
  return (
    <button onClick={onClick} data-testid={`quicklink-${label}`}
      className="group flex items-center gap-3 rounded-2xl bg-[#0f0c1d]/80 border border-white/8 p-3.5 hover:border-primary/40 transition-colors text-right">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${tone}`}>
        <Icon size={18} className="text-white" />
      </div>
      <span className="flex-1 text-sm font-display font-bold text-white">{label}</span>
      <ChevronLeft size={16} className="text-white/30 group-hover:text-primary transition-colors" />
    </button>
  );
}

export default function OverviewSection({ onNavigate }: { onNavigate: (id: string) => void }) {
  const state = useAdmin();
  const { users, deposits, withdrawals, referrers, products, settings, tickets, gameOverrides } = state;

  const activeUsers = users.filter((u) => u.status === "active").length;
  const flagged = users.filter((u) => u.flagged).length;
  const pendingW = withdrawals.filter((w) => w.status === "pending");
  const openTickets = tickets.filter((t) => t.status === "open").length;
  const hiddenGames = Object.values(gameOverrides).filter((o) => o.enabled === false).length;

  const totalDepositVol = deposits.reduce((s, d) => s + (d.currency === "SKZ" ? 0 : d.amount), 0);
  const commissionPaid = referrers.reduce((s, r) => s + r.earned, 0);
  const skzInCirculation = users.reduce((s, u) => s + u.balances.SKZ, 0);

  // synthetic 7-day trends (deterministic from current data)
  const base = Math.max(20, activeUsers * 4);
  const revenue = DAYS.map((_, i) => Math.round(base * (0.6 + 0.12 * i) + (i % 2 ? 40 : 0)));
  const signups = DAYS.map((_, i) => Math.round(base * 0.3 * (0.7 + 0.1 * i)));
  const dau = DAYS.map((_, i) => Math.round(base * 1.4 * (0.85 + 0.05 * i)));

  const topDepositors = [...users].sort((a, b) => b.totalDeposit - a.totalDeposit).slice(0, 5);
  const topWinners = [...users].sort((a, b) => b.totalWins - a.totalWins).slice(0, 5);
  const recentDeposits = [...deposits].sort((a, b) => b.at - a.at).slice(0, 6);

  return (
    <div>
      <SectionHeader title="نظرة عامة" subtitle="ملخّص حيّ لأداء المنصة والوصول السريع لكل الأقسام" icon={LayoutDashboard} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="المستخدمون" value={fmt(users.length)} icon={Users} tone="blue" hint={`${activeUsers} نشط`} />
        <StatCard label="حجم الإيداعات" value={fmtCur(totalDepositVol, "USDT")} icon={Wallet} tone="green" hint="USDT تقريبي" />
        <StatCard label="سحوبات معلّقة" value={pendingW.length} icon={ArrowUpFromLine} tone={pendingW.length ? "gold" : "green"} hint={fmtCur(pendingW.reduce((s, w) => s + w.amount, 0), "USDT")} />
        <StatCard label="SKZ المتداول" value={compact(skzInCirculation)} icon={Coins} tone="purple" hint="رصيد اللاعبين" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="عمولات الإحالة" value={fmt(commissionPaid)} icon={TrendingUp} tone="cyan" hint="SKZ مدفوعة" />
        <StatCard label="حسابات مشبوهة" value={flagged} icon={ShieldAlert} tone={flagged ? "red" : "green"} />
        <StatCard label="تذاكر مفتوحة" value={openTickets} icon={Megaphone} tone={openTickets ? "gold" : "green"} />
        <StatCard label="منتجات المتجر" value={products.length} icon={Gamepad2} tone="gold" hint={`${hiddenGames} لعبة مخفية`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2" title="الإيرادات — آخر ٧ أيام" icon={TrendingUp}>
          <BarChart data={revenue.map((v, i) => ({ label: DAYS[i].slice(0, 3), value: v }))} />
        </Card>
        <div className="flex flex-col gap-4">
          <Card title="المستخدمون النشطون يومياً" icon={Users}>
            <Sparkline data={dau} color="#22d3ee" />
            <div className="text-2xl font-display font-black text-white mt-1">{compact(dau[dau.length - 1])}</div>
          </Card>
          <Card title="تسجيلات جديدة" icon={TrendingUp}>
            <Sparkline data={signups} color="#a855f7" />
            <div className="text-2xl font-display font-black text-white mt-1">{fmt(signups[signups.length - 1])}</div>
          </Card>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card title="أكبر المودعين" icon={Wallet}>
          <div className="flex flex-col gap-2">
            {topDepositors.map((u, i) => (
              <div key={u.id} className="flex items-center gap-2">
                <span className={`w-5 text-xs font-display font-black ${i < 3 ? "text-primary" : "text-white/30"}`}>{i + 1}</span>
                <span className="flex-1 text-sm font-display text-white truncate">{u.name}</span>
                <span className="text-xs font-display font-bold text-green-300">{fmtCur(u.totalDeposit, "USDT")}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="أكثر الفائزين" icon={Trophy}>
          <div className="flex flex-col gap-2">
            {topWinners.map((u, i) => (
              <div key={u.id} className="flex items-center gap-2">
                <span className={`w-5 text-xs font-display font-black ${i < 3 ? "text-primary" : "text-white/30"}`}>{i + 1}</span>
                <span className="flex-1 text-sm font-display text-white truncate">{u.name}</span>
                <Pill tone="gold">{fmt(u.totalWins)} فوز</Pill>
              </div>
            ))}
          </div>
        </Card>
        <Card title="أحدث الإيداعات" icon={ArrowDownToLine}>
          <div className="flex flex-col gap-2">
            {recentDeposits.map((d) => (
              <div key={d.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm font-display text-white truncate">{d.userName}</span>
                <span className="text-xs font-display font-bold text-white/70">{fmtCur(d.amount, d.currency)}</span>
                <Pill tone={d.status === "confirmed" ? "green" : "yellow"}>{d.status === "confirmed" ? "مؤكد" : "معلّق"}</Pill>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {(pendingW.length > 0 || flagged > 0 || openTickets > 0) && (
        <Card className="mb-6 border-amber-500/25" title="يحتاج انتباهك" icon={AlertTriangle}>
          <div className="flex flex-wrap gap-2">
            {pendingW.length > 0 && (
              <button onClick={() => onNavigate("finance")} className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs font-display font-bold text-amber-200">
                <ArrowUpFromLine size={14} /> {pendingW.length} سحب بانتظار الموافقة · آخر طلب {timeAgo(pendingW[0].at)}
              </button>
            )}
            {flagged > 0 && (
              <button onClick={() => onNavigate("security")} className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs font-display font-bold text-red-200">
                <ShieldAlert size={14} /> {flagged} حساب مشبوه
              </button>
            )}
            {openTickets > 0 && (
              <button onClick={() => onNavigate("content")} className="flex items-center gap-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-xs font-display font-bold text-yellow-200">
                <Megaphone size={14} /> {openTickets} تذكرة دعم مفتوحة
              </button>
            )}
          </div>
        </Card>
      )}

      <div className="text-sm font-display font-black text-white/70 mb-3">الوصول السريع</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <QuickLink label="المستخدمون" icon={Users} onClick={() => onNavigate("users")} tone="from-blue-500/40 to-indigo-600/30" />
        <QuickLink label="الألعاب والأرباح" icon={Gamepad2} onClick={() => onNavigate("games")} tone="from-yellow-500/40 to-amber-600/30" />
        <QuickLink label="الاقتصاد والمتجر" icon={Coins} onClick={() => onNavigate("economy")} tone="from-emerald-500/40 to-green-600/30" />
        <QuickLink label="المالية والسحوبات" icon={Wallet} onClick={() => onNavigate("finance")} tone="from-green-500/40 to-teal-600/30" />
        <QuickLink label="نظام الإحالة" icon={TrendingUp} onClick={() => onNavigate("affiliate")} tone="from-cyan-500/40 to-sky-600/30" />
        <QuickLink label="الأمان والتدقيق" icon={ShieldAlert} onClick={() => onNavigate("security")} tone="from-red-500/40 to-rose-600/30" />
        <QuickLink label="التحفيز والمكافآت" icon={Trophy} onClick={() => onNavigate("gamification")} tone="from-purple-500/40 to-fuchsia-600/30" />
        <QuickLink label="المحتوى والبث" icon={Megaphone} onClick={() => onNavigate("content")} tone="from-fuchsia-500/40 to-pink-600/30" />
        <QuickLink label="النظام والإدارة" icon={LayoutDashboard} onClick={() => onNavigate("system")} tone="from-slate-500/40 to-gray-600/30" />
      </div>
    </div>
  );
}
