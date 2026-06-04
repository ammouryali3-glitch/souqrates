import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Copy, History, Wallet as WalletIcon, CheckCircle2 } from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const transactions = [
  { id: 1, type: "deposit", asset: "USDT", amount: "+500.00", status: "completed", time: "Today, 14:30" },
  { id: 2, type: "withdraw", asset: "SKZ", amount: "-10,000", status: "pending", time: "Yesterday, 09:15" },
  { id: 3, type: "deposit", asset: "TON", amount: "+25.50", status: "completed", time: "Oct 12, 18:45" },
  { id: 4, type: "win", asset: "SKZ", amount: "+2,500", status: "completed", time: "Oct 10, 22:10" },
];

export default function Wallet() {
  const [balance] = useState(12450.75);
  const usdtValue = balance * 0.1; // Mock conversion rate
  const tonValue = balance * 0.05; 
  
  const [copied, setCopied] = useState(false);
  
  const copyAddress = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-display font-bold text-white tracking-wider uppercase">Vault</h1>
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
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Available SKZ</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-display font-bold text-white tracking-tight drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">
              <NumberTicker value={balance} decimals={2} />
            </span>
          </div>
          
          <div className="flex gap-4 mt-4 pt-4 border-t border-white/10">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground">≈ USDT</span>
              <span className="text-sm font-display font-medium text-white/90">${usdtValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground">≈ TON</span>
              <span className="text-sm font-display font-medium text-white/90">{tonValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Action Tabs */}
      <Tabs defaultValue="deposit" className="w-full">
        <TabsList className="w-full grid grid-cols-2 bg-card/40 border border-white/5 p-1 rounded-xl h-12">
          <TabsTrigger value="deposit" className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white">Deposit</TabsTrigger>
          <TabsTrigger value="withdraw" className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white">Withdraw</TabsTrigger>
        </TabsList>
        
        <TabsContent value="deposit" className="mt-4 flex flex-col gap-4">
          <div className="bg-card/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex gap-2">
              <div className="bg-primary/20 text-primary border border-primary/30 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer">USDT (TRC20)</div>
              <div className="bg-card border border-white/10 text-muted-foreground px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer hover:bg-white/5">TON</div>
            </div>
            
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Your Deposit Address</Label>
              <div className="flex items-center gap-2 bg-black/40 border border-white/10 p-3 rounded-xl">
                <span className="text-xs text-white/80 font-mono truncate flex-1">TY3x...9pL1</span>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={copyAddress}>
                  {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                </Button>
              </div>
            </div>
            
            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl">
              <p className="text-[11px] text-blue-200/80 leading-relaxed">
                Send only USDT over TRON (TRC20) network to this address. Other assets will be lost. Minimum deposit: 10 USDT.
              </p>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="withdraw" className="mt-4 flex flex-col gap-4">
          <div className="bg-card/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <Label className="text-xs text-muted-foreground">Amount (SKZ)</Label>
                <span className="text-xs text-primary font-medium cursor-pointer">Max</span>
              </div>
              <Input type="number" placeholder="0.00" className="bg-black/40 border-white/10 text-lg rounded-xl h-12" />
            </div>
            
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Destination Wallet (USDT TRC20)</Label>
              <Input placeholder="T..." className="bg-black/40 border-white/10 rounded-xl h-12 font-mono text-sm" />
            </div>
            
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl h-12 mt-2">
              Confirm Withdrawal
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* History */}
      <div className="flex flex-col gap-3 mt-2">
        <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2">
          <History size={16} className="text-muted-foreground" />
          Recent Transactions
        </h3>
        
        <div className="flex flex-col gap-2">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-card/30 border border-white/5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  tx.type === 'deposit' || tx.type === 'win' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {tx.type === 'deposit' || tx.type === 'win' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white capitalize">{tx.type} {tx.asset}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{tx.time}</span>
                    {tx.status === 'pending' && (
                      <span className="text-[9px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded uppercase font-bold">Pending</span>
                    )}
                  </div>
                </div>
              </div>
              <span className={`text-sm font-bold ${tx.amount.startsWith('+') ? 'text-green-400' : 'text-foreground'}`}>
                {tx.amount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
