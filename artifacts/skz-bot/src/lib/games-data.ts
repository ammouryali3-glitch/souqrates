import type { LucideIcon } from "lucide-react";
import {
  Layers, Orbit, Sword, Scissors, Circle, GitBranch, Music2, Cpu, Sparkles,
  Rocket, Grid2x2, ArrowUp, Crosshair, Hammer, Link2, Scale, Zap, Target,
  Waves, Brain, Hash, Bolt, LayoutGrid,
} from "lucide-react";

export type GameType = "skill" | "arena";

export type AccentKey =
  | "gold" | "cyan" | "amber" | "teal" | "violet" | "white" | "green"
  | "purple" | "blue" | "pink" | "emerald" | "orange" | "yellow" | "red";

export interface AccentTokens {
  border: string;   // card border
  card: string;     // card background gradient
  glow: string;     // card shadow
  bigIcon: string;  // faded background icon color
  iconWrap: string; // icon chip gradient
  iconText: string; // icon glyph color
  text: string;     // accent text (footer / labels)
  dot: string;      // hex for inline styles in manager
}

// Full static class strings — required so Tailwind JIT keeps them in the build.
export const ACCENTS: Record<AccentKey, AccentTokens> = {
  gold: {
    border: "border-accent/40",
    card: "bg-gradient-to-br from-accent/15 via-yellow-950/10 to-background",
    glow: "shadow-yellow-900/20",
    bigIcon: "text-accent",
    iconWrap: "bg-gradient-to-tr from-yellow-700 to-amber-400 shadow-[0_0_25px_rgba(212,175,55,0.5)]",
    iconText: "text-white",
    text: "text-accent",
    dot: "#d4af37",
  },
  cyan: {
    border: "border-cyan-500/40",
    card: "bg-gradient-to-br from-[#001218]/90 via-cyan-950/20 to-background",
    glow: "shadow-cyan-900/20",
    bigIcon: "text-cyan-400",
    iconWrap: "bg-gradient-to-tr from-cyan-700 to-blue-400 shadow-[0_0_25px_rgba(6,182,212,0.5)]",
    iconText: "text-white",
    text: "text-cyan-400",
    dot: "#22d3ee",
  },
  amber: {
    border: "border-amber-500/40",
    card: "bg-gradient-to-br from-[#120800]/90 via-amber-950/20 to-background",
    glow: "shadow-amber-900/20",
    bigIcon: "text-amber-400",
    iconWrap: "bg-gradient-to-tr from-amber-700 to-orange-400 shadow-[0_0_25px_rgba(245,158,11,0.5)]",
    iconText: "text-white",
    text: "text-amber-400",
    dot: "#f59e0b",
  },
  teal: {
    border: "border-teal-500/40",
    card: "bg-gradient-to-br from-[#001210]/90 via-teal-950/20 to-background",
    glow: "shadow-teal-900/20",
    bigIcon: "text-teal-400",
    iconWrap: "bg-gradient-to-tr from-teal-700 to-cyan-400 shadow-[0_0_25px_rgba(20,184,166,0.5)]",
    iconText: "text-white",
    text: "text-teal-400",
    dot: "#2dd4bf",
  },
  violet: {
    border: "border-violet-500/40",
    card: "bg-gradient-to-br from-[#0c0020]/90 via-violet-950/20 to-background",
    glow: "shadow-violet-900/20",
    bigIcon: "text-violet-400",
    iconWrap: "bg-gradient-to-tr from-violet-700 to-fuchsia-400 shadow-[0_0_25px_rgba(139,92,246,0.5)]",
    iconText: "text-white",
    text: "text-violet-400",
    dot: "#a78bfa",
  },
  white: {
    border: "border-white/20",
    card: "bg-gradient-to-br from-white/5 via-white/[0.03] to-background",
    glow: "shadow-white/10",
    bigIcon: "text-white",
    iconWrap: "bg-gradient-to-tr from-white/30 to-white/60 shadow-[0_0_25px_rgba(255,255,255,0.35)]",
    iconText: "text-black",
    text: "text-white/70",
    dot: "#ffffff",
  },
  green: {
    border: "border-green-500/40",
    card: "bg-gradient-to-br from-[#001a0a]/90 via-green-950/20 to-background",
    glow: "shadow-green-900/20",
    bigIcon: "text-green-400",
    iconWrap: "bg-gradient-to-tr from-green-700 to-cyan-400 shadow-[0_0_25px_rgba(34,197,94,0.5)]",
    iconText: "text-white",
    text: "text-green-400",
    dot: "#22c55e",
  },
  purple: {
    border: "border-purple-500/40",
    card: "bg-gradient-to-br from-[#0a0020]/90 via-purple-950/20 to-background",
    glow: "shadow-purple-900/20",
    bigIcon: "text-purple-400",
    iconWrap: "bg-gradient-to-tr from-purple-700 to-violet-400 shadow-[0_0_25px_rgba(168,85,247,0.5)]",
    iconText: "text-white",
    text: "text-purple-400",
    dot: "#a855f7",
  },
  blue: {
    border: "border-blue-500/40",
    card: "bg-gradient-to-br from-[#000514]/90 via-blue-950/20 to-background",
    glow: "shadow-blue-900/20",
    bigIcon: "text-blue-400",
    iconWrap: "bg-gradient-to-tr from-blue-700 to-violet-400 shadow-[0_0_25px_rgba(59,130,246,0.5)]",
    iconText: "text-white",
    text: "text-blue-400",
    dot: "#60a5fa",
  },
  pink: {
    border: "border-pink-500/40",
    card: "bg-gradient-to-br from-[#1a0018]/90 via-pink-950/20 to-background",
    glow: "shadow-pink-900/20",
    bigIcon: "text-pink-400",
    iconWrap: "bg-gradient-to-tr from-pink-700 to-purple-400 shadow-[0_0_25px_rgba(236,72,153,0.5)]",
    iconText: "text-white",
    text: "text-pink-400",
    dot: "#f472b6",
  },
  emerald: {
    border: "border-emerald-500/40",
    card: "bg-gradient-to-br from-[#001808]/90 via-emerald-950/20 to-background",
    glow: "shadow-emerald-900/20",
    bigIcon: "text-emerald-400",
    iconWrap: "bg-gradient-to-tr from-emerald-700 to-teal-400 shadow-[0_0_25px_rgba(16,185,129,0.5)]",
    iconText: "text-white",
    text: "text-emerald-400",
    dot: "#34d399",
  },
  orange: {
    border: "border-orange-500/40",
    card: "bg-gradient-to-br from-[#1a0800]/90 via-orange-950/20 to-background",
    glow: "shadow-orange-900/20",
    bigIcon: "text-orange-400",
    iconWrap: "bg-gradient-to-tr from-orange-700 to-red-400 shadow-[0_0_25px_rgba(249,115,22,0.5)]",
    iconText: "text-white",
    text: "text-orange-400",
    dot: "#fb923c",
  },
  yellow: {
    border: "border-yellow-500/40",
    card: "bg-gradient-to-br from-[#100800]/90 via-yellow-950/20 to-background",
    glow: "shadow-yellow-900/20",
    bigIcon: "text-yellow-400",
    iconWrap: "bg-gradient-to-tr from-yellow-700 to-amber-400 shadow-[0_0_25px_rgba(255,200,0,0.5)]",
    iconText: "text-white",
    text: "text-yellow-400",
    dot: "#facc15",
  },
  red: {
    border: "border-red-500/40",
    card: "bg-gradient-to-br from-[#180000]/90 via-red-950/20 to-background",
    glow: "shadow-red-900/20",
    bigIcon: "text-red-400",
    iconWrap: "bg-gradient-to-tr from-red-700 to-orange-400 shadow-[0_0_25px_rgba(239,68,68,0.5)]",
    iconText: "text-white",
    text: "text-red-400",
    dot: "#f87171",
  },
};

export interface GameDef {
  id: string;        // unique key, also route slug
  route: string;     // full route path
  type: GameType;
  title: string;     // default title
  category: string;  // e.g. "Arcade", "Math", "Mystery"
  desc: string;
  tagline: string;   // footer line (skill) / reward line
  accent: AccentKey;
  icon: LucideIcon;
  // arena only
  prize?: string;
  entry?: number;
  tag?: string;      // e.g. "Weekly · Mystery"
}

// ── Prize Pool Arena (5) ──────────────────────────────────────────────────────
export const ARENA_GAMES: GameDef[] = [
  {
    id: "detective", route: "/arena/detective", type: "arena",
    title: "The Detective", category: "Mystery", icon: Brain, accent: "orange",
    desc: "افحص الأدلة واستجوب المشتبه بهم لحل لغز الجريمة قبل انتهاء الوقت.",
    tagline: "الفائز يأخذ كل شيء", prize: "+18K", entry: 200, tag: "Weekly · Mystery",
  },
  {
    id: "cipher", route: "/arena/cipher", type: "arena",
    title: "Cipher Rush", category: "Code", icon: Cpu, accent: "cyan",
    desc: "فك تشفير 7 كلمات مشفّرة بسرعة — كل خطأ يكلّفك وقتاً ثميناً.",
    tagline: "يُعاد ضبطه يومياً", prize: "+9.8K", entry: 150, tag: "Daily · Code",
  },
  {
    id: "hiddenpath", route: "/arena/hiddenpath", type: "arena",
    title: "Hidden Path", category: "Maze", icon: GitBranch, accent: "green",
    desc: "احفظ المسار السري عبر المتاهة المضيئة ثم اعبره من الذاكرة دون خطأ.",
    tagline: "يُعاد ضبطه أسبوعياً", prize: "+15K", entry: 175, tag: "Weekly · Maze",
  },
  {
    id: "geniusgrid", route: "/arena/geniusgrid", type: "arena",
    title: "Genius Grid", category: "Logic", icon: Grid2x2, accent: "purple",
    desc: "املأ شبكة 4×4 المنطقية بحيث لا يتكرر أي رمز في صف أو عمود.",
    tagline: "يُعاد ضبطه يومياً", prize: "+11.8K", entry: 180, tag: "Daily · Logic",
  },
  {
    id: "truthscale", route: "/arena/truthscale", type: "arena",
    title: "Truth Scale", category: "Chain", icon: Scale, accent: "yellow",
    desc: "8 ألغاز منطقية متسلسلة — كل إجابة صحيحة تفتح اللغز التالي الأصعب.",
    tagline: "الفائز يأخذ كل شيء", prize: "+14.3K", entry: 200, tag: "Weekly · Chain",
  },
];

// ── Skill Games (31) ──────────────────────────────────────────────────────────
export const SKILL_GAMES: GameDef[] = [
  { id: "stack", route: "/games/stack", type: "skill", title: "Stack & Match", category: "Arcade", icon: Layers, accent: "gold", desc: "أسقط الكتل واصنع سلاسل مثالية متتالية لمضاعفة نقاطك.", tagline: "اربح حتى 5 SKZ لكل كتلة" },
  { id: "orbit", route: "/games/orbit", type: "skill", title: "Orbit Dash", category: "Arcade", icon: Orbit, accent: "cyan", desc: "اقفز بين المدارات والتقط البلورات النيونية دون أن تصطدم.", tagline: "مطاردة بلورات نيون" },
  { id: "knife", route: "/games/knife", type: "skill", title: "Knife Master", category: "Skill", icon: Sword, accent: "amber", desc: "ارمِ السكاكين في الهدف الدوّار والتقط التفاح لوقت إضافي.", tagline: "التقط التفاح لوقت إضافي" },
  { id: "slice", route: "/games/slice", type: "skill", title: "Perfect Slice", category: "Skill", icon: Scissors, accent: "teal", desc: "اضغط مع الاستمرار لتقطع بدقة — حواجز خادعة تعكس الاتجاه لخداعك.", tagline: "حواجز خادعة تعكس الاتجاه" },
  { id: "color", route: "/games/color", type: "skill", title: "Color Switch", category: "Arcade", icon: Circle, accent: "violet", desc: "مرّر كرتك عبر الأجزاء المطابقة للون فقط — حلقة خادعة تظهر فوق 10 نقاط.", tagline: "حلقة داخلية خادعة بعد 10 نقاط" },
  { id: "zigzag", route: "/games/zigzag", type: "skill", title: "ZigZag Driver", category: "Arcade", icon: GitBranch, accent: "cyan", desc: "انقر لتبديل الاتجاه وابقَ على المسار ثلاثي الأبعاد منخفض المضلعات.", tagline: "مسار آيزومتري ثلاثي الأبعاد" },
  { id: "piano", route: "/games/piano", type: "skill", title: "Piano Rush", category: "Rhythm", icon: Music2, accent: "white", desc: "انقر البلاطات السوداء في الوقت المناسب عبر 4 مسارات متسارعة.", tagline: "4 مسارات · بلاطات مطوّلة · تسارع" },
  { id: "whack", route: "/games/whack", type: "skill", title: "Whack_Cyber", category: "Reflex", icon: Cpu, accent: "green", desc: "قضِ على المخلوقات السيبرانية في واجهة طرفية بأسلوب الهاكر.", tagline: "واجهة طرفية · مكافأة تجميد" },
  { id: "bubble", route: "/games/bubble", type: "skill", title: "Bubble Shooter", category: "Arcade", icon: Sparkles, accent: "purple", desc: "صوّب المدفع المتوهّج وفجّر تجمعات الفقاعات بسلاسل تفاعلية.", tagline: "تفاعلات متسلسلة · ارتداد · مضاعف" },
  { id: "striker", route: "/games/striker", type: "skill", title: "Galaxy Striker", category: "Shooter", icon: Rocket, accent: "blue", desc: "اسحب لقيادة سفينتك وأسقط 4 أنواع من الأعداء واجمع التعزيزات.", tagline: "درع · إطلاق ثلاثي · قنبلة" },
  { id: "breakout", route: "/games/breakout", type: "skill", title: "HyperBreak", category: "Arcade", icon: Grid2x2, accent: "pink", desc: "كسّر الطوب الكلاسيكي مع ليزر وكرات متعددة وطوب متفجّر.", tagline: "ليزر · كرات متعددة · تعزيزات" },
  { id: "hopper", route: "/games/hopper", type: "skill", title: "Sky Hopper", category: "Arcade", icon: ArrowUp, accent: "green", desc: "اقفز صعوداً عبر المجرّة على 5 أنواع منصات وتجنّب الأعداء.", tagline: "5 منصات · أعداء · نوابض" },
  { id: "calcblast", route: "/games/calcblast", type: "skill", title: "Calc Blaster", category: "Math", icon: Crosshair, accent: "cyan", desc: "أجب على المعادلات السريعة عبر 4 عمليات حسابية ولديك 3 محاولات.", tagline: "4 عمليات · 3 قلوب · تسارع" },
  { id: "numsmash", route: "/games/numsmash", type: "skill", title: "Number Smash", category: "Math", icon: Hammer, accent: "orange", desc: "5 أنواع تحدّيات بقواعد متبدّلة — فكّر بسرعة قبل نفاد القلوب.", tagline: "5 تحدّيات · قواعد متبدّلة · 3 قلوب" },
  { id: "chainsum", route: "/games/chainsum", type: "skill", title: "Sum Chain", category: "Math", icon: Link2, accent: "emerald", desc: "ارسم مساراً عبر شبكة 5×5 ليصل مجموع الأرقام إلى الهدف.", tagline: "شبكة 5×5 · رسم مسار · سلاسل" },
  { id: "fracsort", route: "/games/fracsort", type: "skill", title: "Fraction Sort", category: "Math", icon: Scale, accent: "violet", desc: "رتّب 20 كسراً فريداً بصرياً من الأصغر إلى الأكبر بثلاث محاولات.", tagline: "20 كسراً · بطاقة بصرية · 3 قلوب" },
  { id: "speedmath", route: "/games/speedmath", type: "skill", title: "Speed Math", category: "Math", icon: Zap, accent: "yellow", desc: "تومض المعادلة 0.9 ثانية ثم تظهر 4 خيارات — أجب بسرعة لمكافأة السرعة!", tagline: "مكافأة سرعة · ×5 كومبو · 4 عمليات" },
  { id: "gridpop", route: "/games/gridpop", type: "skill", title: "Grid Pop", category: "Puzzle", icon: Grid2x2, accent: "pink", desc: "انقر الكتل المتصلة بنفس اللون لتفجيرها — 8+ دفعة واحدة لوقت إضافي.", tagline: "تعبئة فيضية · 6 ألوان · اهتزاز" },
  { id: "neonlink", route: "/games/neonlink", type: "skill", title: "Neon Link", category: "Puzzle", icon: GitBranch, accent: "cyan", desc: "اسحب خطوطاً نيونية لربط الرموز المتطابقة وتجنّب الحاجز المتحرك ⚡.", tagline: "ربط خطوط · حاجز متحرك · أزواج متصاعدة" },
  { id: "quicksum", route: "/games/quicksum", type: "skill", title: "Quick Sum", category: "Math", icon: Cpu, accent: "blue", desc: "انقر الأرقام التي مجموعها يساوي الهدف، ثم يتبدّل الوضع إلى الضرب فجأة!", tagline: "وضعا + و× · واجهة أنيقة · حلّ سريع" },
  { id: "match3", route: "/games/match3", type: "skill", title: "Match 3 Blitz", category: "Puzzle", icon: Sparkles, accent: "purple", desc: "بدّل الجواهر المتوهجة لمطابقة 3 أو أكثر — 5+ تمنح كومبو وانفجارات.", tagline: "شبكة 7×7 · تتالي · وقت إضافي" },
  { id: "pulsetap", route: "/games/pulsetap", type: "skill", title: "Pulse Tap", category: "Rhythm", icon: Target, accent: "green", desc: "حلقات نيون تتمدد عبر الشاشة — انقر كل واحدة عند ملامستها لحلقة الهدف.", tagline: "Perfect · Great · توقيت دقيق" },
  { id: "swiperush", route: "/games/swiperush", type: "skill", title: "Swipe Rush", category: "Reflex", icon: Zap, accent: "yellow", desc: "يظهر سهم ضخم متوهّج — اسحب في اتجاهه قبل أن تنطبق حلقة العدّ التنازلي.", tagline: "4 اتجاهات · مكافأة كومبو · سرعة" },
  { id: "bubblepop", route: "/games/bubblepop", type: "skill", title: "Bubble Pop", category: "Arcade", icon: Waves, accent: "pink", desc: "فقاعات ملوّنة تطفو لأعلى — انقر فقط اللون المعروض في الأعلى، ثم يتغيّر.", tagline: "5 ألوان · هدف متغيّر · كومبو" },
  { id: "colorrain", route: "/games/colorrain", type: "skill", title: "Color Rain", category: "Catcher", icon: Rocket, accent: "violet", desc: "ماسات نيون تتساقط — اسحب المضرب لالتقاط اللون المطابق فقط، والكومبو يصغّره.", tagline: "اسحب المضرب · تقلّص · 5 ألوان" },
  { id: "stackdrop", route: "/games/stackdrop", type: "skill", title: "Stack Drop", category: "Precision", icon: Layers, accent: "cyan", desc: "كتلة نيون منزلقة تتأرجح يميناً ويساراً — انقر لإسقاطها بمحاذاة مثالية.", tagline: "تكديس كلاسيكي · تتزايد السرعة" },
  { id: "orbitaim", route: "/games/orbitaim", type: "skill", title: "Orbit Aim", category: "Aim", icon: Orbit, accent: "orange", desc: "مدفع دوّار يمسح حلقة المدار بينما تظهر أهداف عشوائية — أطلق عند المحاذاة.", tagline: "مدفع دوّار · توقيت · كومبو" },
  { id: "echotap", route: "/games/echotap", type: "skill", title: "Echo Tap", category: "Memory", icon: Brain, accent: "purple", desc: "شاهد تسلسل البلاطات المتوهّجة ثم انقرها بنفس الترتيب من الذاكرة.", tagline: "9 بلاطات · تسلسلات متنامية · ذاكرة" },
  { id: "mergeblitz", route: "/games/mergeblitz", type: "skill", title: "Merge Blitz", category: "Puzzle", icon: Hash, accent: "amber", desc: "لعبة 2048 الكلاسيكية تحت ضغط زمني شديد — ادمج البلاطات قبل نفاد الوقت.", tagline: "آليات 2048 · مؤقّت · سحب" },
  { id: "numblitz", route: "/games/numblitz", type: "skill", title: "Number Blitz", category: "Speed", icon: Bolt, accent: "teal", desc: "أرقام مبعثرة على الشاشة — انقرها بالترتيب 1، 2، 3... بأسرع ما يمكن.", tagline: "نقر تسلسلي · تصاعد · سرعة" },
  { id: "cardflip", route: "/games/cardflip", type: "skill", title: "Card Flip", category: "Memory", icon: LayoutGrid, accent: "emerald", desc: "اقلب البطاقات لإيجاد أزواج الرموز المتطابقة عبر لوحات لا نهائية.", tagline: "8 أزواج · لوحات لا نهائية · ذاكرة" },
];

export const ALL_GAMES: GameDef[] = [...ARENA_GAMES, ...SKILL_GAMES];

export function getGameById(id: string): GameDef | undefined {
  return ALL_GAMES.find((g) => g.id === id);
}
