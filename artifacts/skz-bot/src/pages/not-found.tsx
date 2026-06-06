import { AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useLang } from "@/lib/i18n";

export default function NotFound() {
  const [, navigate] = useLocation();
  const lang = useLang();
  const isAr = lang === "ar";

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center"
      style={{ background: "var(--color-bg, #0d1b2a)" }}
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="flex flex-col items-center gap-5 px-6 text-center max-w-xs">
        <AlertCircle className="h-14 w-14 text-primary" />
        <h1 className="text-3xl font-display font-bold text-white tracking-wider">
          404
        </h1>
        <p className="text-white/60 text-sm leading-relaxed">
          {isAr ? "الصفحة غير موجودة" : "Page not found"}
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-2 px-6 py-2 rounded-full text-sm font-semibold text-black"
          style={{ background: "var(--color-primary, #f5b301)" }}
        >
          {isAr ? "العودة للرئيسية" : "Go home"}
        </button>
      </div>
    </div>
  );
}
