import { useMemo, useState } from "react";
import {
  Users, UserCheck, Ban, Flag, Search, Wallet, Calendar, Plus, Minus,
  ShieldOff, TrendingUp, TrendingDown,
} from "lucide-react";
import { useAdmin, admin } from "../../lib/admin-store";
import {
  CURRENCIES, TIER_LABEL, type Currency, type ManagedUser, type UserTier,
} from "../../lib/admin-types";
import {
  SectionHeader, StatCard, Card, Field, Label, Select, Toggle, Button, Pill,
  Table, Th, Td, EmptyState, Modal, fmt, fmtCur, compact, timeAgo, dateStr,
} from "./_ui";

const TIER_TONE: Record<UserTier, "purple" | "yellow" | "gray" | "cyan"> = {
  vip: "purple",
  gold: "yellow",
  silver: "gray",
  rookie: "cyan",
};

function truncate(s: string, head = 6, tail = 4): string {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export default function UsersSection() {
  const { users } = useAdmin();
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | UserTier>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "banned" | "flagged">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "active").length;
    const banned = users.filter((u) => u.status === "banned").length;
    const flagged = users.filter((u) => u.flagged).length;
    return { total, active, banned, flagged };
  }, [users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const hay = `${u.name} ${u.username} ${u.tgId}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (tierFilter !== "all" && u.tier !== tierFilter) return false;
      if (statusFilter === "active" && u.status !== "active") return false;
      if (statusFilter === "banned" && u.status !== "banned") return false;
      if (statusFilter === "flagged" && !u.flagged) return false;
      return true;
    });
  }, [users, query, tierFilter, statusFilter]);

  const selected = users.find((u) => u.id === selectedId) ?? null;

  return (
    <div>
      <SectionHeader
        title="إدارة المستخدمين"
        subtitle="عرض وإدارة حسابات اللاعبين والأرصدة والقيود"
        icon={Users}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="إجمالي المستخدمين" value={fmt(stats.total)} icon={Users} tone="gold" />
        <StatCard label="نشطون" value={fmt(stats.active)} icon={UserCheck} tone="green" />
        <StatCard label="محظورون" value={fmt(stats.banned)} icon={Ban} tone="red" />
        <StatCard label="مُعلَّمون" value={fmt(stats.flagged)} icon={Flag} tone="purple" />
      </div>

      {/* Filters */}
      <Card className="mb-5">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <Label>بحث</Label>
            <div className="relative">
              <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-white/30 pointer-events-none" />
              <Field
                data-testid="input-user-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="الاسم أو المعرف أو رقم تيليجرام"
                className="pr-9"
              />
            </div>
          </div>
          <div>
            <Label>المستوى</Label>
            <Select
              data-testid="select-tier-filter"
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as "all" | UserTier)}
            >
              <option value="all">الكل</option>
              <option value="rookie">{TIER_LABEL.rookie}</option>
              <option value="silver">{TIER_LABEL.silver}</option>
              <option value="gold">{TIER_LABEL.gold}</option>
              <option value="vip">{TIER_LABEL.vip}</option>
            </Select>
          </div>
          <div>
            <Label>الحالة</Label>
            <Select
              data-testid="select-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "banned" | "flagged")}
            >
              <option value="all">الكل</option>
              <option value="active">نشط</option>
              <option value="banned">محظور</option>
              <option value="flagged">مُعلَّم</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon={Users} text="لا يوجد مستخدمون مطابقون" />
        ) : (
          <Table
            head={
              <>
                <Th>المستخدم</Th>
                <Th>رقم تيليجرام</Th>
                <Th>المستوى</Th>
                <Th>الأرصدة</Th>
                <Th>إجمالي الإيداع</Th>
                <Th>آخر ظهور</Th>
                <Th>الحالة</Th>
                <Th></Th>
              </>
            }
          >
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.03] transition-colors">
                <Td>
                  <div className="flex items-center gap-2">
                    {u.flagged && <Flag size={13} className="text-purple-300 shrink-0" />}
                    <div>
                      <div className="font-bold text-white">{u.name}</div>
                      <div className="text-[11px] text-white/40">{u.username}</div>
                    </div>
                  </div>
                </Td>
                <Td className="text-white/60">{u.tgId}</Td>
                <Td>
                  <Pill tone={TIER_TONE[u.tier]}>{TIER_LABEL[u.tier]}</Pill>
                </Td>
                <Td>
                  <div className="text-[11px] leading-tight">
                    <div>{compact(u.balances.SKZ)} SKZ</div>
                    <div className="text-white/45">
                      {compact(u.balances.TON)} TON · {compact(u.balances.USDT)} USDT
                    </div>
                  </div>
                </Td>
                <Td>{fmtCur(u.totalDeposit, "USDT")}</Td>
                <Td className="text-white/55">{timeAgo(u.lastSeen)}</Td>
                <Td>
                  <Pill tone={u.status === "active" ? "green" : "red"}>
                    {u.status === "active" ? "نشط" : "محظور"}
                  </Pill>
                </Td>
                <Td>
                  <Button
                    variant="ghost"
                    data-testid={`button-user-details-${u.id}`}
                    onClick={() => setSelectedId(u.id)}
                  >
                    تفاصيل
                  </Button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <UserModal user={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function UserModal({ user, onClose }: { user: ManagedUser | null; onClose: () => void }) {
  return (
    <Modal open={!!user} onClose={onClose} title={user ? user.name : ""} wide>
      {user && <UserModalBody user={user} />}
    </Modal>
  );
}

function UserModalBody({ user }: { user: ManagedUser }) {
  const [deltas, setDeltas] = useState<Record<Currency, string>>({ SKZ: "", TON: "", USDT: "" });

  function setDelta(c: Currency, v: string) {
    setDeltas((d) => ({ ...d, [c]: v }));
  }
  function applyDelta(c: Currency, sign: 1 | -1) {
    const n = Number(deltas[c]);
    if (!Number.isFinite(n) || n === 0) return;
    admin.adjustUserBalance(user.id, c, sign * Math.abs(n));
    setDelta(c, "");
  }

  return (
    <div className="space-y-5">
      {/* Profile */}
      <div className="flex flex-wrap items-center gap-3">
        <Pill tone={TIER_TONE[user.tier]}>{TIER_LABEL[user.tier]}</Pill>
        <Pill tone={user.status === "active" ? "green" : "red"}>
          {user.status === "active" ? "نشط" : "محظور"}
        </Pill>
        {user.flagged && (
          <Pill tone="purple">
            <Flag size={10} /> مُعلَّم
          </Pill>
        )}
        <span className="text-xs text-white/45">{user.username}</span>
        <span className="text-xs text-white/45">رقم تيليجرام: {user.tgId}</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-black/30 border border-white/10 p-3">
          <div className="flex items-center gap-2 text-[11px] text-white/45 mb-1">
            <Wallet size={13} /> المحفظة
          </div>
          <div className="text-sm font-mono text-white/80" title={user.wallet}>
            {truncate(user.wallet, 8, 6)}
          </div>
          <div className="text-[11px] text-white/40 mt-1">رمز الإحالة: {user.refCode}</div>
        </div>
        <div className="rounded-xl bg-black/30 border border-white/10 p-3">
          <div className="flex items-center gap-2 text-[11px] text-white/45 mb-1">
            <Calendar size={13} /> تاريخ الانضمام
          </div>
          <div className="text-sm text-white/80">{dateStr(user.joinedAt)}</div>
          <div className="text-[11px] text-white/40 mt-1">آخر ظهور: {timeAgo(user.lastSeen)}</div>
        </div>
      </div>

      {/* Balances + adjust */}
      <div>
        <h4 className="text-sm font-display font-bold text-white mb-2">الأرصدة والتعديل</h4>
        <div className="grid sm:grid-cols-3 gap-3">
          {CURRENCIES.map((c) => (
            <div key={c} className="rounded-xl bg-black/30 border border-white/10 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-display font-bold text-white/45">{c}</span>
                <span className="text-sm font-display font-bold text-primary">{fmt(user.balances[c])}</span>
              </div>
              <Field
                type="number"
                data-testid={`input-balance-delta-${c}-${user.id}`}
                value={deltas[c]}
                onChange={(e) => setDelta(c, e.target.value)}
                placeholder="المبلغ"
                className="mb-2"
              />
              <div className="flex gap-2">
                <Button
                  variant="green"
                  icon={Plus}
                  className="flex-1"
                  data-testid={`button-balance-add-${c}-${user.id}`}
                  onClick={() => applyDelta(c, 1)}
                >
                  إضافة
                </Button>
                <Button
                  variant="red"
                  icon={Minus}
                  className="flex-1"
                  data-testid={`button-balance-deduct-${c}-${user.id}`}
                  onClick={() => applyDelta(c, -1)}
                >
                  خصم
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tier + status */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>المستوى</Label>
          <Select
            data-testid={`select-user-tier-${user.id}`}
            value={user.tier}
            onChange={(e) => admin.setUserTier(user.id, e.target.value as UserTier)}
          >
            <option value="rookie">{TIER_LABEL.rookie}</option>
            <option value="silver">{TIER_LABEL.silver}</option>
            <option value="gold">{TIER_LABEL.gold}</option>
            <option value="vip">{TIER_LABEL.vip}</option>
          </Select>
        </div>
        <div>
          <Label>الحالة</Label>
          {user.status === "active" ? (
            <Button
              variant="red"
              icon={Ban}
              className="w-full"
              data-testid={`button-user-ban-${user.id}`}
              onClick={() => admin.setUserStatus(user.id, "banned")}
            >
              حظر المستخدم
            </Button>
          ) : (
            <Button
              variant="green"
              icon={UserCheck}
              className="w-full"
              data-testid={`button-user-unban-${user.id}`}
              onClick={() => admin.setUserStatus(user.id, "active")}
            >
              رفع الحظر
            </Button>
          )}
        </div>
      </div>

      {/* Restrictions + flag */}
      <div>
        <h4 className="text-sm font-display font-bold text-white mb-2">القيود والإشارات</h4>
        <div className="space-y-2">
          {([
            { key: "withdraw" as const, label: "حظر السحب" },
            { key: "play" as const, label: "حظر اللعب" },
            { key: "chat" as const, label: "حظر الدردشة" },
          ]).map((r) => (
            <div key={r.key} className="flex items-center justify-between rounded-xl bg-black/30 border border-white/10 px-3 py-2">
              <span className="text-sm font-display text-white/75">{r.label}</span>
              <Toggle
                on={user.restrictions[r.key]}
                testId={`toggle-restriction-${r.key}-${user.id}`}
                onClick={() => admin.setUserRestriction(user.id, r.key, !user.restrictions[r.key])}
              />
            </div>
          ))}
          <div className="flex items-center justify-between rounded-xl bg-black/30 border border-white/10 px-3 py-2">
            <span className="flex items-center gap-2 text-sm font-display text-white/75">
              {user.flagged ? <Flag size={14} className="text-purple-300" /> : <ShieldOff size={14} className="text-white/40" />}
              تعليم كحساب مشبوه
            </span>
            <Toggle
              on={user.flagged}
              testId={`toggle-flag-${user.id}`}
              onClick={() => admin.setUserFlag(user.id, !user.flagged)}
            />
          </div>
        </div>
      </div>

      {/* Activity */}
      <div>
        <h4 className="text-sm font-display font-bold text-white mb-2">سجل النشاط</h4>
        {user.activity.length === 0 ? (
          <EmptyState icon={Calendar} text="لا يوجد نشاط" />
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {user.activity.map((a) => {
              const positive = (a.amount ?? 0) >= 0;
              return (
                <div key={a.id} className="flex items-center justify-between rounded-xl bg-black/20 border border-white/8 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-display text-white/80 truncate">{a.label}</div>
                    <div className="text-[10px] text-white/35">{timeAgo(a.at)}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.result && (
                      <Pill tone={a.result === "win" ? "green" : "red"}>
                        {a.result === "win" ? "فوز" : "خسارة"}
                      </Pill>
                    )}
                    {a.amount !== undefined && (
                      <span className={`flex items-center gap-1 text-sm font-display font-bold ${positive ? "text-green-300" : "text-red-300"}`}>
                        {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {positive ? "+" : "−"}
                        {fmt(Math.abs(a.amount))}
                        {a.currency ? ` ${a.currency}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
