import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Copy, History, Wallet as WalletIcon, CheckCircle2 } from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBalance } from "@/lib/admin-store";
import { useLang, t } from "@/lib/i18n";

export default function Wallet() {
  const skzBalance = useBalance();
  const lang = useLang();
  const s = t[lang];
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            <span className="text-4xl font-display font-bold text-white tracking-tight drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">
              <NumberTicker value={skzBalance} decimals={0} />
            </span>
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

        <TabsContent value="deposit" className="mt-4 flex flex-col gap-4">
          <div className="bg-card/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex gap-2">
              <div className="bg-primary/20 text-primary border border-primary/30 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer">USDT (TRC20)</div>
              <div className="bg-card border border-white/10 text-muted-foreground px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer hover:bg-white/5">TON</div>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">{s.depositAddress}</Label>
              <div className="flex items-center gap-2 bg-black/40 border border-white/10 p-3 rounded-xl">
                <span className="text-xs text-white/80 font-mono truncate flex-1">—</span>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={copyAddress}>
                  {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                </Button>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl">
              <p className="text-[11px] text-blue-200/80 leading-relaxed">{s.depositNote}</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="withdraw" className="mt-4 flex flex-col gap-4">
          <div className="bg-card/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <Label className="text-xs text-muted-foreground">{s.amount}</Label>
                <span className="text-xs text-primary font-medium cursor-pointer">{s.maxBtn}</span>
              </div>
              <Input type="number" placeholder="0.00" className="bg-black/40 border-white/10 text-lg rounded-xl h-12" />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">{s.destWallet}</Label>
              <Input placeholder="T..." className="bg-black/40 border-white/10 rounded-xl h-12 font-mono text-sm" />
            </div>

            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl h-12 mt-2">
              {s.confirmWithdraw}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Transaction History — empty until real backend events */}
      <div className="flex flex-col gap-3 mt-2">
        <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2">
          <History size={16} className="text-muted-foreground" />
          {s.recentTxs}
        </h3>

        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50 gap-2">
          <ArrowDownLeft size={28} className="opacity-30" />
          <span className="text-xs">{s.noTxs}</span>
        </div>
      </div>
    </div>
  );
}
