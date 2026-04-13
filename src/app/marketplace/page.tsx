
"use client";

import { Navbar } from "@/components/navbar";
import { ProductCard } from "@/components/product-card";
import { CATEGORIES, Product } from "@/app/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Filter, Search, ChevronDown, RefreshCw, Sparkles, Palette, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { getProductsFromBackend } from "@/lib/api/products";

export default function Marketplace() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const data = await getProductsFromBackend({ category: selectedCategory || undefined });
        setProducts(data);
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedCategory]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6 py-12">
        <div className="flex flex-col gap-10">
          
          {/* Enhanced Links Hero Section */}
          <div className="relative rounded-[40px] overflow-hidden bg-primary text-white p-10 md:p-14 shadow-2xl">
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
              <Sparkles className="w-full h-full" />
            </div>
            <div className="relative z-10 max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-bold tracking-wide">
                <Sparkles className="h-4 w-4 text-accent" /> Over 10,000 Premium Assets
              </div>
              <h1 className="text-4xl md:text-6xl font-black font-headline leading-tight tracking-tight">
                The Digital <br />
                <span className="text-accent italic font-normal">Embroidery</span> Library.
              </h1>
              <p className="text-lg md:text-xl text-white/80 leading-relaxed font-medium">
                Browse our world-class marketplace for digital designs, premium threads, and high-speed machine supplies. 
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <Button asChild size="lg" className="rounded-full h-14 px-8 bg-accent text-accent-foreground font-bold text-lg hover:scale-105 hover:bg-accent/90 transition-all shadow-xl shadow-accent/20">
                  <Link href="/customize">
                    <Palette className="mr-2 h-5 w-5" /> Open Builder 
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-full h-14 px-8 bg-white/10 border-white/20 text-white font-bold text-lg hover:bg-white/20 transition-all">
                  <Link href="/shop">
                    <ShoppingBag className="mr-2 h-5 w-5" /> Shop Base Garments 
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-card border border-border/50 p-6 rounded-3xl shadow-sm">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold font-headline shrink-0 tracking-tight">Catalogue</h1>
              <p className="text-muted-foreground text-sm font-medium">Find your next project materials</p>
            </div>
            
            <div className="flex-1 max-w-2xl w-full relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                className="pl-12 h-14 rounded-2xl bg-muted/50 border-none text-lg focus-visible:ring-primary" 
                placeholder="Search products..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" className="rounded-xl h-14 px-6 border-border font-bold">
                <Filter className="h-5 w-5 mr-2" /> Filters
              </Button>
              <Button className="rounded-xl h-14 px-6 font-bold shadow-lg shadow-primary/20">
                Sort By <ChevronDown className="h-5 w-5 ml-2" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge 
              variant={selectedCategory === null ? "default" : "outline"} 
              className="cursor-pointer px-4 py-2 rounded-full border-primary/20"
              onClick={() => setSelectedCategory(null)}
            >
              All Items
            </Badge>
            {CATEGORIES.map(cat => (
              <Badge 
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                className="cursor-pointer px-4 py-2 rounded-full border-primary/20"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
              <RefreshCw className="h-12 w-12 text-primary animate-spin" />
              <p className="text-muted-foreground font-medium">Loading premium catalogue...</p>
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-32 space-y-6">
              <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground">
                <Search className="h-12 w-12" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">No products found</h3>
                <p className="text-muted-foreground">Try adjusting your filters or search query to find what you're looking for.</p>
              </div>
              <Button variant="link" onClick={() => { setSelectedCategory(null); setSearchQuery(""); }}>
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
