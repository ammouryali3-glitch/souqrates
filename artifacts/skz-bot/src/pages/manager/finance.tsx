import { useMemo, type ChangeEvent } from "react";
import {
  Wallet, Clock, Flame, ArrowDownToLine, TrendingUp, Check, X,
  CheckCheck, Settings2, Trash2, Coins,
} from "lucide-react";
import { useAdmin, admin } from "../../lib/admin-store";
import { CURRENCIES, type Currency } from "../../lib/admin-types";
import type { Deposit, Withdrawal } from "../../lib/admin-types";
import {
  SectionHeader, StatCard, Card, Table, Th, Td, Pill, Button, Field, Toggle,
  Label, EmptyState, fmt, fmtCur, timeAgo,
} from "./_ui";

function truncate(addr: string, head = 6, tail = 4): string {
  if (!addr) return "—";
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

function wdStatusPill(status: Withdrawal["status"]) {
  switch (status) {
    case "pending":
      return <Pill tone="yellow">قيد الانتظار</Pill>;
    case "approved":
      return <Pill tone="blue">موافق عليه</Pill>;
    case "rejected":
      return <Pill tone="red">مرفوض</Pill>;
    case "completed":
      return <Pill tone="green">مكتمل</Pill>;
  }
}

function depStatusPill(status: Deposit["status"]) {
  return status === "pending"
    ? <Pill tone="yellow">قيد الانتظار</Pill>
    : <Pill tone="green">مؤكد</Pill>;
}

export default function FinanceSection() {
  const { deposits, withdrawals, finance } = useAdmin();

  const pendingCount = useMemo(
    () => withdrawals.filter((w) => w.status === "pending").length,
    [withdrawals],
  );

  const depositsToday = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();
    return deposits
      .filter((d) => d.at >= startMs)
      .reduce((sum, d) => sum + d.amount, 0);
  }, [deposits]);

  const hasPendingAuto = withdrawals.some((w) => w.status === "pending" && w.auto);

  function setNum(patch: (v: number) => Partial<typeof finance>) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      admin.setFinance(patch(Number.isFinite(v) ? v : 0));
    };
  }

  function setPerCur(
    field: "withdrawMin" | "withdrawMax" | "dailyMax" | "gasFee",
    c: Currency,
  ) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      admin.setFinance({ [field]: { ...finance[field], [c]: Number.isFinite(v) ? v : 0 } });
    };
  }

  return (
    <div>
      <SectionHeader
        title="المالية والسحوبات"
        subtitle="إدارة الإيداعات والسحوبات ومحفظة العملات الرقمية"
        icon={Wallet}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="سحوبات قيد الانتظار" value={fmt(pendingCount)} icon={Clock} tone="yellow" />
        <StatCard label="رصيد المحفظة الساخنة" value={fmtCur(finance.hotWalletBalance, "USDT")} icon={Flame} tone="red" />
        <StatCard label="إيداعات اليوم" value={fmt(depositsToday)} icon={ArrowDownToLine} tone="green" />
        <StatCard label="سعر TON" value={`${finance.tonPrice.toFixed(2)} $`} icon={TrendingUp} tone="cyan" />
      </div>

      {/* Withdrawals */}
      <Card
        title="السحوبات"
        icon={ArrowDownToLine}
        className="mb-5"
        action={
          <Button
            variant="green"
            icon={CheckCheck}
            onClick={() => admin.approveAllAutoWithdrawals()}
            disabled={!hasPendingAuto}
            data-testid="button-approve-all-auto"
          >
            موافقة كل التلقائية
          </Button>
        }
      >
        {withdrawals.length === 0 ? (
          <EmptyState icon={ArrowDownToLine} text="لا توجد سحوبات" />
        ) : (
          <Table
            head={
              <>
                <Th>المستخدم</Th>
                <Th>المبلغ</Th>
                <Th>الرسوم</Th>
                <Th>المحفظة</Th>
                <Th>النوع</Th>
                <Th>الحالة</Th>
                <Th>الوقت</Th>
                <Th className="text-left">إجراءات</Th>
              </>
            }
          >
            {withdrawals.map((w) => (
              <tr key={w.id} className="hover:bg-white/3">
                <Td className="text-white font-bold">{w.userName}</Td>
                <Td>{fmtCur(w.amount, w.currency)}</Td>
                <Td className="text-white/50">{fmtCur(w.fee, w.currency)}</Td>
                <Td className="font-mono text-xs text-white/50" >{truncate(w.wallet)}</Td>
                <Td>{w.auto ? <Pill tone="cyan">تلقائي</Pill> : <Pill tone="gray">يدوي</Pill>}</Td>
                <Td>{wdStatusPill(w.status)}</Td>
                <Td className="text-white/50 text-xs">{timeAgo(w.at)}</Td>
                <Td className="text-left">
                  {w.status === "pending" ? (
                    <div className="flex items-center gap-1.5 justify-end">
                      <Button
                        variant="green"
                        icon={Check}
                        onClick={() => admin.setWithdrawalStatus(w.id, "approved")}
                        data-testid={`button-approve-${w.id}`}
                      >
                        موافقة
                      </Button>
                      <Button
                        variant="red"
                        icon={X}
                        onClick={() => admin.setWithdrawalStatus(w.id, "rejected")}
                        data-testid={`button-reject-${w.id}`}
                      >
                        رفض
                      </Button>
                    </div>
                  ) : (
                    <span className="text-white/20 text-xs">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Deposits */}
      <Card title="الإيداعات" icon={Coins} className="mb-5">
        {deposits.length === 0 ? (
          <EmptyState icon={Coins} text="لا توجد إيداعات" />
        ) : (
          <Table
            head={
              <>
                <Th>المستخدم</Th>
                <Th>المبلغ</Th>
                <Th>معرّف العملية</Th>
                <Th>الحالة</Th>
                <Th>الوقت</Th>
                <Th className="text-left">إجراءات</Th>
              </>
            }
          >
            {deposits.map((d) => (
              <tr key={d.id} className="hover:bg-white/3">
                <Td className="text-white font-bold">{d.userName}</Td>
                <Td>{fmtCur(d.amount, d.currency)}</Td>
                <Td className="font-mono text-xs text-white/50">{truncate(d.txHash, 8, 6)}</Td>
                <Td>{depStatusPill(d.status)}</Td>
                <Td className="text-white/50 text-xs">{timeAgo(d.at)}</Td>
                <Td className="text-left">
                  {d.status === "pending" ? (
                    <div className="flex justify-end">
                      <Button
                        variant="green"
                        icon={Check}
                        onClick={() => admin.setDepositStatus(d.id, "confirmed")}
                        data-testid={`button-confirm-${d.id}`}
                      >
                        تأكيد
                      </Button>
                    </div>
                  ) : (
                    <span className="text-white/20 text-xs">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Wallet & limits settings */}
      <Card title="إعدادات المحفظة والحدود" icon={Settings2}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
          <div>
            <Label>حد السحب التلقائي (USDT)</Label>
            <Field
              type="number"
              value={finance.autoWithdrawMax}
              onChange={setNum((v) => ({ autoWithdrawMax: v }))}
              data-testid="input-auto-withdraw-max"
            />
          </div>
          <div>
            <Label>سقف المحفظة الساخنة (USDT)</Label>
            <Field
              type="number"
              value={finance.hotWalletCap}
              onChange={setNum((v) => ({ hotWalletCap: v }))}
              data-testid="input-hot-wallet-cap"
            />
          </div>
          <div>
            <Label>المحفظة الباردة</Label>
            <Field
              type="text"
              value={finance.coldWallet}
              onChange={(e) => admin.setFinance({ coldWallet: e.target.value })}
              data-testid="input-cold-wallet"
            />
          </div>
          <div>
            <Label>هامش سعر الشراء (%)</Label>
            <Field
              type="number"
              value={finance.priceBufferBuy}
              onChange={setNum((v) => ({ priceBufferBuy: v }))}
              data-testid="input-price-buffer-buy"
            />
          </div>
          <div>
            <Label>هامش سعر البيع (%)</Label>
            <Field
              type="number"
              value={finance.priceBufferSell}
              onChange={setNum((v) => ({ priceBufferSell: v }))}
              data-testid="input-price-buffer-sell"
            />
          </div>
          <div className="flex items-end">
            <div className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10">
              <span className="text-xs font-display font-bold text-white/70">التفريغ التلقائي</span>
              <Toggle
                on={finance.autoSweep}
                onClick={() => admin.setFinance({ autoSweep: !finance.autoSweep })}
                testId="toggle-auto-sweep"
              />
            </div>
          </div>
        </div>

        {/* Per-currency limits */}
        <div className="mb-4">
          <div className="text-xs font-display font-bold text-white/45 mb-2">الحدود لكل عملة</div>
          <Table
            head={
              <>
                <Th>العملة</Th>
                <Th>أدنى سحب</Th>
                <Th>أقصى سحب</Th>
                <Th>الحد اليومي</Th>
                <Th>رسوم الغاز</Th>
              </>
            }
          >
            {CURRENCIES.map((c) => (
              <tr key={c}>
                <Td><Pill tone="purple">{c}</Pill></Td>
                <Td>
                  <Field
                    type="number"
                    value={finance.withdrawMin[c]}
                    onChange={setPerCur("withdrawMin", c)}
                    className="w-20 sm:w-28"
                    data-testid={`input-withdraw-min-${c}`}
                  />
                </Td>
                <Td>
                  <Field
                    type="number"
                    value={finance.withdrawMax[c]}
                    onChange={setPerCur("withdrawMax", c)}
                    className="w-20 sm:w-28"
                    data-testid={`input-withdraw-max-${c}`}
                  />
                </Td>
                <Td>
                  <Field
                    type="number"
                    value={finance.dailyMax[c]}
                    onChange={setPerCur("dailyMax", c)}
                    className="w-20 sm:w-28"
                    data-testid={`input-daily-max-${c}`}
                  />
                </Td>
                <Td>
                  <Field
                    type="number"
                    value={finance.gasFee[c]}
                    onChange={setPerCur("gasFee", c)}
                    className="w-20 sm:w-28"
                    data-testid={`input-gas-fee-${c}`}
                  />
                </Td>
              </tr>
            ))}
          </Table>
        </div>

        <div className="flex justify-end">
          <Button
            variant="red"
            icon={Trash2}
            onClick={() => admin.sweepHotWallet()}
            data-testid="button-sweep-hot-wallet"
          >
            تفريغ المحفظة الساخنة
          </Button>
        </div>
      </Card>
    </div>
  );
}
