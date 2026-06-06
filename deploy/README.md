# Souqrates — نشر الإنتاج على Contabo + Supabase

## المعمارية الكاملة

```
Replit (تطوير)
    │
    └─ git push ──► GitHub ──► GitHub Actions
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
               build + test    Deploy Contabo   Push Schema
                                    │           (Supabase)
                              ┌─────┴──────┐
                              │  Contabo   │
                              │  Ubuntu    │
                              │  24.04     │
                              │            │
                              │  Nginx     │◄── Cloudflare (CDN)
                              │  ├─ /      │
                              │  └─ /api ──┼──► PM2 cluster (Node.js)
                              └────────────┘         │
                                                      ▼
                                              Supabase PostgreSQL
                                              Upstash Redis
                                              Cloudflare R2
```

---

## GitHub Secrets المطلوبة

أضفها في **GitHub → Settings → Secrets → Actions**:

| Secret | القيمة | كيف تحصل عليها |
|---|---|---|
| `CONTABO_HOST` | IP سيرفر Contabo | من لوحة Contabo |
| `CONTABO_USER` | `root` | — |
| `CONTABO_SSH_KEY` | مفتاح SSH الخاص | انظر الخطوة 1 أدناه |
| `SUPABASE_DIRECT_URL` | Direct URL من Supabase | انظر الخطوة 2 أدناه |

---

## الإعداد لمرة واحدة

### الخطوة 1 — إنشاء مفتاح SSH

```bash
# على جهازك:
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/contabo_deploy -N ""

# أرسل المفتاح العام للسيرفر:
ssh-copy-id -i ~/.ssh/contabo_deploy.pub root@IP_السيرفر

# انسخ المفتاح الخاص (هذا يدخل في GitHub Secret CONTABO_SSH_KEY):
cat ~/.ssh/contabo_deploy
```

---

### الخطوة 2 — إعداد Supabase

1. اذهب إلى [supabase.com](https://supabase.com) وأنشئ مشروعاً جديداً
2. من **Settings → Database**، احصل على:

```
# للتطبيق (Session Pooler — port 5432):
DATABASE_URL = postgresql://postgres.XXXXX:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres

# للـ migrations فقط (Direct — port 5432):
DATABASE_DIRECT_URL = postgresql://postgres:PASSWORD@db.XXXXX.supabase.co:5432/postgres
```

3. أضف `SUPABASE_DIRECT_URL` في GitHub Secrets
4. اضغط Schema لأول مرة (انظر "نشر Schema" أدناه)

---

### الخطوة 3 — إعداد سيرفر Contabo

```bash
# على Contabo كـ root:
export DATABASE_URL="postgresql://postgres.XXXXX:PASS@aws-0-eu.pooler.supabase.com:5432/postgres"
export DATABASE_DIRECT_URL="postgresql://postgres:PASS@db.XXXXX.supabase.co:5432/postgres"
export TELEGRAM_BOT_TOKEN="your-token"
export DOMAIN="your-domain.com"   # أو IP السيرفر

curl -fsSL https://raw.githubusercontent.com/ammouryali3-glitch/souqrates/main/deploy/setup-contabo.sh | bash
```

---

### الخطوة 4 — نشر Schema إلى Supabase

```bash
# من جهازك (أو يتم تلقائياً عبر GitHub Actions عند تغيير الـ schema):
DATABASE_DIRECT_URL="postgresql://postgres:PASS@db.XXXXX.supabase.co:5432/postgres" \
  bash deploy/migrate.sh
```

---

### الخطوة 5 — أول نشر

```bash
# من جهازك المحلي (أو انتظر GitHub Actions بعد أول push):
CONTABO_HOST=185.x.x.x CONTABO_USER=root bash deploy/first-deploy.sh
```

---

## سير العمل اليومي

```
1. تعدّل الكود على Replit
2. git push origin main
3. GitHub Actions تعمل تلقائياً (~3 دقائق):
   ├── typecheck + build
   ├── deploy → Contabo (PM2 reload بدون توقف)
   └── push schema → Supabase (فقط إذا تغيّر الـ schema)
```

---

## نشر تغييرات قاعدة البيانات

عند إضافة جدول أو حقل جديد في `lib/db/src/schema/`:

```bash
# GitHub Actions يفعلها تلقائياً، أو يدوياً:
DATABASE_DIRECT_URL="..." bash deploy/migrate.sh
```

> ⚠️ استخدم دائماً `DATABASE_DIRECT_URL` (ليس الـ pooler) للـ migrations

---

## مراقبة السيرفر

```bash
pm2 logs souqrates-api          # سجلات حية
pm2 monit                       # لوحة مراقبة تفاعلية
pm2 status                      # حالة العمليات

curl http://localhost/api/healthz   # فحص صحة API
```

---

## إضافة HTTPS

```bash
# بعد توجيه DNS لاسم النطاق لـ Contabo IP:
certbot --nginx -d souqrates.com --non-interactive --agree-tos -m admin@souqrates.com
# يجدد تلقائياً
```

> **أفضل ممارسة:** ضع Cloudflare أمام Contabo (Proxy mode) بدل Certbot — تحصل على HTTPS + CDN + حماية DDoS مجاناً

---

## تحديث المتغيرات البيئية

```bash
# على Contabo:
nano /opt/souqrates/api/.env

# ثم أعد تحميل التطبيق:
pm2 reload souqrates-api --update-env
```

---

## GitHub Environment (اختياري لكن موصى به)

في **GitHub → Settings → Environments → production**:
- أضف **Required reviewers** — يطلب موافقتك قبل كل نشر
- أضف **Deployment branches: main only** — يمنع النشر من فروع أخرى
