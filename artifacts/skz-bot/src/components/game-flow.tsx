import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Coins, Trophy, ShieldCheck } from "lucide-react";
import { getLang, t as gt } from "@/lib/i18n";
import { hapticSuccess, hapticImpact } from "@/lib/haptics";
import { sfx } from "@/lib/sound";

export interface GameTicket {
  price: number;
  prize: number;
}

// ─────────────────────────────────────────────────────────
// Pay Confirm Modal
// ─────────────────────────────────────────────────────────
function PayConfirmModal({
  ticket,
  onConfirm,
  onCancel,
}: {
  ticket: GameTicket;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const l = getLang();
  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(10px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-[340px] rounded-3xl p-6 flex flex-col gap-5"
        style={{
          background: "linear-gradient(145deg, #0d1b2e 0%, #091422 100%)",
          border: "1.5px solid rgba(212,175,55,0.35)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7), 0 0 40px rgba(212,175,55,0.08)",
        }}
        initial={{ y: 60, opacity: 0, scale: 0.92 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.94 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
      >
        {/* Icon + Title */}
        <div className="flex flex-col items-center gap-2 text-center">
          <motion.div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-1"
            style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))", border: "1.5px solid rgba(212,175,55,0.3)" }}
            initial={{ scale: 0.7 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 22, delay: 0.1 }}
          >
            <ShieldCheck size={27} className="text-amber-400" />
          </motion.div>
          <h2 className="font-display font-black text-xl text-white tracking-wider">
            {gt[l].gameConfirmTitle}
          </h2>
        </div>

        {/* Info rows */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Coins size={14} className="text-amber-400 shrink-0" />
              <span className="text-xs text-white/55 font-medium">{gt[l].arenaEntryFee}</span>
            </div>
            <span className="font-display font-bold text-amber-300 text-base">
              {ticket.price.toLocaleString()} SKZ
            </span>
          </div>
          <div
            className="flex items-center justify-between px-4 py-3 rounded-2xl"
            style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.18)" }}
          >
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-emerald-400 shrink-0" />
              <span className="text-xs text-white/55 font-medium">
                {l === "ar" ? "مكافأة الفوز" : "Prize if you win"}
              </span>
            </div>
            <span className="font-display font-bold text-emerald-300 text-base">
              +{ticket.prize.toLocaleString()} SKZ
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onConfirm}
            className="w-full py-3.5 rounded-2xl font-display font-black tracking-widest text-[#0a0800] text-sm active:scale-[0.97] transition-transform"
            style={{ background: "linear-gradient(135deg, #c9a227, #f0d060, #c9a227)", boxShadow: "0 4px 20px rgba(212,175,55,0.35)" }}
          >
            {gt[l].gameConfirmPlay}
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2.5 rounded-2xl font-display font-bold text-white/40 text-sm border border-white/[0.08] bg-white/[0.03] active:scale-[0.97] transition-transform"
          >
            {gt[l].gameConfirmCancel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Processing Overlay (~1.3 s)
// ─────────────────────────────────────────────────────────
function ProcessingOverlay() {
  const l = getLang();
  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-7"
      style={{ background: "rgba(4,8,18,0.96)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Pulsing rings + icon */}
      <div className="relative flex items-center justify-center">
        {[100, 72].map((size, i) => (
          <motion.div
            key={size}
            className="absolute rounded-full"
            style={{ width: size, height: size, border: `2px solid rgba(212,175,55,${i === 0 ? 0.18 : 0.28})` }}
            animate={{ scale: [1, 1.45, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.22 }}
          />
        ))}
        <motion.div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #c9a227, #f0d060)", boxShadow: "0 0 30px rgba(212,175,55,0.4)" }}
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Coins size={26} className="text-[#0a0800]" />
        </motion.div>
      </div>

      {/* Text */}
      <div className="text-center">
        <motion.div
          className="font-display font-black text-white text-base tracking-wider mb-1"
          animate={{ opacity: [1, 0.6, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          {gt[l].gameProcessingTitle}
        </motion.div>
        <div className="text-white/35 text-xs">{gt[l].gameProcessingSub}</div>
      </div>

      {/* Progress bar */}
      <div className="w-44 h-[3px] rounded-full bg-white/8 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(to right, #c9a227, #f0d060)" }}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 1.15, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Exit Confirm Modal
// ─────────────────────────────────────────────────────────
function ExitConfirmModal({
  price,
  onConfirm,
  onCancel,
}: {
  price: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const l = getLang();
  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-[340px] rounded-3xl p-6 flex flex-col gap-5"
        style={{
          background: "linear-gradient(145deg, #1a0808 0%, #120404 100%)",
          border: "1.5px solid rgba(239,68,68,0.3)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7), 0 0 40px rgba(239,68,68,0.06)",
        }}
        initial={{ y: 60, opacity: 0, scale: 0.92 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.94 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
      >
        {/* Icon + Title */}
        <div className="flex flex-col items-center gap-2 text-center">
          <motion.div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-1"
            style={{ background: "rgba(239,68,68,0.1)", border: "1.5px solid rgba(239,68,68,0.25)" }}
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <AlertTriangle size={27} className="text-red-400" />
          </motion.div>
          <h2 className="font-display font-black text-xl text-white tracking-wider">
            {gt[l].gameExitTitle}
          </h2>
          <p className="text-white/45 text-xs leading-relaxed max-w-[220px]">
            {gt[l].gameExitBody(price)}
          </p>
        </div>

        {/* Buttons — keep playing is primary gold, exit is danger */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onCancel}
            className="w-full py-3.5 rounded-2xl font-display font-black tracking-widest text-[#0a0800] text-sm active:scale-[0.97] transition-transform"
            style={{ background: "linear-gradient(135deg, #c9a227, #f0d060, #c9a227)", boxShadow: "0 4px 20px rgba(212,175,55,0.3)" }}
          >
            {gt[l].gameExitCancel}
          </button>
          <button
            onClick={onConfirm}
            className="w-full py-2.5 rounded-2xl font-display font-bold text-red-400/80 text-sm border border-red-500/20 bg-red-500/[0.04] active:scale-[0.97] transition-transform"
          >
            {gt[l].gameExitConfirm}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Win Toast (slides from top, auto-dismiss)
// ─────────────────────────────────────────────────────────
function WinToast({ prize }: { prize: number }) {
  const l = getLang();
  return (
    <motion.div
      className="absolute top-4 inset-x-4 z-[60] rounded-2xl px-4 py-3.5 flex items-center gap-3"
      style={{
        background: "linear-gradient(135deg, #1c1400 0%, #2a1e00 50%, #1c1400 100%)",
        border: "1.5px solid rgba(212,175,55,0.45)",
        boxShadow: "0 8px 40px rgba(212,175,55,0.3), 0 2px 8px rgba(0,0,0,0.5)",
      }}
      initial={{ y: -90, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -90, opacity: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 34 }}
    >
      <motion.div
        className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #c9a227, #f0d060)", boxShadow: "0 2px 12px rgba(212,175,55,0.4)" }}
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 0.6, repeat: 2 }}
      >
        <Trophy size={20} className="text-[#0a0800]" />
      </motion.div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-black text-amber-300 text-sm tracking-wide leading-tight">
          {gt[l].gameWinCreditTitle}
        </div>
        <div className="text-amber-200/55 text-xs mt-0.5">
          {gt[l].gameWinCreditBody(prize)}
        </div>
      </div>
      <motion.div
        className="font-display font-black shrink-0"
        style={{ fontSize: "1.1rem", color: "#f0d060" }}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 500, damping: 20 }}
      >
        +{prize.toLocaleString()}
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Main hook
// ─────────────────────────────────────────────────────────
export function useGameFlow({
  ticket,
  onConfirmedEntry,
}: {
  ticket: GameTicket | null;
  onConfirmedEntry: (ticket: GameTicket) => void;
}) {
  const [, navigate] = useLocation();

  const [showPay, setShowPay] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [pendingTicket, setPendingTicket] = useState<GameTicket | null>(null);
  const [winPrize, setWinPrize] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryRef = useRef(onConfirmedEntry);
  entryRef.current = onConfirmedEntry;
  const ticketRef = useRef(ticket);
  ticketRef.current = ticket;

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const requestEntry = useCallback((tk: GameTicket) => {
    if (!tk.price) {
      setShowProcessing(true);
      timerRef.current = setTimeout(() => {
        setShowProcessing(false);
        entryRef.current(tk);
      }, 800);
      return;
    }
    setPendingTicket(tk);
    setShowPay(true);
  }, []);

  const handleConfirmPay = useCallback(() => {
    const tk = pendingTicket;
    hapticImpact("medium");
    sfx.coin();
    setShowPay(false);
    setShowProcessing(true);
    timerRef.current = setTimeout(() => {
      setShowProcessing(false);
      if (tk) entryRef.current(tk);
    }, 1350);
  }, [pendingTicket]);

  const handleCancelPay = useCallback(() => {
    setShowPay(false);
    setPendingTicket(null);
  }, []);

  const requestExit = useCallback(() => {
    if (!ticketRef.current?.price) { navigate("/games"); return; }
    setShowExit(true);
  }, [navigate]);

  const handleConfirmExit = useCallback(() => {
    setShowExit(false);
    navigate("/games");
  }, [navigate]);

  const handleCancelExit = useCallback(() => setShowExit(false), []);

  const notifyWin = useCallback((prize: number) => {
    setWinPrize(prize);
    setShowWin(true);
    hapticSuccess();
    sfx.win();
    timerRef.current = setTimeout(() => setShowWin(false), 3800);
  }, []);

  const overlays = (
    <>
      <AnimatePresence>
        {showPay && pendingTicket && (
          <PayConfirmModal
            key="pay"
            ticket={pendingTicket}
            onConfirm={handleConfirmPay}
            onCancel={handleCancelPay}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showProcessing && <ProcessingOverlay key="proc" />}
      </AnimatePresence>
      <AnimatePresence>
        {showExit && ticketRef.current && (
          <ExitConfirmModal
            key="exit"
            price={ticketRef.current.price}
            onConfirm={handleConfirmExit}
            onCancel={handleCancelExit}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showWin && <WinToast key="win" prize={winPrize} />}
      </AnimatePresence>
    </>
  );

  return { requestEntry, requestExit, notifyWin, overlays };
}
