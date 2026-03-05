"use client";

import { Navbar } from "@/components/navbar";
import { ProductCard } from "@/components/product-card";
import { MOCK_PRODUCTS, CATEGORIES } from "@/app/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Filter, Search, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

export default function Marketplace() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = MOCK_PRODUCTS.filter(p => {
    const matchesCategory = selectedCategory ? p.category === selectedCategory : true;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-card border p-6 rounded-3xl shadow-sm">
            <h1 className="text-3xl font-bold font-headline shrink-0">Marketplace</h1>
            
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

          {filteredProducts.length > 0 ? (
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