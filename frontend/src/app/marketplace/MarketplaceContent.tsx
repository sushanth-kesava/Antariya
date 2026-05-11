"use client";

import { Navbar } from "@/components/navbar";
import { ProductCard } from "@/components/product-card";
import { Product } from "@/app/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Filter, Search, ChevronDown, RefreshCw, Sparkles, Palette, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  MarketplaceDealerSection,
  MarketplaceLayoutResponse,
  MarketplaceRole,
  getMarketplaceLayoutFromBackend,
  getProductsFromBackend,
} from "@/lib/api/products";

type SortOption = "relevance" | "price_asc" | "price_desc" | "rating" | "newest";

const SORT_LABELS: Record<SortOption, string> = {
  relevance: "Relevance",
  price_asc: "Price: Low to High",
  price_desc: "Price: High to Low",
  rating: "Highest Rated",
  newest: "Newest First",
};

const ROLE_TITLES: Record<MarketplaceRole, { eyebrow: string; title: string; description: string; ctaHref: string; ctaLabel: string }> = {
  customer: {
    eyebrow: "Customer Catalog",
    title: "Browse finished apparel and custom-ready styles.",
    description: "Find fashion articles, dresses, hoodies, and other customer-facing categories curated for shopping.",
    ctaHref: "/shop",
    ctaLabel: "Shop Collection",
  },
  admin: {
    eyebrow: "Admin Supply Catalog",
    title: "Inventory for production and machine operations.",
    description: "Manage the operational catalog with threads, needles, spare parts, and related workshop stock.",
    ctaHref: "/portal/admin/my-company-catalog",
    ctaLabel: "Open Catalog",
  },
  superadmin: {
    eyebrow: "Superadmin Marketplace",
    title: "All products grouped by dealer and category.",
    description: "Review the full product database, organized by dealer ownership and product category.",
    ctaHref: "/portal/superadmin",
    ctaLabel: "Open Overview",
  },
};

function sortProducts(products: Product[], sort: SortOption): Product[] {
  const copy = [...products];

  switch (sort) {
    case "price_asc":
      return copy.sort((a, b) => Number(a.price) - Number(b.price));
    case "price_desc":
      return copy.sort((a, b) => Number(b.price) - Number(a.price));
    case "rating":
      return copy.sort((a, b) => Number(b.rating) - Number(a.rating));
    case "newest":
      return copy.reverse();
    default:
      return copy;
  }
}

export default function MarketplaceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(searchParams.get("category") || null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [activeSearch, setActiveSearch] = useState(searchParams.get("search") || "");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>("relevance");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [minRating, setMinRating] = useState<number | null>(null);
  const [roleResolved, setRoleResolved] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_PAGE = 20;

  const [role, setRole] = useState<MarketplaceRole>("customer");
  const [marketplaceLayout, setMarketplaceLayout] = useState<MarketplaceLayoutResponse | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    try {
      const pathRole: MarketplaceRole = pathname?.startsWith("/portal/superadmin")
        ? "superadmin"
        : pathname?.startsWith("/portal/admin")
          ? "admin"
          : "customer";

      const stored = typeof window !== "undefined" ? localStorage.getItem("user_role") : null;
      const storedRole = stored?.trim().toLowerCase();

      if (pathRole !== "customer") {
        setRole(pathRole);
      } else if (storedRole === "admin" || storedRole === "superadmin") {
        setRole(storedRole);
      } else {
        setRole("customer");
      }
    } catch {
      setRole("customer");
    } finally {
      setRoleResolved(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (!roleResolved) {
      return;
    }

    let cancelled = false;

    async function fetchLayout() {
      try {
        const data = await getMarketplaceLayoutFromBackend(role);
        if (!cancelled) {
          setMarketplaceLayout(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load marketplace layout:", error);
        }
      }
    }

    fetchLayout();

    return () => {
      cancelled = true;
    };
  }, [role, roleResolved]);

  useEffect(() => {
    if (!roleResolved || role === "superadmin") {
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        const { products: data, pagination } = await getProductsFromBackend({
          category: selectedCategory || undefined,
          search: activeSearch || undefined,
          page: 1,
          limit: ITEMS_PER_PAGE,
        });

        if (cancelled) return;

        setProducts(data);
        setCurrentPage(1);
        setTotalPages(pagination.pages);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch products:", error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [selectedCategory, activeSearch, role, roleResolved]);

  useEffect(() => {
    if (role === "superadmin") {
      setSelectedCategory(null);
      setPriceMin("");
      setPriceMax("");
      setMinRating(null);
    }
  }, [role]);

  const heroCopy = ROLE_TITLES[role];

  const loadMore = async () => {
    if (currentPage >= totalPages || loadingMore) return;

    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const { products: data } = await getProductsFromBackend({
        category: selectedCategory || undefined,
        search: activeSearch || undefined,
        page: nextPage,
        limit: ITEMS_PER_PAGE,
      });

      setProducts((prev) => [...prev, ...data]);
      setCurrentPage(nextPage);
    } catch (error) {
      console.error("Failed to load more products", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
  };

  const handleCategoryChange = (cat: string | null) => {
    setSelectedCategory(cat);
  };

  const handleClearAll = () => {
    setSelectedCategory(null);
    setSearchQuery("");
    setActiveSearch("");
    setSortBy("relevance");
    setPriceMin("");
    setPriceMax("");
    setMinRating(null);
    router.replace("/marketplace");
  };

  let displayProducts = [...products];

  if (priceMin !== "") {
    displayProducts = displayProducts.filter((p) => Number(p.price) >= Number(priceMin));
  }
  if (priceMax !== "") {
    displayProducts = displayProducts.filter((p) => Number(p.price) <= Number(priceMax));
  }
  if (minRating !== null) {
    displayProducts = displayProducts.filter((p) => Number(p.rating) >= minRating);
  }

  displayProducts = sortProducts(displayProducts, sortBy);

  const activeFilterCount =
    (selectedCategory ? 1 : 0) +
    (priceMin ? 1 : 0) +
    (priceMax ? 1 : 0) +
    (minRating ? 1 : 0);

  const marketplaceCategories =
    role !== "superadmin" && marketplaceLayout && marketplaceLayout.success && "categories" in marketplaceLayout
      ? marketplaceLayout.categories
      : [];
  const marketplaceDealerSections =
    role === "superadmin" && marketplaceLayout && marketplaceLayout.success && "dealerSections" in marketplaceLayout
      ? marketplaceLayout.dealerSections
      : [];
  const quickPickCategories = marketplaceCategories.slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6 py-12">
        <div className="flex flex-col gap-10">
          <div className="relative rounded-[40px] overflow-hidden bg-primary text-white p-10 md:p-14 shadow-2xl">
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
              <Sparkles className="w-full h-full" />
            </div>
            <div className="relative z-10 max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-bold tracking-wide">
                <Sparkles className="h-4 w-4 text-accent" /> {heroCopy.eyebrow}
              </div>
              <h1 className="text-4xl md:text-6xl font-black font-headline leading-tight tracking-tight">
                {heroCopy.title}
              </h1>
              <p className="text-lg md:text-xl text-white/80 leading-relaxed font-medium">
                {heroCopy.description}
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <Button asChild size="lg" className="rounded-full h-14 px-8 bg-accent text-accent-foreground font-bold text-lg hover:scale-105 hover:bg-accent/90 transition-all shadow-xl shadow-accent/20">
                  <Link href={heroCopy.ctaHref}>
                    <Palette className="mr-2 h-5 w-5" /> {heroCopy.ctaLabel}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-full h-14 px-8 bg-white/10 border-white/20 text-white font-bold text-lg hover:bg-white/20 transition-all">
                  <Link href={role === "customer" ? "/customize" : role === "admin" ? "/portal/admin" : "/portal/superadmin"}>
                    <ShoppingBag className="mr-2 h-5 w-5" /> {role === "customer" ? "Open Builder" : role === "admin" ? "Admin Console" : "Full Inventory"}
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-card border border-border/50 p-6 rounded-3xl shadow-sm">
            <div className="space-y-1 shrink-0">
              <h1 className="text-3xl font-bold font-headline tracking-tight">{role === "superadmin" ? "Inventory Overview" : "Catalogue"}</h1>
              <p className="text-muted-foreground text-sm font-medium">
                {loading
                  ? "Loading..."
                  : role === "superadmin"
                    ? `Showing ${marketplaceDealerSections.length} dealers`
                    : `Showing ${displayProducts.length} items`}
              </p>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex-1 max-w-2xl w-full relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                className="pl-12 h-14 rounded-2xl bg-muted/50 border-none text-lg focus-visible:ring-primary"
                placeholder={role === "superadmin" ? "Search inventory..." : "Search products..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveSearch("");
                  }}
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </form>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="outline"
                className="rounded-xl h-14 px-6 border-border font-bold relative"
                onClick={() => setFilterOpen((v) => !v)}
              >
                <Filter className="h-5 w-5 mr-2" /> Filters
                {activeFilterCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-primary">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>

              <div className="relative" ref={sortRef}>
                <Button
                  type="button"
                  className="rounded-xl h-14 px-6 font-bold shadow-lg shadow-primary/20"
                  onClick={() => setSortOpen((v) => !v)}
                >
                  {SORT_LABELS[sortBy]} <ChevronDown className="h-5 w-5 ml-2" />
                </Button>
                {sortOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
                    {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                      <button
                        key={key}
                        className={`w-full text-left px-4 py-3 text-sm font-medium hover:bg-muted transition-colors ${sortBy === key ? "text-primary bg-primary/5" : ""}`}
                        onClick={() => {
                          setSortBy(key);
                          setSortOpen(false);
                        }}
                      >
                        {SORT_LABELS[key]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {filterOpen && (
            <div className="rounded-3xl border border-border/50 bg-card p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">Advanced Filters</h3>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-muted-foreground"
                    onClick={() => {
                      setPriceMin("");
                      setPriceMax("");
                      setMinRating(null);
                    }}
                  >
                    Reset
                  </Button>
                  <Button size="sm" className="rounded-full" onClick={() => setFilterOpen(false)}>
                    Apply
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <p className="font-semibold text-sm">Price Range (₹)</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      className="h-10 rounded-xl"
                    />
                    <span className="text-muted-foreground">—</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      className="h-10 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="font-semibold text-sm">Minimum Rating</p>
                  <div className="flex gap-2">
                    {[null, 3, 4, 4.5].map((rating) => (
                      <Button
                        key={String(rating)}
                        type="button"
                        size="sm"
                        variant={minRating === rating ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => setMinRating(rating)}
                      >
                        {rating === null ? "All" : `${rating}+`}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="font-semibold text-sm">Quick Picks</p>
                  <div className="flex flex-wrap gap-2">
                    {quickPickCategories.length > 0 ? (
                      quickPickCategories.map((category) => (
                        <Button
                          key={category}
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => {
                            setSelectedCategory(category);
                            setFilterOpen(false);
                          }}
                        >
                          {category}
                        </Button>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Loading categories...</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Role-specific categories */}
          <div className="flex flex-col gap-4">
            {role !== "superadmin" ? (
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={selectedCategory === null ? "default" : "outline"}
                  className="cursor-pointer px-4 py-2 rounded-full border-primary/20"
                  onClick={() => handleCategoryChange(null)}
                >
                  All Items
                </Badge>
                {marketplaceCategories.map((cat: string) => (
                  <Badge
                    key={cat}
                    variant={selectedCategory === cat ? "default" : "outline"}
                    className="cursor-pointer px-4 py-2 rounded-full border-primary/20"
                    onClick={() => handleCategoryChange(cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {marketplaceDealerSections.length === 0 && !loading ? (
                  <p className="text-sm text-muted-foreground">No dealer data available.</p>
                ) : (
                  marketplaceDealerSections.map((dealerSection: MarketplaceDealerSection) => (
                    <div key={dealerSection.dealerId} className="border border-border/50 rounded-2xl p-4 bg-card">
                      <h3 className="font-semibold">{dealerSection.dealerName}</h3>
                      <div className="mt-3 grid grid-cols-1 gap-4">
                        {dealerSection.categories.map((category) => (
                          <div key={category.name} className="p-3 bg-muted/5 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{category.name}</span>
                              <Badge className="text-xs">{category.count}</Badge>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                              {category.products.slice(0, 6).map((product: Product) => (
                                <ProductCard key={product.id} product={product} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {(activeSearch || activeFilterCount > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground font-medium">Active filters:</span>
              {activeSearch && (
                <Badge variant="secondary" className="rounded-full gap-1 pl-3 pr-2 py-1">
                  Search: {activeSearch}
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setActiveSearch("");
                    }}
                    className="hover:text-destructive ml-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedCategory && (
                <Badge variant="secondary" className="rounded-full gap-1 pl-3 pr-2 py-1">
                  {selectedCategory}
                  <button onClick={() => setSelectedCategory(null)} className="hover:text-destructive ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {priceMin && (
                <Badge variant="secondary" className="rounded-full gap-1 pl-3 pr-2 py-1">
                  Min ₹{priceMin}
                  <button onClick={() => setPriceMin("")} className="hover:text-destructive ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {priceMax && (
                <Badge variant="secondary" className="rounded-full gap-1 pl-3 pr-2 py-1">
                  Max ₹{priceMax}
                  <button onClick={() => setPriceMax("")} className="hover:text-destructive ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {minRating !== null && (
                <Badge variant="secondary" className="rounded-full gap-1 pl-3 pr-2 py-1">
                  Rating {minRating}+
                  <button onClick={() => setMinRating(null)} className="hover:text-destructive ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-destructive" onClick={handleClearAll}>
                Clear all
              </Button>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
              <RefreshCw className="h-12 w-12 text-primary animate-spin" />
              <p className="text-muted-foreground font-medium">Loading premium catalogue...</p>
            </div>
          ) : role === "superadmin" ? null : displayProducts.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {displayProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {currentPage < totalPages && (
                <div className="flex justify-center py-8">
                  <Button onClick={loadMore} disabled={loadingMore} className="h-14 px-8 rounded-2xl font-bold text-lg">
                    {loadingMore ? (
                      <>
                        <RefreshCw className="inline mr-2 h-4 w-4 animate-spin" /> Loading...
                      </>
                    ) : (
                      `Load More (${currentPage}/${totalPages})`
                    )}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-32 space-y-6">
              <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground">
                <Search className="h-12 w-12" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">No products found</h3>
                <p className="text-muted-foreground">Try adjusting your filters or search query.</p>
              </div>
              <Button variant="link" onClick={handleClearAll}>
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
