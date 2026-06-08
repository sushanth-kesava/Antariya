"use client";

import { Navbar } from "@/components/navbar";
import { ProductCard } from "@/components/product-card";
import { Product } from "@/app/lib/mock-data";
import { Search, RefreshCw, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getProductsFromBackend } from "@/lib/api/products";

export default function HoodieCatalog() {
  const [searchQuery, setSearchQuery] = useState("");
  const [hoodies, setHoodies] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHoodies = async () => {
      setLoading(true);
      try {
        const { products } = await getProductsFromBackend({ category: "Hoodies" });
        setHoodies(products);
      } catch (error) {
        console.error("Failed to load hoodies", error);
      } finally {
        setLoading(false);
      }
    };

    void loadHoodies();
  }, []);

  const filteredHoodies = hoodies.filter(
    (p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6 py-16">
        <div className="flex flex-col gap-12">
          {/* Hero Banner for Hoodies */}
          <div className="relative rounded-[40px] overflow-hidden bg-secondary text-white p-12 md:p-20 shadow-2xl">
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
              <Sparkles className="w-full h-full" />
            </div>
            <div className="relative z-10 max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-bold">
                <Sparkles className="h-4 w-4 text-accent" /> Custom Apparel Collection
              </div>
              <h1 className="text-5xl md:text-7xl font-bold font-headline leading-tight">
                Your Style, <br />Our <span className="text-accent italic">Stitches</span>
              </h1>
              <p className="text-xl text-white/80">
                Premium quality hoodies designed for longevity and style. Choose a base and use the builder to customize your perfect piece.
              </p>
              <div className="flex gap-4 pt-4">
                <Link href="/customize">
                  <button className="h-14 px-8 rounded-2xl bg-accent text-accent-foreground font-bold text-lg shadow-xl shadow-accent/20 hover:scale-105 transition-all">
                    Start Customizing
                  </button>
                </Link>
                <button className="h-14 px-8 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-lg hover:bg-white/20 transition-all">
                  View Size Guide
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <h2 className="text-3xl font-bold font-headline">Explore Hoodies</h2>
            <div className="relative max-w-md w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input 
                className="w-full pl-12 h-14 rounded-2xl bg-card border border-border/50 text-lg focus:outline-none focus:ring-2 focus:ring-primary" 
                placeholder="Search premium hoodies..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
              <RefreshCw className="h-12 w-12 text-primary animate-spin" />
              <p className="text-muted-foreground font-medium">Loading hoodie collection...</p>
            </div>
          ) : filteredHoodies && filteredHoodies.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
              {filteredHoodies.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-32 space-y-6 bg-muted/30 rounded-[40px] border border-dashed border-border">
              <div className="w-24 h-24 bg-card rounded-full flex items-center justify-center mx-auto text-muted-foreground shadow-sm">
                <Search className="h-10 w-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">No hoodies found</h3>
                <p className="text-muted-foreground">Try a different search term or explore other categories.</p>
              </div>
              <button 
                className="text-primary font-bold hover:underline"
                onClick={() => setSearchQuery("")}
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
