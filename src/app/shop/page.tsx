"use client";

import { Navbar } from "@/components/navbar";
import { ProductCard } from "@/components/product-card";
import { Product } from "@/app/lib/mock-data";
import { Search, RefreshCw, Sparkles, Filter } from "lucide-react";
import { useState, useMemo } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function ShoppingPage() {
  const db = useFirestore();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all customizable products for the Shop
  const shopQuery = useMemo(() => {
    return query(
      collection(db, "products"), 
      where("customizable", "==", true),
      orderBy("createdAt", "desc")
    );
  }, [db]);

  const { data: products, loading } = useCollection<Product>(shopQuery);

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-16">
        <div className="flex flex-col gap-12">
          {/* Hero Banner for Custom Shop */}
          <div className="relative rounded-[40px] overflow-hidden bg-secondary text-white p-12 md:p-20 shadow-2xl">
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
              <Sparkles className="w-full h-full" />
            </div>
            <div className="relative z-10 max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-bold">
                <Sparkles className="h-4 w-4 text-accent" /> Premium Canvas Collection
              </div>
              <h1 className="text-5xl md:text-7xl font-bold font-headline leading-tight">
                Designed to be <br /><span className="text-accent italic">Customized</span>
              </h1>
              <p className="text-xl text-white/80">
                Explore our curated range of high-quality garments. From heavy-duty cotton hoodies to elegant silk blouse pieces, every item here is a blank canvas for your creativity.
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                <Link href="/customize">
                  <button className="h-14 px-8 rounded-2xl bg-accent text-accent-foreground font-bold text-lg shadow-xl shadow-accent/20 hover:scale-105 transition-all">
                    Open AI Studio
                  </button>
                </Link>
                <button className="h-14 px-8 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-lg hover:bg-white/20 transition-all">
                  Bulk Orders
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-card border border-border/50 p-6 rounded-3xl">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold font-headline">Apparel Catalog</h2>
              <p className="text-muted-foreground text-sm">Showing all customizable base garments</p>
            </div>
            
            <div className="flex flex-1 max-w-xl w-full gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input 
                  className="w-full pl-12 h-14 rounded-2xl bg-muted/50 border-none text-lg focus:outline-none focus:ring-2 focus:ring-primary" 
                  placeholder="Search hoodies, blouses..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="h-14 w-14 flex items-center justify-center rounded-2xl border border-border bg-card hover:bg-muted transition-colors">
                <Filter className="h-5 w-5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
              <RefreshCw className="h-12 w-12 text-primary animate-spin" />
              <p className="text-muted-foreground font-medium">Fetching premium catalogue...</p>
            </div>
          ) : filteredProducts && filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-32 space-y-6 bg-muted/30 rounded-[40px] border border-dashed border-border">
              <div className="w-24 h-24 bg-card rounded-full flex items-center justify-center mx-auto text-muted-foreground shadow-sm">
                <Search className="h-10 w-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">No matches found</h3>
                <p className="text-muted-foreground">We couldn't find any products matching your search in the custom catalog.</p>
              </div>
              <button 
                className="text-primary font-bold hover:underline"
                onClick={() => setSearchQuery("")}
              >
                Show all products
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
