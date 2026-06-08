---
name: SKZ Bot email OTP delivery
description: How browser-login OTP emails are sent and the provider constraints
---

# SKZ Bot email OTP (browser login)

OTP emails for browser/web login are sent via the **Resend connector** (`@replit/connectors-sdk`,
`connectors.proxy("resend", "/emails", { method: "POST", body: {...} })`), NOT raw SMTP.

**Why not Zoho/mailbox SMTP:** regular mailbox SMTP (Zoho smtp.zoho.com:465) gets the cloud IP
blocked fast under automated sending — first `535 Authentication Failed`, then
`552 Your IP Address is blocked from further use`. Transactional providers (Resend) are built for
sending from cloud IPs and don't get blocked.

**How to apply / gotchas:**
- The `from` address defaults to `onboarding@resend.dev` (overridable via `RESEND_FROM` env).
- **Resend free tier without a verified domain only delivers to the account-owner email**
  (the address the Resend account was created with). Sending to any other recipient returns
  HTTP 403 `validation_error`. To send to arbitrary users you MUST verify the domain at
  resend.com/domains and set `RESEND_FROM` to an address on that domain
  (e.g. `Souqrates System <noreply@souqrates.com>`).
- Connector credentials are injected by Replit in dev and production — no API key env needed,
  and no dev bypass branch exists anymore.
- Legacy `EMAIL_USER` / `EMAIL_PASSWORD` secrets are unused after the Resend switch.
