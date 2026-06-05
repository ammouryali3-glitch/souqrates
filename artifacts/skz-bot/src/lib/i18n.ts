import { useSyncExternalStore } from "react";

export type Lang = "ar" | "en";

const LANG_KEY = "skz_lang";

let lang: Lang = (localStorage.getItem(LANG_KEY) as Lang) ?? "ar";
const langListeners = new Set<() => void>();

function emitLang() { langListeners.forEach(l => l()); }

export function setLang(l: Lang) {
  lang = l;
  localStorage.setItem(LANG_KEY, l);
  document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = l;
  emitLang();
}

export function getLang(): Lang { return lang; }

export function useLang(): Lang {
  return useSyncExternalStore(
    cb => { langListeners.add(cb); return () => langListeners.delete(cb); },
    () => lang,
    () => lang,
  );
}

// Apply on startup
document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
document.documentElement.lang = lang;

export const t = {
  ar: {
    home: "الرئيسية",
    games: "الألعاب",
    shop: "المتجر",
    wallet: "المحفظة",
    referrals: "الإحالات",
    totalBalance: "الرصيد الكلي",
    totalWon: "إجمالي المكاسب",
    network: "شبكتك",
    liveActivity: "النشاط الحي",
    viewAll: "عرض الكل",
    noActivity: "لا يوجد نشاط بعد",
    dailyBonus: "مكافأة يومية متاحة",
    dailyBonusSub: (amt: number, bal: number) => `اضغط للحصول على ${amt} SKZ · رصيدك ${bal}`,
    availableSkz: "رصيد SKZ المتاح",
    deposit: "إيداع",
    withdraw: "سحب",
    recentTxs: "آخر المعاملات",
    noTxs: "لا توجد معاملات بعد",
    depositAddress: "عنوان الإيداع",
    depositNote: "أرسل USDT عبر شبكة TRON (TRC20) فقط. الأصول الأخرى ستُفقد. الحد الأدنى: 10 USDT.",
    amount: "المبلغ (SKZ)",
    maxBtn: "الحد الأقصى",
    destWallet: "المحفظة المستلِمة (USDT TRC20)",
    confirmWithdraw: "تأكيد السحب",
    syndicateTitle: "الشبكة",
    syndicateDesc: "شبكة عمولات متعددة المستويات",
    totalEarned: "إجمالي الأرباح",
    allTime: "SKZ إجمالي",
    thisMonth: "هذا الشهر",
    inviteLink: "رابط الدعوة",
    inviteSub: "شارك لبناء شبكتك",
    networkTiers: "مستويات الشبكة",
    tier: "المستوى",
    commission: "عمولة",
    active: "نشط",
    generatedRevenue: "الأرباح المحققة",
    shopTitle: "المتجر",
    shopEmpty: "لا توجد منتجات حالياً — تابعنا لمعرفة آخر العروض",
    searchPlaceholder: "بحث...",
    allCategories: "الكل",
    buy: "شراء",
    purchased: "مكتسب",
    pages: "صفحة",
    langSwitch: "EN",
    play: "العب",
    vaultTitle: "الخزنة",
    refs: "إحالات",
  },
  en: {
    home: "Home",
    games: "Games",
    shop: "Shop",
    wallet: "Wallet",
    referrals: "Referrals",
    totalBalance: "Total Balance",
    totalWon: "Total Won",
    network: "Network",
    liveActivity: "Live Activity",
    viewAll: "View All",
    noActivity: "No activity yet",
    dailyBonus: "Daily bonus available",
    dailyBonusSub: (amt: number, bal: number) => `Tap to claim ${amt} SKZ · Balance: ${bal}`,
    availableSkz: "Available SKZ",
    deposit: "Deposit",
    withdraw: "Withdraw",
    recentTxs: "Recent Transactions",
    noTxs: "No transactions yet",
    depositAddress: "Deposit Address",
    depositNote: "Send only USDT over TRON (TRC20) network. Other assets will be lost. Minimum: 10 USDT.",
    amount: "Amount (SKZ)",
    maxBtn: "Max",
    destWallet: "Destination Wallet (USDT TRC20)",
    confirmWithdraw: "Confirm Withdrawal",
    syndicateTitle: "Syndicate",
    syndicateDesc: "Multi-tier commission network",
    totalEarned: "Total Earned",
    allTime: "SKZ All time",
    thisMonth: "This Month",
    inviteLink: "Your Invite Link",
    inviteSub: "Share to build your syndicate",
    networkTiers: "Network Tiers",
    tier: "Tier",
    commission: "Commission",
    active: "active",
    generatedRevenue: "Generated Revenue",
    shopTitle: "Shop",
    shopEmpty: "No products available yet — stay tuned",
    searchPlaceholder: "Search...",
    allCategories: "All",
    buy: "Buy",
    purchased: "Owned",
    pages: "pages",
    langSwitch: "ع",
    play: "Play",
    vaultTitle: "Vault",
    refs: "Refs",
  },
} as const;

export type Strings = typeof t.ar;
