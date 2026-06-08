import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ArrowLeft, RefreshCw, CheckCircle } from "lucide-react";
import { notifyEmailLoginSuccess } from "@/lib/telegram-user";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: json as Record<string, unknown> };
}

type Step = "email" | "otp" | "done";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  function startResendTimer() {
    setResendCountdown(60);
    const interval = setInterval(() => {
      setResendCountdown((c) => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) { setError("أدخل بريداً إلكترونياً صحيحاً"); return; }
    setError("");
    setLoading(true);
    const { ok, data } = await apiFetch("/api/user/email/send-otp", { email });
    setLoading(false);
    if (!ok) { setError((data.error as string) ?? "فشل الإرسال"); return; }
    setStep("otp");
    startResendTimer();
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) { setError("أدخل الرمز المكوّن من 6 أرقام"); return; }
    setError("");
    setLoading(true);
    const { ok, data } = await apiFetch("/api/user/email/verify-otp", { email, code });
    setLoading(false);
    if (!ok) { setError((data.error as string) ?? "رمز غير صحيح"); return; }
    setStep("done");
    const user = data.user as Record<string, unknown>;
    const balances = (user?.balances ?? {}) as Record<string, number>;
    notifyEmailLoginSuccess(user, balances.SKZ ?? 0);
  }

  async function handleResend() {
    if (resendCountdown > 0) return;
    setError("");
    setLoading(true);
    const { ok, data } = await apiFetch("/api/user/email/send-otp", { email });
    setLoading(false);
    if (!ok) { setError((data.error as string) ?? "فشل الإرسال"); return; }
    startResendTimer();
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
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(138,80,255,0.15) 0%, transparent 70%)" }}
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
          {step === "email" && (
            <motion.div
              key="email-step"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.22 }}
            >
              <div
                className="rounded-2xl p-6 border"
                style={{ background: "rgba(26,14,58,0.8)", borderColor: "rgba(124,58,237,0.3)", backdropFilter: "blur(12px)" }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(124,58,237,0.2)" }}>
                    <Mail size={20} className="text-purple-400" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-white text-base">تسجيل الدخول</h2>
                    <p className="text-xs text-white/40">سنرسل رمزاً إلى بريدك</p>
                  </div>
                </div>

                <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-display text-white/60 mb-1.5">البريد الإلكتروني</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@gmail.com"
                      dir="ltr"
                      className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none focus:ring-2 transition-all"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(124,58,237,0.25)",
                        fontFamily: "monospace",
                      }}
                      autoComplete="email"
                      required
                    />
                  </div>

                  {error && (
                    <p className="text-xs text-red-400 text-center">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl font-display font-bold text-sm text-black transition-opacity disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #f0d060 0%, #c9a227 100%)" }}
                  >
                    {loading ? "جارٍ الإرسال…" : "إرسال الرمز"}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {step === "otp" && (
            <motion.div
              key="otp-step"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.22 }}
            >
              <div
                className="rounded-2xl p-6 border"
                style={{ background: "rgba(26,14,58,0.8)", borderColor: "rgba(124,58,237,0.3)", backdropFilter: "blur(12px)" }}
              >
                <button
                  onClick={() => { setStep("email"); setCode(""); setError(""); }}
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-5"
                >
                  <ArrowLeft size={14} />
                  تغيير البريد
                </button>

                <div className="mb-5">
                  <h2 className="font-display font-bold text-white text-base">أدخل رمز التحقق</h2>
                  <p className="text-xs text-white/40 mt-1">
                    أُرسل رمز من 6 أرقام إلى
                    <span dir="ltr" className="text-white/60 mx-1 font-mono">{email}</span>
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    dir="ltr"
                    className="w-full px-4 py-4 rounded-xl text-center text-2xl font-mono text-white tracking-[0.4em] placeholder-white/15 outline-none focus:ring-2 transition-all"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(124,58,237,0.25)",
                    }}
                    autoComplete="one-time-code"
                    autoFocus
                  />

                  {error && (
                    <p className="text-xs text-red-400 text-center">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || code.length !== 6}
                    className="w-full py-3 rounded-xl font-display font-bold text-sm text-black transition-opacity disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #f0d060 0%, #c9a227 100%)" }}
                  >
                    {loading ? "جارٍ التحقق…" : "تأكيد"}
                  </button>

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCountdown > 0 || loading}
                    className="flex items-center justify-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
                  >
                    <RefreshCw size={12} />
                    {resendCountdown > 0 ? `إعادة الإرسال بعد ${resendCountdown}s` : "إعادة إرسال الرمز"}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {step === "done" && (
            <motion.div
              key="done-step"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-4 text-center"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}
              >
                <CheckCircle size={32} className="text-green-400" />
              </div>
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
