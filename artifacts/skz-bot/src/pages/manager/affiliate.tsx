import { useState } from "react";
import {
  Share2, Users, UserPlus, Coins, UserCheck, Crown, Network, ChevronLeft,
} from "lucide-react";
import { useAdmin, admin } from "../../lib/admin-store";
import { CURRENCIES, TIER_LABEL } from "../../lib/admin-types";
import type { Currency, Referrer, ReferralTrigger, UserTier } from "../../lib/admin-types";
import {
  SectionHeader, StatCard, Card, Label, Field, Select, Toggle, Button, Pill,
  Table, Th, Td, EmptyState, Modal, fmt, fmtCur,
} from "./_ui";

const TIER_TONE: Record<UserTier, "purple" | "yellow" | "gray" | "cyan"> = {
  vip: "purple",
  gold: "yellow",
  silver: "cyan",
  rookie: "gray",
};

const TRIGGERS: { key: ReferralTrigger; label: string }[] = [
  { key: "signup", label: "عند التسجيل" },
  { key: "firstDeposit", label: "عند أول إيداع" },
];

export default function AffiliateSection() {
  const { referralLevels, referralTriggers, referrers } = useAdmin();
  const [detail, setDetail] = useState<Referrer | null>(null);

  const totalReferrers = referrers.length;
  const totalReferred = referrers.reduce((sum, r) => sum + r.totalRefs, 0);
  const totalCommission = referrers.reduce((sum, r) => sum + r.earned, 0);
  const activeReferrers = referrers.filter((r) => r.activeRefs > 0).length;

  const leaderboard = [...referrers].sort((a, b) => b.earned - a.earned);

  return (
    <div>
      <SectionHeader
        title="نظام الإحالة"
        subtitle="إدارة عمولات الإحالة ومتصدري الدعوات"
        icon={Share2}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="إجمالي المحيلين" value={fmt(totalReferrers)} icon={Users} tone="gold" />
        <StatCard label="إجمالي المُحالين" value={fmt(totalReferred)} icon={UserPlus} tone="blue" />
        <StatCard label="إجمالي العمولات" value={fmtCur(totalCommission, "SKZ")} icon={Coins} tone="green" />
        <StatCard label="محيلون نشطون" value={fmt(activeReferrers)} icon={UserCheck} tone="purple" />
      </div>

      {/* Commission settings */}
      <Card title="إعدادات العمولة" icon={Network} className="mb-6">
        <div className="space-y-3">
          {referralLevels.map((lvl) => (
            <div
              key={lvl.level}
              className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_1fr] items-end gap-3 rounded-xl bg-black/20 border border-white/8 p-3"
            >
              <div className="flex items-center gap-2 sm:pb-2">
                <span className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 text-primary flex items-center justify-center text-sm font-display font-black">
                  {lvl.level}
                </span>
                <span className="text-xs font-display font-bold text-white/70">المستوى {lvl.level}</span>
              </div>
              <div>
                <Label>مفعّل</Label>
                <Toggle
                  on={lvl.enabled}
                  onClick={() => admin.setReferralLevel(lvl.level, { enabled: !lvl.enabled })}
                  testId={`toggle-level-${lvl.level}`}
                />
              </div>
              <div>
                <Label>نسبة العمولة (%)</Label>
                <Field
                  type="number"
                  value={lvl.commission}
                  min={0}
                  data-testid={`input-commission-${lvl.level}`}
                  onChange={(e) =>
                    admin.setReferralLevel(lvl.level, { commission: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </div>
              <div>
                <Label>العملة</Label>
                <Select
                  value={lvl.currency}
                  data-testid={`select-currency-${lvl.level}`}
                  onChange={(e) => admin.setReferralLevel(lvl.level, { currency: e.target.value as Currency })}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-white/8">
          <Label>مُحفّزات منح العمولة</Label>
          <div className="flex flex-wrap gap-3 mt-1">
            {TRIGGERS.map((t) => {
              const on = referralTriggers.includes(t.key);
              return (
                <div
                  key={t.key}
                  className="flex items-center gap-3 rounded-xl bg-black/20 border border-white/8 px-3 py-2"
                >
                  <span className="text-xs font-display font-bold text-white/70">{t.label}</span>
                  <Toggle
                    on={on}
                    onClick={() => admin.toggleReferralTrigger(t.key)}
                    testId={`toggle-trigger-${t.key}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Leaderboard */}
      <Card title="لوحة المتصدرين" icon={Crown}>
        {leaderboard.length === 0 ? (
          <EmptyState icon={Users} text="لا يوجد محيلون بعد" />
        ) : (
          <Table
            head={
              <>
                <Th className="text-center">#</Th>
                <Th>المحيل</Th>
                <Th>الكود</Th>
                <Th>المستوى</Th>
                <Th>مباشر</Th>
                <Th>الكل</Th>
                <Th>نشط</Th>
                <Th>العمولة</Th>
                <Th></Th>
              </>
            }
          >
            {leaderboard.map((r, i) => (
              <tr key={r.id} className="hover:bg-white/3">
                <Td className="text-center">
                  <span className={`font-display font-black ${i < 3 ? "text-primary" : "text-white/40"}`}>{i + 1}</span>
                </Td>
                <Td className="font-bold text-white">{r.name}</Td>
                <Td className="font-mono text-xs text-white/60">{r.refCode}</Td>
                <Td><Pill tone={TIER_TONE[r.tier]}>{TIER_LABEL[r.tier]}</Pill></Td>
                <Td>{fmt(r.directRefs)}</Td>
                <Td>{fmt(r.totalRefs)}</Td>
                <Td className="text-green-300">{fmt(r.activeRefs)}</Td>
                <Td className="text-primary font-bold">{fmtCur(r.earned, "SKZ")}</Td>
                <Td>
                  <Button
                    variant="ghost"
                    icon={ChevronLeft}
                    data-testid={`button-detail-${r.id}`}
                    onClick={() => setDetail(r)}
                  >
                    الشبكة
                  </Button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Referrer network modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `شبكة ${detail.name}` : ""} wide>
        {detail && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="rounded-xl bg-black/20 border border-white/8 p-3">
                <div className="text-[10px] font-display text-white/40 mb-1">الكود</div>
                <div className="font-mono text-sm text-white">{detail.refCode}</div>
              </div>
              <div className="rounded-xl bg-black/20 border border-white/8 p-3">
                <div className="text-[10px] font-display text-white/40 mb-1">إحالات مباشرة</div>
                <div className="font-display font-bold text-white">{fmt(detail.directRefs)}</div>
              </div>
              <div className="rounded-xl bg-black/20 border border-white/8 p-3">
                <div className="text-[10px] font-display text-white/40 mb-1">إجمالي الشبكة</div>
                <div className="font-display font-bold text-white">{fmt(detail.totalRefs)}</div>
              </div>
              <div className="rounded-xl bg-black/20 border border-white/8 p-3">
                <div className="text-[10px] font-display text-white/40 mb-1">العمولة</div>
                <div className="font-display font-bold text-primary">{fmtCur(detail.earned, "SKZ")}</div>
              </div>
            </div>

            <Label>الإحالات الفرعية</Label>
            <div className="mt-2 space-y-2">
              {detail.children.length === 0 ? (
                <EmptyState icon={Network} text="لا توجد إحالات فرعية" />
              ) : (
                detail.children.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-xl bg-black/20 border border-white/8 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/30 text-accent flex items-center justify-center shrink-0">
                        <UserPlus size={14} />
                      </span>
                      <span className="text-sm font-display font-bold text-white truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-xs font-display text-white/55">{fmt(c.refs)} إحالة</span>
                      <span className="text-xs font-display font-bold text-primary">{fmtCur(c.earned, "SKZ")}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
