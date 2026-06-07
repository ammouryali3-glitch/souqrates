---
name: SKZ Bot Stars payment flow
description: How Telegram Stars in-app purchase works end-to-end in this codebase.
---

## Telegram Stars API rules
- Currency code: `"XTR"` (not "STARS")
- `provider_token` must be `""` (empty string)
- `prices[].amount` = integer Stars count
- `createInvoiceLink` is called server-side; frontend receives the URL and calls `window.Telegram.WebApp.openInvoice(url, callback)`
- `pre_checkout_query` update must be answered within **10 seconds** via `answerPreCheckoutQuery`
- `successful_payment` arrives as a field on a `message` update (not a separate update type)

## allowed_updates
bot.ts registers `["message", "pre_checkout_query"]` — both are required for Stars to work.

## Idempotency
`telegram_payment_charge_id` is stored as the deposit `id` in the `deposits` table.  
`ON CONFLICT DO NOTHING` prevents double-crediting on duplicate webhook deliveries.

## Flow
1. Admin creates a package in Economy panel with `currency: "STARS"` and `price` = Stars count.
2. User taps Stars tab in wallet → frontend fetches `GET /api/user/stars/packages`.
3. User taps Buy → `POST /api/user/stars/create-invoice` → backend calls `createInvoiceLink` → returns URL.
4. Frontend calls `openInvoice(url, cb)` → Telegram handles payment UI.
5. Telegram sends `pre_checkout_query` to webhook → bot answers immediately.
6. Telegram sends `successful_payment` message → bot credits SKZ + records in deposits table.

**Why:** Stars is the lowest-friction payment method inside Telegram; no external wallet needed.

## Package storage
Stars packages use the same `token_packages` table with `currency: "STARS"`. The `price` field = Stars count (integer). `skz` + `bonus` = total SKZ credited.
