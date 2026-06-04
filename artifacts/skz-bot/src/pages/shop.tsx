import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Filter, ShoppingCart, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const categories = ["All", "Books", "Courses", "Templates", "Tools"];

const products = [
  { id: 1, title: "Crypto Trading Masterclass", category: "Courses", price: 500, desc: "A-Z guide on market cycles and advanced technical analysis.", image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=500&auto=format&fit=crop&q=60" },
  { id: 2, title: "Alpha Defi Signals", category: "Tools", price: 150, desc: "1 month access to premium on-chain alerts.", image: "https://images.unsplash.com/photo-1641332424075-8eb648174526?w=500&auto=format&fit=crop&q=60" },
  { id: 3, title: "Notion Life OS", category: "Templates", price: 45, desc: "Ultimate productivity system template.", image: "https://images.unsplash.com/photo-1555421689-d68471e189f2?w=500&auto=format&fit=crop&q=60" },
  { id: 4, title: "Mindset of a Winner", category: "Books", price: 25, desc: "E-book on trading psychology and discipline.", image: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=500&auto=format&fit=crop&q=60" },
  { id: 5, title: "Automated Trading Bot", category: "Tools", price: 1200, desc: "Python script with pre-configured RSI strategies.", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&auto=format&fit=crop&q=60" },
  { id: 6, title: "Web3 Dev Course", category: "Courses", price: 800, desc: "Learn Solidity and smart contract security.", image: "https://images.unsplash.com/photo-1639762681485-074b7f4ec651?w=500&auto=format&fit=crop&q=60" },
];

export default function Shop() {
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");

  const filteredProducts = products.filter(p => {
    if (activeTab !== "All" && p.category !== activeTab) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-1">Premium digital assets & tools</p>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search products..." 
            className="pl-9 bg-card/40 border-white/10 rounded-xl focus-visible:ring-primary h-11"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === cat 
                  ? 'bg-primary text-primary-foreground shadow-[0_0_10px_rgba(212,175,55,0.3)]' 
                  : 'bg-card/40 text-muted-foreground hover:bg-card/60 border border-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2 pb-10">
        {filteredProducts.map((product, i) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="flex flex-col bg-card/40 border border-white/5 rounded-2xl overflow-hidden group"
          >
            <div className="aspect-square w-full bg-muted relative overflow-hidden">
              <img 
                src={product.image} 
                alt={product.title} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-[10px] font-medium px-2 py-0.5 rounded text-white/90">
                {product.category}
              </div>
            </div>
            
            <div className="p-3 flex flex-col flex-1 justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h4 className="text-sm font-semibold text-white leading-tight line-clamp-2">{product.title}</h4>
                <p className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">{product.desc}</p>
              </div>
              
              <div className="flex items-center justify-between mt-auto">
                <span className="text-sm font-bold text-primary">{product.price} <span className="text-[10px] font-medium text-muted-foreground">SKZ</span></span>
                <Button size="icon" className="h-7 w-7 rounded-lg bg-white/10 hover:bg-primary hover:text-primary-foreground text-white border-0">
                  <ShoppingCart size={14} />
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
