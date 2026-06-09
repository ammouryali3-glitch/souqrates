---
name: TON Center v3 poller
description: TON Center v2 returns 500 "lt not in db" for this wallet; must use v3 API. Key format differences.
---

## Rule
Always use TON Center **v3** (`/api/v3/transactions`) for this project. v2 (`/api/v2/getTransactions`) returns HTTP 500 with "LITE_SERVER_UNKNOWN: cannot compute block … lt not in db" for the production wallet.

## v3 API details
- URL: `GET https://toncenter.com/api/v3/transactions?account=<wallet>&limit=50&sort=desc`
- Auth header: `X-API-Key` (same as v2)
- Response root: `{ transactions: TonV3Tx[] }` (NOT `{ ok, result }` like v2)
- Hash: `tx.hash` — base64 string (e.g. `xOIUjRzD1eG/sK3Z+7j...`)
- LT: `tx.lt` — string
- Value (nanotons): `tx.in_msg.value` — string
- Comment/memo: `tx.in_msg.message_content?.decoded?.text` when `decoded["@type"] === "text_comment"`

**Why:** v2 is deprecated for certain wallet types and returns 500 from the lite-server index when the block lt is outside the non-archival range.

**How to apply:** If ever re-writing or debugging ton-poller.ts, always use v3. The idempotency key (txHash stored in deposits table) uses the base64 hash from `tx.hash`.

## Exponential backoff pattern
`runPoll()` returns `boolean` (apiOk). `startDepositPoller` uses recursive `setTimeout` with `delay = min(60s * 2^failStreak, 5min)`. On success `failStreak` resets to 0.

## express-rate-limit IPv6 fix
`ipKeyGenerator` from express-rate-limit v8 takes a **string** (the IP), not a Request:
```ts
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
return ipKeyGenerator(req.ip ?? "unknown");
```
