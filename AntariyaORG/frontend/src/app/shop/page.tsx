
"use client";

import { Navbar } from "@/components/navbar";
import { ProductCard } from "@/components/product-card";
import { Product } from "@/app/lib/mock-data";
import { Search, RefreshCw, Sparkles, Filter } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getProductsFromBackend } from "@/lib/api/products";

export default function ShoppingPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      try {
        const { products: data, pagination } = await getProductsFromBackend({ 
          customizable: true,
          page: 1,
          limit: ITEMS_PER_PAGE,
        });
        setProducts(data);
        setCurrentPage(1);
        setTotalPages(pagination.pages);
      } catch (error) {
        console.error("Failed to fetch customizable products", error);
      } finally {
        setLoading(false);
      }
    };

    void loadProducts();
  }, []);

  const loadMore = async () => {
    if (currentPage >= totalPages || loadingMore) return;
    
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const { products: data } = await getProductsFromBackend({ 
        customizable: true,
        page: nextPage,
        limit: ITEMS_PER_PAGE,
      });
      setProducts(prev => [...prev, ...data]);
      setCurrentPage(nextPage);
    } catch (error) {
      console.error("Failed to load more products", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products
      .filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [products, searchQuery]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6 py-16">
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
                    Open Builder
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
              <p className="text-muted-foreground text-sm">Showing {filteredProducts.length} items</p>
            </div>
            
            <div className="flex flex-1 max-w-xl w-full gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  className="w-full pl-12 h-14 rounded-2xl bg-muted/50 border-none text-lg focus:outline-none focus:ring-2 focus:ring-primary" 
                  placeholder="Search hoodies, blouses..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                type="button"
                title="Filter products"
                aria-label="Filter products"
                className="h-14 w-14 flex items-center justify-center rounded-2xl border border-border bg-card hover:bg-muted transition-colors"
              >
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
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
                {filteredProducts.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {currentPage < totalPages && (
                <div className="flex justify-center py-8">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="h-14 px-8 rounded-2xl bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
                  >
                    {loadingMore ? (
                      <>
                        <RefreshCw className="inline mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      `Load More (${currentPage}/${totalPages})`
                    )}
                  </button>
                </div>
              )}
            </>
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
