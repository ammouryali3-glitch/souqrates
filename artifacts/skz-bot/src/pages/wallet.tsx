import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownLeft, ArrowUpRight, Copy, History, Wallet as WalletIcon,
  CheckCircle2, AlertCircle, Loader2, RefreshCw, Info, Star,
} from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBalance, writeBalance } from "@/lib/admin-store";
import { useLang, t, type Strings } from "@/lib/i18n";
import {
  fetchUserWallet, submitWithdrawal, fetchWithdrawalConfig,
  fetchStarsPackages, createStarsInvoice,
  type WalletData, type WithdrawalConfig, type StarsPackage,
} from "@/lib/user-api";
import { useTelegramUser } from "@/lib/telegram-user";

// ── Types ────────────────────────────────────────────────────────────────────

interface DepositRecord {
  id: string;
  currency: "TON";
  amount: number;
  skzCredited?: number;
  status: "pending" | "confirmed";
  txHash?: string;
  at: number;
}

interface WithdrawalRecord {
  id: string;
  currency: "TON";
  amount: number;
  status: "pending" | "approved" | "rejected" | "completed";
  wallet: string;
  at: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ms: number, s: Strings): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return s.timeAgoNow;
  if (diff < 3600_000) return s.timeAgoMinutes(Math.floor(diff / 60_000));
  if (diff < 86_400_000) return s.timeAgoHours(Math.floor(diff / 3600_000));
  return s.timeAgoDays(Math.floor(diff / 86_400_000));
}

function depStatusLabel(status: DepositRecord["status"], s: Strings): string {
  return status === "confirmed" ? s.depStatusConfirmed : s.depStatusPending;
}

function wdStatusLabel(status: WithdrawalRecord["status"], s: Strings): string {
  switch (status) {
    case "pending": return s.wdStatusPending;
    case "approved": return s.wdStatusApproved;
    case "rejected": return s.wdStatusRejected;
    case "completed": return s.wdStatusCompleted;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "confirmed": case "completed": case "approved": return "text-green-400";
    case "rejected": return "text-red-400";
    default: return "text-yellow-400";
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Wallet() {
  const skzBalance = useBalance();
  const { loading: balanceLoading } = useTelegramUser();
  const lang = useLang();
  const s = t[lang];

  const [copied, setCopied] = useState<"address" | "memo" | null>(null);

  // Wallet data from server
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);

  // Withdrawal config
  const [wdConfig, setWdConfig] = useState<WithdrawalConfig>({ minSkz: 100, maxSkz: 50000, skzPerTon: 100 });

  // Withdrawal form
  const [wdAmount, setWdAmount] = useState("");
  const [wdAddress, setWdAddress] = useState("");
  const [wdLoading, setWdLoading] = useState(false);
  const [wdError, setWdError] = useState("");
  const [wdSuccess, setWdSuccess] = useState(false);

  // Deposit method selector
  const [depositMethod, setDepositMethod] = useState<"ton" | "stars">("ton");

  // Stars packages
  const [starsPackages, setStarsPackages] = useState<StarsPackage[]>([]);
  const [starsLoading, setStarsLoading] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [starsError, setStarsError] = useState("");
  const [starsSuccess, setStarsSuccess] = useState(false);

  const loadWallet = useCallback(async () => {
    setLoadingWallet(true);
    try {
      const data = await fetchUserWallet();
      if (data) setWalletData(data);
    } finally {
      setLoadingWallet(false);
    }
  }, []);

  useEffect(() => {
    loadWallet();
    fetchWithdrawalConfig().then(setWdConfig);
  }, [loadWallet]);

  useEffect(() => {
    if (depositMethod === "stars" && starsPackages.length === 0) {
      setStarsLoading(true);
      fetchStarsPackages().then((pkgs) => {
        setStarsPackages(pkgs);
      }).finally(() => setStarsLoading(false));
    }
  }, [depositMethod, starsPackages.length]);

  const copyText = (text: string, key: "address" | "memo") => {
    if (!text) return;
    try { navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  async function handleStarsBuy(packageId: string) {
    setBuyingId(packageId);
    setStarsError("");
    setStarsSuccess(false);
    try {
      const result = await createStarsInvoice(packageId);
      if (result.error || !result.url) {
        setStarsError(result.error ?? "Failed to create invoice");
        return;
      }
      const tgApp = (window as Window & { Telegram?: { WebApp?: { openInvoice?: (url: string, cb: (status: string) => void) => void } } }).Telegram?.WebApp;
      if (tgApp?.openInvoice) {
        tgApp.openInvoice(result.url, (status) => {
          if (status === "paid") {
            setStarsSuccess(true);
            setTimeout(() => {
              setStarsSuccess(false);
              loadWallet();
            }, 3000);
          }
        });
      } else {
        window.open(result.url, "_blank");
      }
    } finally {
      setBuyingId(null);
    }
  }

  const depositAddress = walletData?.tonDepositWallet ?? "";
  const hasDepositWallet = !!depositAddress;
  const depositRate = walletData?.depositRate ?? 100;

  async function handleWithdraw() {
    const amount = parseFloat(wdAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setWdError(s.errInvalidAmount);
      return;
    }
    if (!wdAddress.trim()) {
      setWdError(s.errNoAddress);
      return;
    }
    if (amount > skzBalance) {
      setWdError(s.errInsufficientBalance);
      return;
    }

    setWdLoading(true);
    setWdError("");
    try {
      const result = await submitWithdrawal(amount, wdAddress.trim(), "TON");
      if (result.ok) {
        setWdSuccess(true);
        setWdAmount("");
        setWdAddress("");
        // Only update local balance from the server-confirmed value.
        // Never compute a client-side fallback — if server didn't return newSkz,
        // the next balance sync will reconcile it.
        if (result.newSkz != null) writeBalance(result.newSkz);
        setTimeout(() => {
          setWdSuccess(false);
          loadWallet();
        }, 3000);
      } else {
        setWdError(result.error ?? s.errWithdrawFail);
      }
    } catch {
      setWdError(s.errConnection);
    } finally {
      setWdLoading(false);
    }
  }

  const allTxs: Array<{ type: "deposit" | "withdraw"; at: number; label: string; amount: string; status: string }> = [
    ...(walletData?.deposits ?? []).map((d: DepositRecord) => ({
      type: "deposit" as const,
      at: d.at,
      label: `${s.depositTypeLabel} ${d.currency}`,
      amount: `+${d.skzCredited ?? 0} SKZ`,
      status: depStatusLabel(d.status, s),
    })),
    ...(walletData?.withdrawals ?? []).map((w: WithdrawalRecord) => ({
      type: "withdraw" as const,
      at: w.at,
      label: `${s.withdrawTypeLabel} ${w.currency}`,
      amount: `-${w.amount} SKZ`,
      status: wdStatusLabel(w.status, s),
    })),
  ].sort((a, b) => b.at - a.at).slice(0, 20);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-display font-bold text-white tracking-wider uppercase">{s.vaultTitle}</h1>
      </div>

      {/* Hero Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-gradient-to-br from-primary/20 via-card to-card border border-primary/20 rounded-3xl p-6 overflow-hidden"
      >
        <div className="absolute -right-10 -top-10 text-primary/10">
          <WalletIcon size={120} />
        </div>
        <div className="relative z-10 flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">{s.availableSkz}</span>
          <div className="flex items-baseline gap-2 mt-1">
            {balanceLoading ? (
              <div className="h-10 w-32 rounded-xl bg-white/10 animate-pulse" />
            ) : (
              <span className="text-4xl font-display font-bold text-white tracking-tight drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">
                <NumberTicker value={skzBalance} decimals={0} />
              </span>
            )}
            <span className="text-lg font-display font-black text-primary tracking-widest">SKZ</span>
          </div>
        </div>
      </motion.div>

      {/* Action Tabs */}
      <Tabs defaultValue="deposit" className="w-full">
        <TabsList className="w-full grid grid-cols-2 bg-card/40 border border-white/5 p-1 rounded-xl h-12">
          <TabsTrigger value="deposit" className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white">{s.deposit}</TabsTrigger>
          <TabsTrigger value="withdraw" className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white">{s.withdraw}</TabsTrigger>
        </TabsList>

        {/* ── Deposit Tab ── */}
        <TabsContent value="deposit" className="mt-4 flex flex-col gap-4">

          {/* Deposit method selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setDepositMethod("ton")}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                depositMethod === "ton"
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"
              }`}
            >
              TON
            </button>
            <button
              onClick={() => setDepositMethod("stars")}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                depositMethod === "stars"
                  ? "bg-amber-400/15 text-amber-300 border-amber-400/30"
                  : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"
              }`}
            >
              <Star size={12} />
              {s.starsDepositTitle}
            </button>
          </div>

          {/* ── TON Deposit ── */}
          {depositMethod === "ton" && (
            <div className="bg-card/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-4">
              {/* Rate badge */}
              <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                <span className="bg-white/5 px-2 py-1 rounded-lg text-green-300/80">
                  {s.depositRate(depositRate)}
                </span>
              </div>

              {/* Deposit address */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">{s.depositAddress}</Label>
                <div className="flex items-center gap-2 bg-black/40 border border-white/10 p-3 rounded-xl">
                  {loadingWallet && <Loader2 size={14} className="animate-spin text-muted-foreground shrink-0" />}
                  <span className="text-xs text-white/80 font-mono truncate flex-1">
                    {loadingWallet ? "..." : (depositAddress || "—")}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-primary shrink-0"
                    onClick={() => copyText(depositAddress, "address")}
                    disabled={!hasDepositWallet}
                  >
                    {copied === "address" ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                  </Button>
                </div>
              </div>

              {/* Deposit memo (user's tgId) */}
              {walletData?.depositMemo && (
                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info size={12} />
                    {s.depositMemoLabel}
                  </Label>
                  <div className="flex items-center gap-2 bg-black/40 border border-amber-500/20 p-3 rounded-xl">
                    <span className="text-xs text-amber-300 font-mono flex-1 font-bold">{walletData.depositMemo}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-amber-400 shrink-0"
                      onClick={() => copyText(walletData!.depositMemo, "memo")}
                    >
                      {copied === "memo" ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-amber-300/70 leading-relaxed">
                    {s.depositMemoNote}
                  </p>
                </div>
              )}

              {/* Info note */}
              <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl">
                <p className="text-[11px] text-blue-200/80 leading-relaxed">{s.depositNoteText}</p>
              </div>

              {!hasDepositWallet && !loadingWallet && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl">
                  <p className="text-[11px] text-yellow-200/80 leading-relaxed">{s.walletNotActive}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Stars Deposit ── */}
          {depositMethod === "stars" && (
            <div className="bg-card/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-4">
              <div className="bg-amber-400/10 border border-amber-400/20 p-3 rounded-xl">
                <p className="text-[11px] text-amber-200/80 leading-relaxed">{s.starsDepositNote}</p>
              </div>

              {starsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={24} className="animate-spin text-muted-foreground" />
                </div>
              ) : starsPackages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground/50">
                  <Star size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">{s.noStarsPackages}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {starsPackages.map((pkg) => (
                    <motion.div
                      key={pkg.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative bg-gradient-to-br from-amber-400/10 to-black/30 border border-amber-400/20 rounded-2xl p-3 flex flex-col gap-2"
                    >
                      {pkg.bonus > 0 && (
                        <span className="absolute -top-2 -right-1 text-[9px] font-bold bg-green-500 text-black px-1.5 py-0.5 rounded-full">
                          +{pkg.bonus.toLocaleString()} BONUS
                        </span>
                      )}
                      <div className="text-sm font-display font-black text-white leading-tight">
                        {s.starsPackageLabel(pkg.skz, pkg.bonus)}
                      </div>
                      <div className="text-amber-300 text-xs font-bold">{s.starsCount(pkg.price)}</div>
                      <Button
                        className="w-full h-8 text-xs font-bold bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-400/30 rounded-xl mt-1"
                        onClick={() => handleStarsBuy(pkg.id)}
                        disabled={buyingId === pkg.id}
                      >
                        {buyingId === pkg.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : <>{s.buyStars} ⭐</>
                        }
                      </Button>
                    </motion.div>
                  ))}
                </div>
              )}

              {starsError && (
                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                  <AlertCircle size={14} />
                  {starsError}
                </div>
              )}
              {starsSuccess && (
                <div className="flex items-center gap-2 text-green-400 text-xs bg-green-500/10 border border-green-500/20 p-3 rounded-xl">
                  <CheckCircle2 size={14} />
                  تمت عملية الشراء بنجاح — جارٍ تحديث رصيدك...
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── Withdraw Tab ── */}
        <TabsContent value="withdraw" className="mt-4 flex flex-col gap-4">
          <div className="bg-card/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-4">

            {/* Network badge */}
            <div className="flex gap-2">
              <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/20 text-primary border border-primary/30">
                TON
              </span>
            </div>

            {/* Exchange rate info */}
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              <span className="bg-white/5 px-2 py-1 rounded-lg">{s.withdrawRate(wdConfig.skzPerTon)}</span>
              <span className="bg-white/5 px-2 py-1 rounded-lg">{s.withdrawMin(wdConfig.minSkz)}</span>
              <span className="bg-white/5 px-2 py-1 rounded-lg">{s.withdrawMax(wdConfig.maxSkz)}</span>
            </div>

            {/* SKZ Amount */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <Label className="text-xs text-muted-foreground">{s.amount}</Label>
                <button
                  className="text-xs text-primary font-medium"
                  onClick={() => setWdAmount(String(Math.min(skzBalance, wdConfig.maxSkz)))}
                >
                  {s.maxBtn}
                </button>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0"
                  value={wdAmount}
                  onChange={(e) => setWdAmount(e.target.value)}
                  className="bg-black/40 border-white/10 text-lg rounded-xl h-12 pr-24"
                />
                {wdAmount && Number(wdAmount) > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                    {s.withdrawTonEstimate(+(Number(wdAmount) / wdConfig.skzPerTon).toFixed(4))}
                  </span>
                )}
              </div>
            </div>

            {/* Destination wallet */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">{s.destWallet}</Label>
              <Input
                placeholder="EQ..."
                value={wdAddress}
                onChange={(e) => setWdAddress(e.target.value)}
                className="bg-black/40 border-white/10 rounded-xl h-12 font-mono text-sm"
              />
            </div>

            {/* Error / success */}
            {wdError && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                <AlertCircle size={14} />
                {wdError}
              </div>
            )}
            {wdSuccess && (
              <div className="flex items-center gap-2 text-green-400 text-xs bg-green-500/10 border border-green-500/20 p-3 rounded-xl">
                <CheckCircle2 size={14} />
                {s.withdrawSuccess}
              </div>
            )}

            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl h-12 mt-2"
              onClick={handleWithdraw}
              disabled={wdLoading || wdSuccess || balanceLoading}
            >
              {wdLoading ? <Loader2 size={16} className="animate-spin" /> : s.confirmWithdraw}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Transaction History */}
      <div className="flex flex-col gap-3 mt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2">
            <History size={16} className="text-muted-foreground" />
            {s.recentTxs}
          </h3>
          <button
            onClick={loadWallet}
            disabled={loadingWallet}
            className="text-muted-foreground hover:text-white transition-colors"
          >
            <RefreshCw size={14} className={loadingWallet ? "animate-spin" : ""} />
          </button>
        </div>

        {allTxs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50 gap-2">
            <ArrowDownLeft size={28} className="opacity-30" />
            <span className="text-xs">{s.noTxs}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {allTxs.map((tx, i) => (
              <motion.div
                key={`${tx.type}-${tx.at}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 bg-card/30 border border-white/5 rounded-xl p-3"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  tx.type === "deposit" ? "bg-green-500/15" : "bg-red-500/15"
                }`}>
                  {tx.type === "deposit"
                    ? <ArrowDownLeft size={14} className="text-green-400" />
                    : <ArrowUpRight size={14} className="text-red-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{tx.label}</div>
                  <div className={`text-[10px] mt-0.5 ${statusColor(tx.status.toLowerCase())}`}>
                    {tx.status} · {timeAgo(tx.at, s)}
                  </div>
                </div>
                <span className={`text-sm font-bold font-mono ${
                  tx.type === "deposit" ? "text-green-400" : "text-red-400"
                }`}>
                  {tx.amount}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
