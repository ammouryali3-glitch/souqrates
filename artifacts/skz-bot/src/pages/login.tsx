import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, ExternalLink, RefreshCw } from "lucide-react";
import { notifyEmailLoginSuccess } from "@/lib/telegram-user";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: { method?: string; body?: unknown }) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts?.method ?? "GET",
    credentials: "include",
    headers: opts?.body ? { "Content-Type": "application/json" } : undefined,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: json as Record<string, unknown> };
}

type Step = "idle" | "waiting" | "done" | "expired";

const TOKEN_TTL_SEC = 5 * 60; // 5 minutes

export default function LoginPage() {
  const [step, setStep] = useState<Step>("idle");
  const [botLink, setBotLink] = useState("");
  const [token, setToken] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(TOKEN_TTL_SEC);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTimers() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  useEffect(() => () => clearTimers(), []);

  async function handleRequest() {
    setLoading(true);
    setError("");
    const { ok, data } = await apiFetch("/api/user/browser-auth/request", { method: "POST" });
    setLoading(false);

    if (!ok || !data.botLink) {
      setError("فشل إنشاء رابط الدخول. حاول مرة أخرى.");
      return;
    }

    setBotLink(data.botLink as string);
    setToken(data.token as string);
    setSecondsLeft(TOKEN_TTL_SEC);
    setStep("waiting");

    // Countdown timer
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearTimers();
          setStep("expired");
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    // Poll for claim every 2s
    pollRef.current = setInterval(async () => {
      const tkn = token || (data.token as string);
      const { ok: pOk, data: pData } = await apiFetch(`/api/user/browser-auth/poll?token=${tkn}`);
      if (!pOk) return;

      if (pData.status === "claimed") {
        clearTimers();
        // Exchange token for session cookie
        const { ok: cOk, data: cData } = await apiFetch("/api/user/browser-auth/claim", {
          method: "POST",
          body: { token: tkn },
        });
        if (!cOk) { setError("حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى."); setStep("idle"); return; }
        setStep("done");
        const user = cData.user as Record<string, unknown>;
        const balances = (user?.balances ?? {}) as Record<string, number>;
        notifyEmailLoginSuccess(user, balances.SKZ ?? 0);
      }

      if (pData.status === "expired") {
        clearTimers();
        setStep("expired");
      }
    }, 2000);
  }

  // token ref so the poll closure always has the latest value
  useEffect(() => {
    if (token && step === "waiting") {
      // Update poll to use latest token (closure capture issue on first render)
    }
  }, [token, step]);

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6"
      style={{
        background: "radial-gradient(ellipse at 50% 30%, #1a0e3a 0%, #0a0614 60%, #050310 100%)",
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(38,117,255,0.12) 0%, transparent 70%)" }}
      />

      <div className="w-full max-w-sm relative z-10" dir="rtl">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/souqrates-logo.png" alt="Souqrates" className="w-20 h-20 object-contain mb-3" />
          <h1
            className="font-display font-black text-xl tracking-widest uppercase"
            style={{
              background: "linear-gradient(135deg, #f0d060 0%, #c9a227 50%, #f0d060 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Souqrates System
          </h1>
        </div>

        <AnimatePresence mode="wait">
          {/* ── IDLE: initial login button ─────────────────────────────── */}
          {step === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.22 }}
            >
              <div
                className="rounded-2xl p-6 border"
                style={{
                  background: "rgba(26,14,58,0.85)",
                  borderColor: "rgba(38,117,255,0.25)",
                  backdropFilter: "blur(14px)",
                }}
              >
                {/* Telegram Icon */}
                <div className="flex flex-col items-center gap-4 mb-6">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(38,117,255,0.15)", border: "1px solid rgba(38,117,255,0.3)" }}
                  >
                    <svg viewBox="0 0 24 24" className="w-9 h-9" fill="#2675ff">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.448 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.83.941z"/>
                    </svg>
                  </div>
                  <div className="text-center">
                    <h2 className="font-display font-bold text-white text-base">تسجيل الدخول</h2>
                    <p className="text-xs text-white/40 mt-1">
                      أدخل عبر حسابك في Telegram — بدون كلمة مرور
                    </p>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-400 text-center mb-4">{error}</p>
                )}

                <button
                  onClick={handleRequest}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl font-display font-bold text-sm text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #2675ff 0%, #1a56cc 100%)" }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>جارٍ التحضير…</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.448 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.83.941z"/>
                      </svg>
                      <span>تسجيل الدخول عبر Telegram</span>
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-white/25 mt-4">
                  مجاني • آمن • فوري
                </p>
              </div>
            </motion.div>
          )}

          {/* ── WAITING: show deep link + pulse ───────────────────────── */}
          {step === "waiting" && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.22 }}
            >
              <div
                className="rounded-2xl p-6 border"
                style={{
                  background: "rgba(26,14,58,0.85)",
                  borderColor: "rgba(38,117,255,0.3)",
                  backdropFilter: "blur(14px)",
                }}
              >
                {/* Animated waiting indicator */}
                <div className="flex flex-col items-center gap-3 mb-6">
                  <div className="relative">
                    <motion.div
                      className="w-16 h-16 rounded-full border-2"
                      style={{ borderColor: "rgba(38,117,255,0.3)" }}
                      animate={{ scale: [1, 1.15, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#2675ff">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.448 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.83.941z"/>
                      </svg>
                    </div>
                  </div>
                  <div className="text-center">
                    <h2 className="font-display font-bold text-white text-base">في انتظار تأكيدك</h2>
                    <p className="text-xs text-white/50 mt-1">افتح Telegram وأكّد تسجيل الدخول</p>
                  </div>
                </div>

                {/* Deep link button */}
                <a
                  href={botLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-display font-bold text-sm text-white mb-4 transition-opacity active:opacity-80"
                  style={{ background: "linear-gradient(135deg, #2675ff 0%, #1a56cc 100%)" }}
                >
                  <ExternalLink size={15} />
                  <span>افتح بوت Telegram</span>
                </a>

                {/* Countdown */}
                <div className="flex items-center justify-between text-xs text-white/30 mb-4">
                  <span>ينتهي الرمز خلال</span>
                  <span
                    className="font-mono font-bold"
                    style={{ color: secondsLeft < 60 ? "#f87171" : "rgba(255,255,255,0.5)" }}
                  >
                    {formatTime(secondsLeft)}
                  </span>
                </div>

                {/* Animated dots */}
                <div className="flex items-center justify-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-blue-400"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                    />
                  ))}
                  <span className="text-xs text-white/30 mr-2">في انتظار التأكيد…</span>
                </div>

                {/* Cancel */}
                <button
                  onClick={() => { clearTimers(); setStep("idle"); setError(""); }}
                  className="w-full text-center text-xs text-white/25 hover:text-white/50 transition-colors mt-4"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          )}

          {/* ── EXPIRED ───────────────────────────────────────────────── */}
          {step === "expired" && (
            <motion.div
              key="expired"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.22 }}
            >
              <div
                className="rounded-2xl p-6 border flex flex-col items-center gap-4 text-center"
                style={{
                  background: "rgba(26,14,58,0.85)",
                  borderColor: "rgba(239,68,68,0.25)",
                  backdropFilter: "blur(14px)",
                }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
                >
                  <RefreshCw size={26} className="text-red-400" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-white text-base">انتهت صلاحية الرمز</h2>
                  <p className="text-xs text-white/40 mt-1">الرمز صالح لـ 5 دقائق فقط</p>
                </div>
                <button
                  onClick={() => { setStep("idle"); setError(""); }}
                  className="w-full py-3 rounded-xl font-display font-bold text-sm text-white transition-opacity"
                  style={{ background: "linear-gradient(135deg, #2675ff 0%, #1a56cc 100%)" }}
                >
                  طلب رمز جديد
                </button>
              </div>
            </motion.div>
          )}

          {/* ── DONE ──────────────────────────────────────────────────── */}
          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-4 text-center"
            >
              <motion.div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <CheckCircle size={32} className="text-green-400" />
              </motion.div>
              <div>
                <h2 className="font-display font-bold text-white text-lg">تم تسجيل الدخول!</h2>
                <p className="text-xs text-white/40 mt-1">جارٍ تحميل حسابك…</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
