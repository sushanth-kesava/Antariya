
"use client";

import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { HeroCouponBanner } from "@/components/HeroCouponBanner";
import { Footer } from "@/components/footer";
import { ProductCard } from "@/components/product-card";
import { Product } from "@/app/lib/mock-data";
import { Button } from "@/components/ui/button";
import { ArrowRight, Truck, ShieldCheck, Sparkles, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getProductsFromBackend } from "@/lib/api/products";
import { getApiBaseUrl } from "@/lib/api/base-url";
import { CURATED_HIGHLIGHTS } from "@/lib/categories";
import { ShowcaseScroller } from "@/components/showcase-scroller";

const API_BASE_URL = getApiBaseUrl();

type HeroMetrics = {
  products: number;
};

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [heroProduct, setHeroProduct] = useState<Product | null>(null);
  const [heroMetrics, setHeroMetrics] = useState<HeroMetrics>({ products: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [catalogResponse, statsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/products/featured?limit=8`, { credentials: "include" }).then(async (response) => {
            const data = await response.json();
            if (!response.ok || !data?.success) {
              return getProductsFromBackend({ limit: 8 });
            }
            return { products: data.products as Product[], pagination: { total: data.count } };
          }).catch(() => getProductsFromBackend({ limit: 8 })),
          fetch(`${API_BASE_URL}/stats/home`, { credentials: "include" }).then(async (response) => {
            const data = await response.json();
            if (!response.ok || !data?.success) {
              throw new Error(data?.message || "Failed to load home stats");
            }
            return data.stats as HeroMetrics;
          }).catch(() => ({ products: 0 })),
        ]);

        const { products, pagination } = catalogResponse as { products: Product[]; pagination: { total: number; pages: number } };
        const liveProducts = products.length > 0 ? products : [];

        setFeaturedProducts(liveProducts.slice(0, 8));
        setHeroProduct(
          [...liveProducts].sort((left, right) => {
            const ratingDelta = (Number(right.rating || 0) - Number(left.rating || 0));
            if (ratingDelta !== 0) {
              return ratingDelta;
            }
            return Number(right.stock || 0) - Number(left.stock || 0);
          })[0] || null
        );

        setHeroMetrics({
          products: statsResponse.products || pagination.total || liveProducts.length,
        });
      } catch (error) {
        console.error("Failed to load products", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <HeroCouponBanner />
      <Navbar sticky />
      
      <main className="flex-grow">
        <Hero metrics={heroMetrics} featuredProduct={heroProduct} />

        {/* Explore Antariya — Collection cards */}
        <section className="py-16 lg:py-24 border-t border-border/30">
          <div className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <p className="text-xs uppercase tracking-[0.3em] text-primary/60 mb-3">Explore Antariya</p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-headline">Find What Speaks to You.</h2>
              <p className="text-base sm:text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
                From signature embroidery to limited-edition statements, discover pieces made for individuality.
              </p>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {[
                {
                  num: "01",
                  title: "SIGNATURE\nEMBROIDERY",
                  tagline: "The pieces that define Antariya.",
                  cta: "SHOP COLLECTION",
                  href: "/marketplace?category=Collections&subCategory=Signature+Collection",
                  image: "/images/collections/signature-embroidery.png",
                },
                {
                  num: "02",
                  title: "OVERSIZED",
                  tagline: "Make your statement.",
                  cta: "SHOP OVERSIZED",
                  href: "/marketplace?category=Fit&subCategory=Oversized+Fit",
                  image: "/images/collections/oversized-tee.png",
                },
                {
                  num: "03",
                  title: "ESSENTIALS",
                  tagline: "Everyday, elevated.",
                  cta: "SHOP ESSENTIALS",
                  href: "/marketplace?category=Collections&subCategory=Essentials+Collection",
                  image: "/images/collections/motorsport-tee.jpeg",
                },
                {
                  num: "04",
                  title: "LIMITED\nEDITION",
                  tagline: "Made for the few.",
                  cta: "SHOP LIMITED",
                  href: "/marketplace?category=Collections&subCategory=Limited+Edition",
                  image: "/images/collections/limited-edition-tee.jpeg",
                },
              ].map((col, idx) => (
                <Link
                  key={col.num}
                  href={col.href}
                  className="group relative overflow-hidden rounded-2xl border border-border/40 aspect-[3/4] flex flex-col justify-end p-5 sm:p-6 hover:border-primary/40 transition-all hover:shadow-xl bg-muted/30"
                >
                  {/* Use static collection image or fallback to featured product */}
                  {(col.image || featuredProducts[idx]?.image) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={col.image || featuredProducts[idx]?.image || ""}
                      alt={col.title}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10" />
                  <div className="relative z-20 text-white space-y-2">
                    <div className="flex items-center gap-2 text-white/50 text-xs">
                      <span>{col.num}</span>
                      <span className="w-4 h-px bg-white/40" />
                    </div>
                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-black font-headline leading-[1.1] whitespace-pre-line uppercase">{col.title}</h3>
                    <p className="text-sm text-white/70">{col.tagline}</p>
                    <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-white/90 pt-2 flex items-center gap-2 group-hover:gap-3 transition-all">
                      {col.cta} <ArrowRight className="h-3 w-3" />
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Bottom CTA + brand line */}
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6">
              <Button size="lg" className="rounded-full px-10 h-14 text-sm uppercase tracking-wider font-bold" asChild>
                <Link href="/marketplace">
                  Shop All Collections <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <div className="hidden sm:flex items-center gap-3 text-muted-foreground">
                <span className="w-8 h-px bg-border" />
                <span className="text-[11px] uppercase tracking-[0.3em]">Premium Embroidered Streetwear</span>
              </div>
            </div>
          </div>
        </section>

        {/* Curated Categories — Scrolling chips */}
        <section className="py-12 overflow-hidden border-t border-border/30">
          <div className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg sm:text-xl font-bold font-headline">Shop by Style</h2>
              <Link href="/marketplace" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
              {CURATED_HIGHLIGHTS.slice(0, 10).map((highlight) => (
                <Link
                  key={highlight.label}
                  href={`/marketplace?category=${encodeURIComponent(highlight.category)}&subCategory=${encodeURIComponent(highlight.subCategory)}`}
                  className="shrink-0 px-6 py-3 rounded-full border border-border/50 bg-card hover:bg-primary/5 hover:border-primary/30 transition-all text-sm font-medium whitespace-nowrap"
                >
                  {highlight.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Featured Products */}
        <section className="py-16 lg:py-24 border-t border-border/30">
          <div className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-12">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-2">Curated For You</p>
                <h2 className="text-3xl sm:text-4xl font-bold font-headline">Bestsellers</h2>
              </div>
              <Button variant="outline" size="sm" className="rounded-full px-6" asChild>
                <Link href="/marketplace">View All</Link>
              </Button>
            </div>
            
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="aspect-[3/4] bg-muted animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {featuredProducts.slice(0, 8).map((product, index) => (
                  <div
                    key={product.id}
                    style={{ animationDelay: `${index * 80}ms` }}
                    className="animate-fade-in opacity-0"
                  >
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-16 text-center">
              <Button size="lg" className="rounded-full px-12 h-14 text-base" asChild>
                <Link href="/marketplace">
                  Explore Full Collection <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Featured Showcase — Apple-style vertical-scroll-to-horizontal */}
        <section className="border-t border-border/30 overflow-hidden" id="showcase">
          <div className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-12 lg:py-16">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-headline">New Arrivals</h2>
            </div>
          </div>

          {!loading && featuredProducts.length > 0 && (
            <ShowcaseScroller products={featuredProducts} />
          )}
        </section>

        {/* Trust Signals */}
        <section className="py-16 lg:py-24 border-t border-border/30">
          <div className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto text-primary">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-sm sm:text-base">Handcrafted Quality</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">Each piece embroidered with precision by skilled Indian artisans.</p>
              </div>
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto text-primary">
                  <Truck className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-sm sm:text-base">Pan-India Delivery</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">Free shipping on orders above ₹999. Delivered to your doorstep.</p>
              </div>
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto text-primary">
                  <RotateCcw className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-sm sm:text-base">Easy Returns</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">7-day hassle-free returns on all physical products.</p>
              </div>
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto text-primary">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-sm sm:text-base">Secure Payments</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">100% secure checkout with UPI, cards, and net banking.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Newsletter / CTA */}
        <section className="py-20 lg:py-28 border-t border-border/30 bg-muted/30">
          <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Stay Connected</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-headline">
              Join the Antariya World
            </h2>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto">
              Be the first to know about new drops, limited editions, and exclusive offers.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
              <Button size="lg" className="rounded-full px-10 h-14 text-base flex-1" asChild>
                <Link href="/signup">
                  Create Account
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-10 h-14 text-base" asChild>
                <Link href="/shop">
                  Start Shopping
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
