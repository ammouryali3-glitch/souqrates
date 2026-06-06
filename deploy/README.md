# Souqrates — نشر الإنتاج على Contabo

## المعمارية

```
Replit (تطوير) → git push → GitHub → GitHub Actions → Contabo VPS
                                                    ↓
                                          Nginx (80/443)
                                          ├── /        → Frontend (static files)
                                          └── /api     → Node.js API (PM2 cluster)
```

---

## الإعداد لمرة واحدة

### 1. إعداد سيرفر Contabo

```bash
# على سيرفر Contabo (كـ root):
export DATABASE_URL="postgresql://user:pass@host:5432/souqrates"
export TELEGRAM_BOT_TOKEN="your-token"
export SESSION_SECRET="$(openssl rand -hex 32)"
export DOMAIN="your-domain.com"   # أو عنوان IP السيرفر

curl -fsSL https://raw.githubusercontent.com/ammouryali3-glitch/souqrates/main/deploy/setup-contabo.sh | bash
```

### 2. GitHub Secrets

أضف هذه الأسرار في **GitHub → Settings → Secrets → Actions**:

| Secret | القيمة |
|---|---|
| `CONTABO_HOST` | IP سيرفر Contabo (مثال: `185.123.45.67`) |
| `CONTABO_USER` | اسم المستخدم SSH (عادةً `root`) |
| `CONTABO_SSH_KEY` | المفتاح الخاص SSH (انظر أدناه) |

**إنشاء مفتاح SSH:**
```bash
# على جهازك المحلي:
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/contabo_deploy -N ""

# انسخ المفتاح العام للسيرفر:
ssh-copy-id -i ~/.ssh/contabo_deploy.pub root@YOUR_IP

# انسخ المفتاح الخاص وضعه في GitHub Secret CONTABO_SSH_KEY:
cat ~/.ssh/contabo_deploy
```

### 3. GitHub Environment

في **GitHub → Settings → Environments**:
- أنشئ environment باسم `production`
- (اختياري) أضف protection rules مثل طلب موافقة قبل النشر

---

## سير العمل اليومي

```bash
# على Replit — تعديل الكود كالمعتاد، ثم:
git add .
git commit -m "وصف التعديل"
git push origin main
# GitHub Actions يتولى البناء والنشر تلقائياً (~3 دقائق)
```

---

## مراقبة السيرفر

```bash
# على Contabo:
pm2 logs souqrates-api          # سجلات حية
pm2 monit                       # لوحة مراقبة
pm2 status                      # حالة العمليات

# فحص صحة API:
curl http://localhost/api/healthz
```

---

## إضافة HTTPS (Let's Encrypt)

```bash
# على Contabo (بعد توجيه DNS لاسم النطاق):
certbot --nginx -d your-domain.com
# يجدد تلقائياً عبر systemd timer
```

---

## المتغيرات البيئية

يمكن تعديلها على السيرفر في:
```
/opt/souqrates/api/.env
```
بعد التعديل:
```bash
pm2 reload souqrates-api --update-env
```

---

## قاعدة البيانات — نصائح إنتاجية

- استخدم **Supabase** أو **Neon** (PostgreSQL مُدار مع backups تلقائية)
- أو **Contabo Object Storage** + PostgreSQL محلي مع backups يومية
- لتطبيق تغييرات Schema: `pnpm --filter @workspace/db run push`
