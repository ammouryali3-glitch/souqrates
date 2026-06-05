import React from "react";
import {
  ShieldAlert,
  ShieldOff,
  Flag,
  Ban,
  Snowflake,
  ShieldCheck,
  UserX,
  Users,
  ScrollText,
  AlertTriangle,
} from "lucide-react";
import { useAdmin, admin } from "../../lib/admin-store";
import type { ManagedUser } from "../../lib/admin-types";
import {
  SectionHeader,
  StatCard,
  Card,
  Label,
  Field,
  Toggle,
  Button,
  Pill,
  Table,
  Th,
  Td,
  EmptyState,
  timeAgo,
} from "./_ui";

function truncate(s: string, head = 6, tail = 4): string {
  if (!s) return "—";
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function reasonFor(u: ManagedUser): string {
  const reasons: string[] = [];
  if (u.restrictions.withdraw) reasons.push("سحب مجمّد");
  if (u.restrictions.play) reasons.push("لعب مقيّد");
  if (u.restrictions.chat) reasons.push("دردشة مقيّدة");
  if (u.status === "banned") reasons.push("محظور");
  if (reasons.length === 0) reasons.push("نشاط غير معتاد");
  return reasons.join(" · ");
}

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  at: number;
  tone: "red" | "yellow" | "blue" | "green";
}

export default function SecuritySection() {
  const { security, users } = useAdmin();

  const flagged = users.filter((u) => u.flagged);
  const bannedCount = users.filter((u) => u.status === "banned").length;

  const audit: AuditEntry[] = React.useMemo(() => {
    const out: AuditEntry[] = [];
    if (security.withdrawalsFrozen) {
      out.push({
        id: "a-freeze",
        action: "تم تجميد جميع السحوبات (تجميد طارئ)",
        actor: "@owner",
        at: Date.now() - 1000 * 60 * 8,
        tone: "red",
      });
    }
    if (security.antiDrainEnabled) {
      out.push({
        id: "a-antidrain",
        action: `تفعيل الحماية من الاستنزاف (الحد ${security.antiDrainHourlyCap} USDT/ساعة)`,
        actor: "@owner",
        at: Date.now() - 1000 * 60 * 42,
        tone: "blue",
      });
    }
    users
      .filter((u) => u.status === "banned")
      .slice(0, 4)
      .forEach((u, i) =>
        out.push({
          id: `a-ban-${u.id}`,
          action: `حظر الحساب ${u.username || u.name}`,
          actor: "@owner",
          at: Date.now() - 1000 * 60 * 60 * (i + 1),
          tone: "red",
        }),
      );
    users
      .filter((u) => u.restrictions.withdraw)
      .slice(0, 3)
      .forEach((u, i) =>
        out.push({
          id: `a-wd-${u.id}`,
          action: `تجميد سحب الحساب ${u.username || u.name}`,
          actor: "@owner",
          at: Date.now() - 1000 * 60 * 90 * (i + 1),
          tone: "yellow",
        }),
      );
    if (security.multiAccountAuto) {
      out.push({
        id: "a-multi",
        action: "تفعيل التقييد التلقائي للحسابات المتعددة",
        actor: "@owner",
        at: Date.now() - 1000 * 60 * 60 * 5,
        tone: "green",
      });
    }
    return out.sort((a, b) => b.at - a.at);
  }, [security, users]);

  return (
    <div>
      <SectionHeader
        title="الأمان والتدقيق"
        subtitle="مكافحة الغش، التجميد الطارئ وسجل العمليات"
        icon={ShieldAlert}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="حسابات معلّمة" value={flagged.length} icon={Flag} tone="yellow" />
        <StatCard
          label="حالة السحوبات"
          value={security.withdrawalsFrozen ? "مجمّدة" : "نشطة"}
          icon={security.withdrawalsFrozen ? ShieldOff : ShieldCheck}
          tone={security.withdrawalsFrozen ? "red" : "green"}
        />
        <StatCard
          label="الحماية من الاستنزاف"
          value={security.antiDrainEnabled ? "مفعّلة" : "متوقفة"}
          icon={ShieldCheck}
          tone={security.antiDrainEnabled ? "green" : "gray"}
        />
        <StatCard label="حسابات محظورة" value={bannedCount} icon={UserX} tone="red" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {/* Security settings */}
        <Card title="إعدادات الحماية" icon={ShieldCheck}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-display font-bold text-white">الحماية من الاستنزاف</div>
                <div className="text-[11px] font-display text-white/40">
                  تجميد تلقائي عند تجاوز حد السحب بالساعة
                </div>
              </div>
              <Toggle
                on={security.antiDrainEnabled}
                onClick={() => admin.setSecurity({ antiDrainEnabled: !security.antiDrainEnabled })}
                testId="toggle-anti-drain"
              />
            </div>

            <div>
              <Label>الحد الأقصى للسحب بالساعة (USDT)</Label>
              <Field
                type="number"
                value={security.antiDrainHourlyCap}
                disabled={!security.antiDrainEnabled}
                onChange={(e) =>
                  admin.setSecurity({ antiDrainHourlyCap: Number(e.target.value) || 0 })
                }
                data-testid="input-anti-drain-cap"
              />
            </div>

            <div
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${
                security.withdrawalsFrozen
                  ? "bg-red-500/10 border-red-500/40"
                  : "bg-black/20 border-white/10"
              }`}
            >
              <div className="flex items-start gap-2">
                <Snowflake
                  size={18}
                  className={security.withdrawalsFrozen ? "text-red-300 mt-0.5" : "text-white/40 mt-0.5"}
                />
                <div>
                  <div
                    className={`text-sm font-display font-bold ${
                      security.withdrawalsFrozen ? "text-red-300" : "text-white"
                    }`}
                  >
                    تجميد طارئ للسحوبات
                  </div>
                  <div className="text-[11px] font-display text-white/40">
                    إيقاف فوري لكل عمليات السحب
                  </div>
                </div>
              </div>
              <Toggle
                on={security.withdrawalsFrozen}
                onClick={() =>
                  admin.setSecurity({ withdrawalsFrozen: !security.withdrawalsFrozen })
                }
                testId="toggle-withdrawals-frozen"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-display font-bold text-white">
                  تقييد الحسابات المتعددة
                </div>
                <div className="text-[11px] font-display text-white/40">
                  تقييد تلقائي للحسابات المشتبه بتعددها
                </div>
              </div>
              <Toggle
                on={security.multiAccountAuto}
                onClick={() =>
                  admin.setSecurity({ multiAccountAuto: !security.multiAccountAuto })
                }
                testId="toggle-multi-account"
              />
            </div>
          </div>
        </Card>

        {/* Audit log */}
        <Card title="سجل التدقيق" icon={ScrollText}>
          {audit.length === 0 ? (
            <EmptyState icon={ScrollText} text="لا توجد عمليات مسجّلة" />
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {audit.map((e) => (
                <div
                  key={e.id}
                  className="flex items-start gap-3 rounded-xl bg-black/20 border border-white/8 p-3"
                >
                  <div className="mt-0.5">
                    <Pill tone={e.tone}>{e.actor}</Pill>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-display text-white/85">{e.action}</div>
                    <div className="text-[10px] font-display text-white/35 mt-0.5">
                      {timeAgo(e.at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Suspicious accounts */}
      <Card title="حسابات مشبوهة" icon={AlertTriangle}>
        {flagged.length === 0 ? (
          <EmptyState icon={Users} text="لا توجد حسابات مشبوهة حالياً" />
        ) : (
          <Table
            head={
              <>
                <Th>المستخدم</Th>
                <Th>معرّف تليجرام</Th>
                <Th>المحفظة</Th>
                <Th>السبب</Th>
                <Th className="text-left">إجراءات</Th>
              </>
            }
          >
            {flagged.map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.02]">
                <Td>
                  <div className="font-bold text-white">{u.name}</div>
                  <div className="text-[11px] text-white/40">{u.username}</div>
                </Td>
                <Td className="font-mono text-xs text-white/60">{u.tgId}</Td>
                <Td className="font-mono text-xs text-white/60">{truncate(u.wallet)}</Td>
                <Td>
                  <Pill tone="yellow">{reasonFor(u)}</Pill>
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                    <Button
                      variant="red"
                      icon={Ban}
                      onClick={() => admin.setUserStatus(u.id, "banned")}
                      disabled={u.status === "banned"}
                      data-testid={`button-ban-${u.id}`}
                    >
                      حظر
                    </Button>
                    <Button
                      variant="ghost"
                      icon={Snowflake}
                      onClick={() => admin.setUserRestriction(u.id, "withdraw", true)}
                      disabled={u.restrictions.withdraw}
                      data-testid={`button-freeze-withdraw-${u.id}`}
                    >
                      تجميد السحب
                    </Button>
                    <Button
                      variant="green"
                      icon={Flag}
                      onClick={() => admin.setUserFlag(u.id, false)}
                      data-testid={`button-unflag-${u.id}`}
                    >
                      إزالة العلم
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
