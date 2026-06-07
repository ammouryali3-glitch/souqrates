---
name: SKZ Bot deposit rate config
description: Where deposit rate lives, priority order, and why TradedCurrency excludes STARS from finance tables.
---

## Rule
`depositSkzPerTon` lives in the `finance` admin config key (managed via the admin Finance panel).
`ton-poller` reads `finance.depositSkzPerTon` first, then falls back to `deposit_config.skzPerTon`, then defaults to 100.
The wallet API (`GET /api/user/wallet`) applies the same priority and returns `depositRate` in the response.

**Why:** Previously the deposit rate was only in `deposit_config` (never shown in admin UI) and defaulted to 500 SKZ/TON while withdrawal was 100 SKZ/TON — a 5× arbitrage. Fixed by seeding 100 in both and adding admin panel control via `finance.depositSkzPerTon`.

## TradedCurrency vs Currency
`Currency = "SKZ" | "TON" | "USDT" | "STARS"` — full type for all payment methods.  
`TradedCurrency = Exclude<Currency, "STARS">` — for finance tables (withdrawMin/Max/dailyMax/gasFee, ManagedUser.balances).  
STARS has no withdrawal path and no on-chain balance, so it's excluded from finance record types.

**How to apply:** Any new `Record<Currency, number>` field in FinanceSettings should use `Record<TradedCurrency, number>` instead. In users.tsx balance-adjustment UI, parameter types use `TradedCurrency`.
