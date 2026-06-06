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
  border: string;
  card: string;
  glow: string;
  bigIcon: string;
  iconWrap: string;
  iconText: string;
  text: string;
  dot: string;
}

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
  id: string;
  route: string;
  type: GameType;
  title: string;
  category: string;       // English category (used as admin key)
  categoryAr?: string;    // Arabic category (displayed in AR mode)
  desc: string;           // Arabic description
  descEn?: string;        // English description
  tagline: string;        // Arabic tagline
  taglineEn?: string;     // English tagline
  accent: AccentKey;
  icon: LucideIcon;
  // arena only
  prize?: string;
  entry?: number;
  tag?: string;           // English arena tag e.g. "Weekly · Mystery"
  tagAr?: string;         // Arabic arena tag
}

/** Return localized desc, tagline, category, tag for a game */
export function localizeGame(game: GameDef, lang: "ar" | "en"): {
  desc: string; tagline: string; category: string; tag: string | undefined;
} {
  if (lang === "en") {
    return {
      desc: game.descEn ?? game.desc,
      tagline: game.taglineEn ?? game.tagline,
      category: game.category,
      tag: game.tag,
    };
  }
  return {
    desc: game.desc,
    tagline: game.tagline,
    category: game.categoryAr ?? game.category,
    tag: game.tagAr ?? game.tag,
  };
}

// ── Prize Pool Arena (5) ──────────────────────────────────────────────────────
export const ARENA_GAMES: GameDef[] = [
  {
    id: "detective", route: "/arena/detective", type: "arena",
    title: "The Detective", category: "Mystery", categoryAr: "غموض", icon: Brain, accent: "orange",
    desc: "افحص الأدلة واستجوب المشتبه بهم لحل لغز الجريمة قبل انتهاء الوقت.",
    descEn: "Examine evidence and interrogate suspects to solve the crime before time runs out.",
    tagline: "الفائز يأخذ كل شيء", taglineEn: "Winner takes all",
    prize: "+18K", entry: 200,
    tag: "Weekly · Mystery", tagAr: "أسبوعي · غموض",
  },
  {
    id: "cipher", route: "/arena/cipher", type: "arena",
    title: "Cipher Rush", category: "Code", categoryAr: "تشفير", icon: Cpu, accent: "cyan",
    desc: "فك تشفير 7 كلمات مشفّرة بسرعة — كل خطأ يكلّفك وقتاً ثميناً.",
    descEn: "Decode 7 encrypted words as fast as you can — each mistake costs precious time.",
    tagline: "يُعاد ضبطه يومياً", taglineEn: "Resets daily",
    prize: "+9.8K", entry: 150,
    tag: "Daily · Code", tagAr: "يومي · تشفير",
  },
  {
    id: "hiddenpath", route: "/arena/hiddenpath", type: "arena",
    title: "Hidden Path", category: "Maze", categoryAr: "متاهة", icon: GitBranch, accent: "green",
    desc: "احفظ المسار السري عبر المتاهة المضيئة ثم اعبره من الذاكرة دون خطأ.",
    descEn: "Memorize the secret path through the glowing maze, then retrace it from memory without errors.",
    tagline: "يُعاد ضبطه أسبوعياً", taglineEn: "Resets weekly",
    prize: "+15K", entry: 175,
    tag: "Weekly · Maze", tagAr: "أسبوعي · متاهة",
  },
  {
    id: "geniusgrid", route: "/arena/geniusgrid", type: "arena",
    title: "Genius Grid", category: "Logic", categoryAr: "منطق", icon: Grid2x2, accent: "purple",
    desc: "املأ شبكة 4×4 المنطقية بحيث لا يتكرر أي رمز في صف أو عمود.",
    descEn: "Fill a 4×4 logic grid so no symbol repeats in any row or column.",
    tagline: "يُعاد ضبطه يومياً", taglineEn: "Resets daily",
    prize: "+11.8K", entry: 180,
    tag: "Daily · Logic", tagAr: "يومي · منطق",
  },
  {
    id: "truthscale", route: "/arena/truthscale", type: "arena",
    title: "Truth Scale", category: "Chain", categoryAr: "سلسلة", icon: Scale, accent: "yellow",
    desc: "8 ألغاز منطقية متسلسلة — كل إجابة صحيحة تفتح اللغز التالي الأصعب.",
    descEn: "8 chained logic puzzles — each correct answer unlocks the next, harder one.",
    tagline: "الفائز يأخذ كل شيء", taglineEn: "Winner takes all",
    prize: "+14.3K", entry: 200,
    tag: "Weekly · Chain", tagAr: "أسبوعي · سلسلة",
  },
];

// ── Skill Games (31) ──────────────────────────────────────────────────────────
export const SKILL_GAMES: GameDef[] = [
  {
    id: "stack", route: "/games/stack", type: "skill", title: "Stack & Match",
    category: "Arcade", categoryAr: "أركيد", icon: Layers, accent: "gold",
    desc: "أسقط الكتل واصنع سلاسل مثالية متتالية لمضاعفة نقاطك.",
    descEn: "Drop blocks to build perfect chains — consecutive combos multiply your score.",
    tagline: "اربح حتى 5 SKZ لكل كتلة", taglineEn: "Win up to 5 SKZ per block",
  },
  {
    id: "orbit", route: "/games/orbit", type: "skill", title: "Orbit Dash",
    category: "Arcade", categoryAr: "أركيد", icon: Orbit, accent: "cyan",
    desc: "اقفز بين المدارات والتقط البلورات النيونية دون أن تصطدم.",
    descEn: "Jump between orbits and collect neon crystals without crashing.",
    tagline: "مطاردة بلورات نيون", taglineEn: "Neon crystal chase",
  },
  {
    id: "knife", route: "/games/knife", type: "skill", title: "Knife Master",
    category: "Skill", categoryAr: "مهارة", icon: Sword, accent: "amber",
    desc: "ارمِ السكاكين في الهدف الدوّار والتقط التفاح لوقت إضافي.",
    descEn: "Throw knives at the spinning target and catch apples for extra time.",
    tagline: "التقط التفاح لوقت إضافي", taglineEn: "Catch apples for bonus time",
  },
  {
    id: "slice", route: "/games/slice", type: "skill", title: "Perfect Slice",
    category: "Skill", categoryAr: "مهارة", icon: Scissors, accent: "teal",
    desc: "اضغط مع الاستمرار لتقطع بدقة — حواجز خادعة تعكس الاتجاه لخداعك.",
    descEn: "Hold to cut with precision — tricky barriers reverse direction to fool you.",
    tagline: "حواجز خادعة تعكس الاتجاه", taglineEn: "Tricky barriers reverse direction",
  },
  {
    id: "color", route: "/games/color", type: "skill", title: "Color Switch",
    category: "Arcade", categoryAr: "أركيد", icon: Circle, accent: "violet",
    desc: "مرّر كرتك عبر الأجزاء المطابقة للون فقط — حلقة خادعة تظهر فوق 10 نقاط.",
    descEn: "Guide your ball through matching color segments only — a deceptive inner ring appears after 10 points.",
    tagline: "حلقة داخلية خادعة بعد 10 نقاط", taglineEn: "Deceptive inner ring after 10 pts",
  },
  {
    id: "zigzag", route: "/games/zigzag", type: "skill", title: "ZigZag Driver",
    category: "Arcade", categoryAr: "أركيد", icon: GitBranch, accent: "cyan",
    desc: "انقر لتبديل الاتجاه وابقَ على المسار ثلاثي الأبعاد منخفض المضلعات.",
    descEn: "Tap to switch direction and stay on the low-poly 3D isometric track.",
    tagline: "مسار آيزومتري ثلاثي الأبعاد", taglineEn: "Low-poly isometric 3D track",
  },
  {
    id: "piano", route: "/games/piano", type: "skill", title: "Piano Rush",
    category: "Rhythm", categoryAr: "إيقاع", icon: Music2, accent: "white",
    desc: "انقر البلاطات السوداء في الوقت المناسب عبر 4 مسارات متسارعة.",
    descEn: "Tap black tiles in time across 4 accelerating lanes.",
    tagline: "4 مسارات · بلاطات مطوّلة · تسارع", taglineEn: "4 lanes · long tiles · acceleration",
  },
  {
    id: "whack", route: "/games/whack", type: "skill", title: "Whack_Cyber",
    category: "Reflex", categoryAr: "ردود فعل", icon: Cpu, accent: "green",
    desc: "قضِ على المخلوقات السيبرانية في واجهة طرفية بأسلوب الهاكر.",
    descEn: "Eliminate cyber creatures on a hacker-style terminal interface.",
    tagline: "واجهة طرفية · مكافأة تجميد", taglineEn: "Terminal UI · freeze bonus",
  },
  {
    id: "bubble", route: "/games/bubble", type: "skill", title: "Bubble Shooter",
    category: "Arcade", categoryAr: "أركيد", icon: Sparkles, accent: "purple",
    desc: "صوّب المدفع المتوهّج وفجّر تجمعات الفقاعات بسلاسل تفاعلية.",
    descEn: "Aim the glowing cannon and burst bubble clusters with chain reactions.",
    tagline: "تفاعلات متسلسلة · ارتداد · مضاعف", taglineEn: "Chain reactions · bounce · multiplier",
  },
  {
    id: "striker", route: "/games/striker", type: "skill", title: "Galaxy Striker",
    category: "Shooter", categoryAr: "إطلاق نار", icon: Rocket, accent: "blue",
    desc: "اسحب لقيادة سفينتك وأسقط 4 أنواع من الأعداء واجمع التعزيزات.",
    descEn: "Drag to pilot your ship and destroy 4 enemy types while collecting power-ups.",
    tagline: "درع · إطلاق ثلاثي · قنبلة", taglineEn: "Shield · triple shot · bomb",
  },
  {
    id: "breakout", route: "/games/breakout", type: "skill", title: "HyperBreak",
    category: "Arcade", categoryAr: "أركيد", icon: Grid2x2, accent: "pink",
    desc: "كسّر الطوب الكلاسيكي مع ليزر وكرات متعددة وطوب متفجّر.",
    descEn: "Classic brick-breaking with laser, multi-ball, and explosive bricks.",
    tagline: "ليزر · كرات متعددة · تعزيزات", taglineEn: "Laser · multi-ball · power-ups",
  },
  {
    id: "hopper", route: "/games/hopper", type: "skill", title: "Sky Hopper",
    category: "Arcade", categoryAr: "أركيد", icon: ArrowUp, accent: "green",
    desc: "اقفز صعوداً عبر المجرّة على 5 أنواع منصات وتجنّب الأعداء.",
    descEn: "Jump upward through the galaxy on 5 platform types while dodging enemies.",
    tagline: "5 منصات · أعداء · نوابض", taglineEn: "5 platforms · enemies · springs",
  },
  {
    id: "calcblast", route: "/games/calcblast", type: "skill", title: "Calc Blaster",
    category: "Math", categoryAr: "رياضيات", icon: Crosshair, accent: "cyan",
    desc: "أجب على المعادلات السريعة عبر 4 عمليات حسابية ولديك 3 محاولات.",
    descEn: "Answer rapid equations across 4 operations — 3 lives before game over.",
    tagline: "4 عمليات · 3 قلوب · تسارع", taglineEn: "4 ops · 3 lives · acceleration",
  },
  {
    id: "numsmash", route: "/games/numsmash", type: "skill", title: "Number Smash",
    category: "Math", categoryAr: "رياضيات", icon: Hammer, accent: "orange",
    desc: "5 أنواع تحدّيات بقواعد متبدّلة — فكّر بسرعة قبل نفاد القلوب.",
    descEn: "5 challenge types with shifting rules — think fast before you run out of lives.",
    tagline: "5 تحدّيات · قواعد متبدّلة · 3 قلوب", taglineEn: "5 challenges · shifting rules · 3 lives",
  },
  {
    id: "chainsum", route: "/games/chainsum", type: "skill", title: "Sum Chain",
    category: "Math", categoryAr: "رياضيات", icon: Link2, accent: "emerald",
    desc: "ارسم مساراً عبر شبكة 5×5 ليصل مجموع الأرقام إلى الهدف.",
    descEn: "Draw a path through a 5×5 grid where the sum of numbers hits the target.",
    tagline: "شبكة 5×5 · رسم مسار · سلاسل", taglineEn: "5×5 grid · path drawing · chains",
  },
  {
    id: "fracsort", route: "/games/fracsort", type: "skill", title: "Fraction Sort",
    category: "Math", categoryAr: "رياضيات", icon: Scale, accent: "violet",
    desc: "رتّب 20 كسراً فريداً بصرياً من الأصغر إلى الأكبر بثلاث محاولات.",
    descEn: "Sort 20 unique fractions visually from smallest to largest — 3 attempts.",
    tagline: "20 كسراً · بطاقة بصرية · 3 قلوب", taglineEn: "20 fractions · visual cards · 3 lives",
  },
  {
    id: "speedmath", route: "/games/speedmath", type: "skill", title: "Speed Math",
    category: "Math", categoryAr: "رياضيات", icon: Zap, accent: "yellow",
    desc: "تومض المعادلة 0.9 ثانية ثم تظهر 4 خيارات — أجب بسرعة لمكافأة السرعة!",
    descEn: "The equation flashes for 0.9s then 4 choices appear — answer fast for speed bonus!",
    tagline: "مكافأة سرعة · ×5 كومبو · 4 عمليات", taglineEn: "Speed bonus · ×5 combo · 4 ops",
  },
  {
    id: "gridpop", route: "/games/gridpop", type: "skill", title: "Grid Pop",
    category: "Puzzle", categoryAr: "ألغاز", icon: Grid2x2, accent: "pink",
    desc: "انقر الكتل المتصلة بنفس اللون لتفجيرها — 8+ دفعة واحدة لوقت إضافي.",
    descEn: "Tap connected same-color blocks to pop them — 8+ in one tap for bonus time.",
    tagline: "تعبئة فيضية · 6 ألوان · اهتزاز", taglineEn: "Flood fill · 6 colors · vibration",
  },
  {
    id: "neonlink", route: "/games/neonlink", type: "skill", title: "Neon Link",
    category: "Puzzle", categoryAr: "ألغاز", icon: GitBranch, accent: "cyan",
    desc: "اسحب خطوطاً نيونية لربط الرموز المتطابقة وتجنّب الحاجز المتحرك ⚡.",
    descEn: "Drag neon lines to connect matching symbols while avoiding the moving barrier ⚡.",
    tagline: "ربط خطوط · حاجز متحرك · أزواج متصاعدة", taglineEn: "Line linking · moving barrier · growing pairs",
  },
  {
    id: "quicksum", route: "/games/quicksum", type: "skill", title: "Quick Sum",
    category: "Math", categoryAr: "رياضيات", icon: Cpu, accent: "blue",
    desc: "انقر الأرقام التي مجموعها يساوي الهدف، ثم يتبدّل الوضع إلى الضرب فجأة!",
    descEn: "Tap numbers that sum to the target, then suddenly the mode switches to multiplication!",
    tagline: "وضعا + و× · واجهة أنيقة · حلّ سريع", taglineEn: "Modes + and × · sleek UI · quick solve",
  },
  {
    id: "match3", route: "/games/match3", type: "skill", title: "Match 3 Blitz",
    category: "Puzzle", categoryAr: "ألغاز", icon: Sparkles, accent: "purple",
    desc: "بدّل الجواهر المتوهجة لمطابقة 3 أو أكثر — 5+ تمنح كومبو وانفجارات.",
    descEn: "Swap glowing gems to match 3 or more — 5+ grants combos and explosions.",
    tagline: "شبكة 7×7 · تتالي · وقت إضافي", taglineEn: "7×7 grid · cascade · bonus time",
  },
  {
    id: "pulsetap", route: "/games/pulsetap", type: "skill", title: "Pulse Tap",
    category: "Rhythm", categoryAr: "إيقاع", icon: Target, accent: "green",
    desc: "حلقات نيون تتمدد عبر الشاشة — انقر كل واحدة عند ملامستها لحلقة الهدف.",
    descEn: "Neon rings expand across the screen — tap each one as it touches the target ring.",
    tagline: "Perfect · Great · توقيت دقيق", taglineEn: "Perfect · Great · precision timing",
  },
  {
    id: "swiperush", route: "/games/swiperush", type: "skill", title: "Swipe Rush",
    category: "Reflex", categoryAr: "ردود فعل", icon: Zap, accent: "yellow",
    desc: "يظهر سهم ضخم متوهّج — اسحب في اتجاهه قبل أن تنطبق حلقة العدّ التنازلي.",
    descEn: "A huge glowing arrow appears — swipe in its direction before the countdown ring closes.",
    tagline: "4 اتجاهات · مكافأة كومبو · سرعة", taglineEn: "4 directions · combo bonus · speed",
  },
  {
    id: "bubblepop", route: "/games/bubblepop", type: "skill", title: "Bubble Pop",
    category: "Arcade", categoryAr: "أركيد", icon: Waves, accent: "pink",
    desc: "فقاعات ملوّنة تطفو لأعلى — انقر فقط اللون المعروض في الأعلى، ثم يتغيّر.",
    descEn: "Colorful bubbles float upward — tap only the color shown at the top, which keeps changing.",
    tagline: "5 ألوان · هدف متغيّر · كومبو", taglineEn: "5 colors · changing target · combo",
  },
  {
    id: "colorrain", route: "/games/colorrain", type: "skill", title: "Color Rain",
    category: "Catcher", categoryAr: "إمساك", icon: Rocket, accent: "violet",
    desc: "ماسات نيون تتساقط — اسحب المضرب لالتقاط اللون المطابق فقط، والكومبو يصغّره.",
    descEn: "Neon diamonds fall — drag the paddle to catch only the matching color; combos shrink it.",
    tagline: "اسحب المضرب · تقلّص · 5 ألوان", taglineEn: "Drag paddle · shrink · 5 colors",
  },
  {
    id: "stackdrop", route: "/games/stackdrop", type: "skill", title: "Stack Drop",
    category: "Precision", categoryAr: "دقة", icon: Layers, accent: "cyan",
    desc: "كتلة نيون منزلقة تتأرجح يميناً ويساراً — انقر لإسقاطها بمحاذاة مثالية.",
    descEn: "A neon block slides left and right — tap to drop it perfectly aligned.",
    tagline: "تكديس كلاسيكي · تتزايد السرعة", taglineEn: "Classic stacking · speed increases",
  },
  {
    id: "orbitaim", route: "/games/orbitaim", type: "skill", title: "Orbit Aim",
    category: "Aim", categoryAr: "تصويب", icon: Orbit, accent: "orange",
    desc: "مدفع دوّار يمسح حلقة المدار بينما تظهر أهداف عشوائية — أطلق عند المحاذاة.",
    descEn: "A rotating cannon sweeps the orbit ring while random targets appear — fire when aligned.",
    tagline: "مدفع دوّار · توقيت · كومبو", taglineEn: "Rotating cannon · timing · combo",
  },
  {
    id: "echotap", route: "/games/echotap", type: "skill", title: "Echo Tap",
    category: "Memory", categoryAr: "ذاكرة", icon: Brain, accent: "purple",
    desc: "شاهد تسلسل البلاطات المتوهّجة ثم انقرها بنفس الترتيب من الذاكرة.",
    descEn: "Watch the sequence of glowing tiles, then tap them in the same order from memory.",
    tagline: "9 بلاطات · تسلسلات متنامية · ذاكرة", taglineEn: "9 tiles · growing sequences · memory",
  },
  {
    id: "mergeblitz", route: "/games/mergeblitz", type: "skill", title: "Merge Blitz",
    category: "Puzzle", categoryAr: "ألغاز", icon: Hash, accent: "amber",
    desc: "لعبة 2048 الكلاسيكية تحت ضغط زمني شديد — ادمج البلاطات قبل نفاد الوقت.",
    descEn: "Classic 2048 under intense time pressure — merge tiles before time runs out.",
    tagline: "آليات 2048 · مؤقّت · سحب", taglineEn: "2048 mechanics · timer · swipe",
  },
  {
    id: "numblitz", route: "/games/numblitz", type: "skill", title: "Number Blitz",
    category: "Speed", categoryAr: "سرعة", icon: Bolt, accent: "teal",
    desc: "أرقام مبعثرة على الشاشة — انقرها بالترتيب 1، 2، 3... بأسرع ما يمكن.",
    descEn: "Numbers scattered on screen — tap them in order 1, 2, 3... as fast as you can.",
    tagline: "نقر تسلسلي · تصاعد · سرعة", taglineEn: "Sequential tapping · ascending · speed",
  },
  {
    id: "cardflip", route: "/games/cardflip", type: "skill", title: "Card Flip",
    category: "Memory", categoryAr: "ذاكرة", icon: LayoutGrid, accent: "emerald",
    desc: "اقلب البطاقات لإيجاد أزواج الرموز المتطابقة عبر لوحات لا نهائية.",
    descEn: "Flip cards to find matching symbol pairs across infinite boards.",
    tagline: "8 أزواج · لوحات لا نهائية · ذاكرة", taglineEn: "8 pairs · infinite boards · memory",
  },
];

export const ALL_GAMES: GameDef[] = [...ARENA_GAMES, ...SKILL_GAMES];

export function getGameById(id: string): GameDef | undefined {
  return ALL_GAMES.find((g) => g.id === id);
}
