import { useState } from "react";
import { KeyRound, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { changeAdminPassword } from "../../lib/admin-auth";
import type { AdminSessionInfo } from "../../lib/admin-auth";

interface Props {
  session: AdminSessionInfo;
  onDone: (updated: AdminSessionInfo) => void;
}

export default function ChangePasswordScreen({ session, onDone }: Props) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (next.length < 8) {
      setError("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.");
      return;
    }
    if (next !== confirm) {
      setError("كلمة المرور الجديدة وتأكيدها غير متطابقتين.");
      return;
    }
    if (next === current) {
      setError("كلمة المرور الجديدة يجب أن تختلف عن الحالية.");
      return;
    }

    setLoading(true);
    try {
      const updated = await changeAdminPassword(current, next);
      onDone(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "فشل تغيير كلمة المرور.");
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
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-yellow-400 flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.35)] mb-4">
            <KeyRound size={30} className="text-black" />
          </div>
          <h1 className="text-2xl font-display font-black text-white tracking-wide">
            تغيير كلمة المرور
          </h1>
          <p className="text-sm text-white/40 font-display mt-1 text-center">
            يجب عليك تغيير كلمة المرور قبل المتابعة
          </p>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-4 text-center">
          <div className="text-xs font-display text-amber-300 font-bold">
            مرحباً، {session.name}
          </div>
          <div className="text-[11px] text-amber-400/70 font-display mt-0.5">
            هذا الحساب يستخدم كلمة مرور مؤقتة. يرجى تعيين كلمة مرور جديدة آمنة.
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#0b0817] border border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl shadow-black/60"
        >
          <PasswordField
            label="كلمة المرور الحالية"
            value={current}
            onChange={setCurrent}
            show={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
            testId="input-current-password"
            autoComplete="current-password"
          />
          <PasswordField
            label="كلمة المرور الجديدة"
            value={next}
            onChange={setNext}
            show={showNext}
            onToggle={() => setShowNext((v) => !v)}
            testId="input-new-password"
            autoComplete="new-password"
            hint="8 أحرف على الأقل"
          />
          <PasswordField
            label="تأكيد كلمة المرور الجديدة"
            value={confirm}
            onChange={setConfirm}
            show={showNext}
            onToggle={() => setShowNext((v) => !v)}
            testId="input-confirm-password"
            autoComplete="new-password"
          />

          {error && (
            <p className="text-xs font-display text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-center">
              {error}
            </p>
          )}

          <button
            data-testid="button-change-password"
            type="submit"
            disabled={loading || !current || !next || !confirm}
            className="h-11 rounded-xl bg-gradient-to-l from-primary to-amber-400 text-black font-display font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition-all"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
            ) : (
              <ShieldCheck size={16} />
            )}
            {loading ? "جارٍ الحفظ…" : "حفظ كلمة المرور"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function PasswordField({
  label, value, onChange, show, onToggle, testId, autoComplete, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; testId: string; autoComplete: string; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-display font-bold text-white/50 tracking-wide">
        {label}
      </label>
      {hint && <span className="text-[10px] text-white/30 font-display -mt-1">{hint}</span>}
      <div className="relative">
        <input
          data-testid={testId}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          className="w-full h-11 rounded-xl bg-black/40 border border-white/12 pr-3 pl-10 text-sm font-display text-white placeholder:text-white/25 focus:outline-none focus:border-primary/50"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}
