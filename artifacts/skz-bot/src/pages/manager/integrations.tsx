import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Database, Cloud, AlertCircle, Globe, CheckCircle2, XCircle,
  Loader2, Save, TestTube2, ChevronDown, ChevronUp, Copy, Check,
  ExternalLink, RefreshCw, Clock,
} from "lucide-react";

interface IntegrationCfg {
  redis: { enabled: boolean; restUrl: string; restToken: string; rateLimitPerMin: number };
  r2: { enabled: boolean; accountId: string; accessKeyId: string; secretAccessKey: string; bucketName: string; publicUrl: string };
  sentry: { enabled: boolean; backendDsn: string; frontendDsn: string };
  cloudflare: { enabled: boolean; workerUrl: string; zoneId: string; apiToken: string };
}

interface IntegrationStatus {
  redis: { connected: boolean };
  r2: { connected: boolean };
  sentry: { connected: boolean };
  cloudflare: { connected: boolean };
}

const DEFAULT_CFG: IntegrationCfg = {
  redis: { enabled: false, restUrl: "", restToken: "", rateLimitPerMin: 120 },
  r2: { enabled: false, accountId: "", accessKeyId: "", secretAccessKey: "", bucketName: "", publicUrl: "" },
  sentry: { enabled: false, backendDsn: "", frontendDsn: "" },
  cloudflare: { enabled: false, workerUrl: "", zoneId: "", apiToken: "" },
};

type IntegrationName = "redis" | "r2" | "sentry" | "cloudflare";

/** Badge based on the SAVED (server-confirmed) config, not local draft */
function StatusBadge({ connected, savedEnabled, isDirty }: { connected: boolean; savedEnabled: boolean; isDirty: boolean }) {
  if (isDirty) return (
    <span className="flex items-center gap-1.5 text-[11px] font-display font-bold text-amber-400/80">
      <Clock size={12} />
      بانتظار الحفظ
    </span>
  );
  if (!savedEnabled) return (
    <span className="flex items-center gap-1.5 text-[11px] font-display font-bold text-white/30">
      <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
      معطّل
    </span>
  );
  if (connected) return (
    <span className="flex items-center gap-1.5 text-[11px] font-display font-bold text-emerald-400">
      <CheckCircle2 size={13} />
      متصل
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-display font-bold text-red-400">
      <XCircle size={13} />
      غير متصل
    </span>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder = "", hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-display font-bold text-white/40 tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:bg-white/6 transition-all"
        dir="ltr"
      />
      {hint && <p className="text-[10px] text-white/25">{hint}</p>}
    </div>
  );
}

function NumberField({
  label, value, onChange, min, max, hint,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-display font-bold text-white/40 tracking-wider">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 focus:bg-white/6 transition-all"
        dir="ltr"
      />
      {hint && <p className="text-[10px] text-white/25">{hint}</p>}
    </div>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? "bg-primary" : "bg-white/15"}`}
      aria-label={label}
    >
      <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : ""}`} />
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors">
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? "تم النسخ" : "نسخ"}
    </button>
  );
}

const WORKER_SCRIPT_URL = "scripts/src/cloudflare-worker.js";

export default function IntegrationsSection() {
  const [cfg, setCfg] = useState<IntegrationCfg>(DEFAULT_CFG);
  /** Last config confirmed by the server (used for status badge) */
  const [savedCfg, setSavedCfg] = useState<IntegrationCfg>(DEFAULT_CFG);
  const [status, setStatus] = useState<IntegrationStatus>({
    redis: { connected: false },
    r2: { connected: false },
    sentry: { connected: false },
    cloudflare: { connected: false },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<IntegrationName | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; latencyMs?: number; error?: string }>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ redis: true, r2: false, sentry: false, cloudflare: false });
  const [cfWorker, setCfWorker] = useState("");

  /** True when the form has unsaved changes vs the last server response */
  const dirty = useMemo(
    () => JSON.stringify(cfg) !== JSON.stringify(savedCfg),
    [cfg, savedCfg],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/integrations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json() as { config: IntegrationCfg; status: IntegrationStatus };
      setCfg(data.config);
      setSavedCfg(data.config);
      setStatus(data.status);
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load Cloudflare worker script for display
  useEffect(() => {
    fetch(WORKER_SCRIPT_URL)
      .then((r) => r.ok ? r.text() : Promise.resolve(""))
      .then(setCfWorker)
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/integrations", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json() as { config: IntegrationCfg; status: IntegrationStatus };
      setCfg(data.config);
      setSavedCfg(data.config);
      setStatus(data.status);
      // Clear stale test results after save since server config changed
      setTestResult({});
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const test = async (name: IntegrationName) => {
    setTesting(name);
    setTestResult((prev) => ({ ...prev, [name]: undefined as never }));
    try {
      const res = await fetch(`/api/admin/integrations/${name}/test`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json() as { ok: boolean; latencyMs?: number; error?: string };
      setTestResult((prev) => ({ ...prev, [name]: data }));
    } catch (e) {
      setTestResult((prev) => ({ ...prev, [name]: { ok: false, error: String(e) } }));
    } finally {
      setTesting(null);
    }
  };

  const toggle = (name: IntegrationName) => {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const set = <K extends IntegrationName>(name: K, patch: Partial<IntegrationCfg[K]>) => {
    setCfg((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-primary/60" />
      </div>
    );
  }

  const cards: {
    id: IntegrationName;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    color: string;
    docsUrl: string;
  }[] = [
    {
      id: "redis",
      icon: <Database size={20} />,
      title: "Upstash Redis",
      subtitle: "كاش + حماية من الإغراق",
      color: "from-green-500/20 to-emerald-500/10",
      docsUrl: "https://console.upstash.com/redis",
    },
    {
      id: "r2",
      icon: <Cloud size={20} />,
      title: "Cloudflare R2",
      subtitle: "تخزين الملفات والصور",
      color: "from-orange-500/20 to-yellow-500/10",
      docsUrl: "https://dash.cloudflare.com/?to=/:account/r2",
    },
    {
      id: "sentry",
      icon: <AlertCircle size={20} />,
      title: "Sentry",
      subtitle: "رصد الأخطاء والأداء",
      color: "from-violet-500/20 to-purple-500/10",
      docsUrl: "https://sentry.io/settings/",
    },
    {
      id: "cloudflare",
      icon: <Globe size={20} />,
      title: "Cloudflare CDN / Workers",
      subtitle: "توزيع جغرافي وحافة سريعة",
      color: "from-blue-500/20 to-cyan-500/10",
      docsUrl: "https://dash.cloudflare.com/",
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-black text-xl text-white">البنية التحتية</h2>
          <p className="text-sm text-white/40 font-display mt-0.5">فعّل الخدمات الخارجية ليتحمل تطبيقك ملايين المستخدمين</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="w-9 h-9 rounded-xl bg-white/6 border border-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className={`flex items-center gap-2 px-5 h-9 rounded-xl font-display font-bold text-sm transition-all disabled:opacity-50 ${dirty ? "bg-primary text-black hover:bg-primary/90" : "bg-white/8 text-white/40 border border-white/10"}`}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {dirty ? "حفظ التغييرات" : "محفوظ"}
          </button>
        </div>
      </div>

      {/* Unsaved changes banner */}
      {dirty && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300/80 text-[11px] font-display">
          <Clock size={12} className="shrink-0" />
          يوجد تغييرات غير محفوظة — اضغط «حفظ التغييرات» لتطبيقها على الخادم
        </div>
      )}

      {cards.map((card) => {
        const isOpen = expanded[card.id];
        const stat = status[card.id];
        const tr = testResult[card.id];
        const isTesting = testing === card.id;
        const cardDirty = JSON.stringify(cfg[card.id]) !== JSON.stringify(savedCfg[card.id]);
        const canTest = savedCfg[card.id].enabled && !cardDirty && !isTesting;

        return (
          <div key={card.id} className="rounded-2xl border border-white/8 bg-[#0e0b1e] overflow-hidden">
            {/* Header */}
            <button
              onClick={() => toggle(card.id)}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/3 transition-colors text-right"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} border border-white/10 flex items-center justify-center text-white/70`}>
                {card.icon}
              </div>
              <div className="flex-1 min-w-0 text-right">
                <div className="font-display font-black text-sm text-white">{card.title}</div>
                <div className="text-[11px] text-white/35 font-display">{card.subtitle}</div>
              </div>
              <StatusBadge
                connected={stat.connected}
                savedEnabled={savedCfg[card.id].enabled}
                isDirty={cardDirty}
              />
              {isOpen ? <ChevronUp size={15} className="text-white/30 shrink-0" /> : <ChevronDown size={15} className="text-white/30 shrink-0" />}
            </button>

            {/* Body */}
            {isOpen && (
              <div className="border-t border-white/6 px-5 py-5 space-y-5">
                {/* Enable toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-display font-bold text-white">تفعيل الخدمة</div>
                    <div className="text-[11px] text-white/35 font-display mt-0.5">
                      {cardDirty ? "احفظ التغييرات لتطبيق الإعدادات على الخادم" : `تفعيل أو إيقاف ${card.title}`}
                    </div>
                  </div>
                  <Toggle
                    value={cfg[card.id].enabled}
                    onChange={(v) => set(card.id, { enabled: v } as never)}
                    label={`تفعيل ${card.title}`}
                  />
                </div>

                {/* Redis fields */}
                {card.id === "redis" && (
                  <div className="space-y-4">
                    <Field
                      label="REST URL"
                      value={cfg.redis.restUrl}
                      onChange={(v) => set("redis", { restUrl: v })}
                      placeholder="https://xxxx.upstash.io"
                      hint="من لوحة Upstash → REST API"
                    />
                    <Field
                      label="REST Token"
                      value={cfg.redis.restToken}
                      onChange={(v) => set("redis", { restToken: v })}
                      type="password"
                      placeholder="AX••••••"
                      hint="المفتاح السري من Upstash"
                    />
                    <NumberField
                      label="حد الطلبات في الدقيقة"
                      value={cfg.redis.rateLimitPerMin}
                      onChange={(v) => set("redis", { rateLimitPerMin: v })}
                      min={10}
                      max={10000}
                      hint="كل IP — الافتراضي 120 طلب/دقيقة"
                    />
                  </div>
                )}

                {/* R2 fields */}
                {card.id === "r2" && (
                  <div className="space-y-4">
                    <Field
                      label="Account ID"
                      value={cfg.r2.accountId}
                      onChange={(v) => set("r2", { accountId: v })}
                      placeholder="abc123def456..."
                      hint="من Cloudflare Dashboard → حسابك → Account ID"
                    />
                    <Field
                      label="Access Key ID"
                      value={cfg.r2.accessKeyId}
                      onChange={(v) => set("r2", { accessKeyId: v })}
                      type="password"
                      placeholder="••••••••"
                    />
                    <Field
                      label="Secret Access Key"
                      value={cfg.r2.secretAccessKey}
                      onChange={(v) => set("r2", { secretAccessKey: v })}
                      type="password"
                      placeholder="••••••••"
                    />
                    <Field
                      label="Bucket Name"
                      value={cfg.r2.bucketName}
                      onChange={(v) => set("r2", { bucketName: v })}
                      placeholder="skz-assets"
                    />
                    <Field
                      label="Public URL (CDN)"
                      value={cfg.r2.publicUrl}
                      onChange={(v) => set("r2", { publicUrl: v })}
                      placeholder="https://assets.yoursite.com"
                      hint="الدومين المخصص أو رابط R2 العام"
                    />
                  </div>
                )}

                {/* Sentry fields */}
                {card.id === "sentry" && (
                  <div className="space-y-4">
                    <Field
                      label="Backend DSN"
                      value={cfg.sentry.backendDsn}
                      onChange={(v) => set("sentry", { backendDsn: v })}
                      placeholder="https://xxxx@oXXX.ingest.sentry.io/XXXX"
                      hint="مشروع Node.js في Sentry"
                    />
                    <Field
                      label="Frontend DSN"
                      value={cfg.sentry.frontendDsn}
                      onChange={(v) => set("sentry", { frontendDsn: v })}
                      placeholder="https://xxxx@oXXX.ingest.sentry.io/XXXX"
                      hint="مشروع React في Sentry — يُضاف للواجهة عند الحفظ"
                    />
                    <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 text-[11px] text-violet-300/70 font-display">
                      الـ Frontend DSN يُعرض في رمز التهيئة أدناه — أضفه لـ Vite env أو استخدم Sentry Wizard لدمجه تلقائياً.
                    </div>
                  </div>
                )}

                {/* Cloudflare fields */}
                {card.id === "cloudflare" && (
                  <div className="space-y-4">
                    <Field
                      label="Worker URL"
                      value={cfg.cloudflare.workerUrl}
                      onChange={(v) => set("cloudflare", { workerUrl: v })}
                      placeholder="https://skz-worker.yourname.workers.dev"
                      hint="رابط Worker بعد النشر على Cloudflare"
                    />
                    <Field
                      label="Zone ID"
                      value={cfg.cloudflare.zoneId}
                      onChange={(v) => set("cloudflare", { zoneId: v })}
                      placeholder="abc123..."
                      hint="من Overview → Zone ID في Cloudflare Dashboard"
                    />
                    <Field
                      label="API Token"
                      value={cfg.cloudflare.apiToken}
                      onChange={(v) => set("cloudflare", { apiToken: v })}
                      type="password"
                      placeholder="••••••••"
                      hint="Zone:Cache Purge + Workers:Edit permissions"
                    />

                    {/* Worker script */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-display font-bold text-white/40 tracking-wider">سكريبت الـ Worker (جاهز للنشر)</label>
                        {cfWorker && <CopyButton text={cfWorker} />}
                      </div>
                      <pre className="bg-black/40 border border-white/8 rounded-xl p-3 text-[10px] text-white/40 font-mono overflow-x-auto max-h-40 leading-relaxed">
                        {cfWorker || "يتم التحميل..."}
                      </pre>
                      <div className="flex items-center gap-2 text-[10px] text-white/30 font-display">
                        <span>الخطوات:</span>
                        <span>Workers & Pages → Create Worker → الصق الكود → Deploy → عيّن TARGET_ORIGIN لرابط تطبيقك</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Test + docs row */}
                <div className="flex items-center justify-between pt-2 border-t border-white/6">
                  <a
                    href={card.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition-colors"
                  >
                    <ExternalLink size={11} />
                    فتح لوحة {card.title}
                  </a>

                  <div className="flex items-center gap-3">
                    {tr && (
                      <span className={`text-[11px] font-display font-bold ${tr.ok ? "text-emerald-400" : "text-red-400"}`}>
                        {tr.ok
                          ? `✓ ناجح${tr.latencyMs != null ? ` — ${tr.latencyMs}ms` : ""}`
                          : `✗ ${tr.error ?? "فشل"}`}
                      </span>
                    )}
                    <div className="relative group">
                      <button
                        onClick={() => canTest && test(card.id)}
                        disabled={!canTest}
                        className="flex items-center gap-1.5 px-4 h-8 rounded-xl bg-white/6 border border-white/8 text-[11px] font-display font-bold text-white/60 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {isTesting ? <Loader2 size={12} className="animate-spin" /> : <TestTube2 size={12} />}
                        اختبار الاتصال
                      </button>
                      {/* Tooltip when disabled */}
                      {!canTest && (
                        <div className="absolute bottom-full right-0 mb-2 px-2.5 py-1.5 rounded-lg bg-black/90 border border-white/10 text-[10px] font-display text-white/60 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          {cardDirty ? "احفظ التغييرات أولاً" : "فعّل الخدمة أولاً"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Architecture info */}
      <div className="rounded-2xl border border-white/6 bg-white/2 px-5 py-4 space-y-3">
        <div className="font-display font-black text-sm text-white/60">كيف يعمل؟</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-white/35 font-display">
          <div className="flex items-start gap-2"><Database size={12} className="mt-0.5 text-emerald-400/50 shrink-0" /><span><span className="text-white/50">Redis:</span> يُخزّن الكاش ويحمي من الإغراق — كل طلب يمر عبر Redis أولاً قبل قاعدة البيانات</span></div>
          <div className="flex items-start gap-2"><Cloud size={12} className="mt-0.5 text-orange-400/50 shrink-0" /><span><span className="text-white/50">R2:</span> تُرفع الصور والملفات لـ R2 مباشرة — لا تشغل خادم Replit بالتحميلات</span></div>
          <div className="flex items-start gap-2"><AlertCircle size={12} className="mt-0.5 text-violet-400/50 shrink-0" /><span><span className="text-white/50">Sentry:</span> يرصد أخطاء الواجهة والخادم ويرسل تنبيهات فورية عند أي عطل</span></div>
          <div className="flex items-start gap-2"><Globe size={12} className="mt-0.5 text-blue-400/50 shrink-0" /><span><span className="text-white/50">Cloudflare:</span> يوزّع المحتوى جغرافياً ويُقرّب التطبيق من المستخدم — يقلل التأخير بـ 80%</span></div>
        </div>
      </div>
    </div>
  );
}
