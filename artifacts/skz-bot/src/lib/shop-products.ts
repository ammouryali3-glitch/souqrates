export type Category =
  | "All"
  | "📚 كتب مترجمة"
  | "🎓 كورسات"
  | "📐 قوالب"
  | "💻 برمجة"
  | "🎨 تصميم"
  | "💼 أعمال"
  | "🤖 ذكاء اصطناعي"
  | "📊 مالية";

export interface Product {
  id: number;
  title: string;
  titleAr: string;
  category: Category;
  price: number;
  pages: number;
  desc: string;
  badge?: "BESTSELLER" | "NEW" | "FREE" | "HOT" | "TOP";
  rating: number;
  downloads: number;
  image: string;
}

export const CATEGORIES: Category[] = [
  "All",
  "📚 كتب مترجمة",
  "🎓 كورسات",
  "📐 قوالب",
  "💻 برمجة",
  "🎨 تصميم",
  "💼 أعمال",
  "🤖 ذكاء اصطناعي",
  "📊 مالية",
];

export const products: Product[] = [];
