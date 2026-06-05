import { useState } from "react";
import { ShieldCheck, Eye, EyeOff, LogIn } from "lucide-react";
import { motion } from "framer-motion";
import { loginAdmin } from "../../lib/admin-auth";
import type { AdminSessionInfo } from "../../lib/admin-auth";

interface Props {
  onSuccess: (session: AdminSessionInfo) => void;
}

export default function AdminLogin({ onSuccess }: Props) {
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await loginAdmin(handle, password);
      onSuccess(session);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "المعرّف أو كلمة المرور غير صحيحة.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="min-h-[100dvh] flex items-center justify-center bg-[#070510] px-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.35)] mb-4">
            <ShieldCheck size={30} className="text-black" />
          </div>
          <h1 className="text-2xl font-display font-black text-white tracking-wide">
            لوحة التحكم
          </h1>
          <p className="text-sm text-white/40 font-display mt-1">
            أدخل بيانات حسابك الإداري للمتابعة
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#0b0817] border border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl shadow-black/60"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-display font-bold text-white/50 tracking-wide">
              المعرّف (handle)
            </label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-sm font-display pointer-events-none">
                @
              </span>
              <input
                data-testid="input-admin-handle"
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="owner"
                autoComplete="username"
                required
                className="w-full h-11 rounded-xl bg-black/40 border border-white/12 pr-8 pl-3 text-sm font-display text-white placeholder:text-white/25 focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-display font-bold text-white/50 tracking-wide">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                data-testid="input-admin-password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full h-11 rounded-xl bg-black/40 border border-white/12 pr-3 pl-10 text-sm font-display text-white placeholder:text-white/25 focus:outline-none focus:border-primary/50"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs font-display text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-center">
              {error}
            </p>
          )}

          <button
            data-testid="button-admin-login"
            type="submit"
            disabled={loading || !handle.trim() || !password}
            className="h-11 rounded-xl bg-gradient-to-l from-primary to-amber-400 text-black font-display font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition-all"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
            ) : (
              <LogIn size={16} />
            )}
            {loading ? "جارٍ التحقق…" : "تسجيل الدخول"}
          </button>

          <div className="text-center text-[11px] text-white/25 font-display leading-relaxed pt-1">
            للحصول على بيانات الدخول تواصل مع المالك
          </div>
        </form>
      </motion.div>
    </div>
  );
}
