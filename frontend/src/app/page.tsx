
"use client";

import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { HeroCouponBanner } from "@/components/HeroCouponBanner";
import { Footer } from "@/components/footer";
import { ProductCard } from "@/components/product-card";
import { Product } from "@/app/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, ShieldCheck, Truck, RefreshCcw, ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getProductsFromBackend } from "@/lib/api/products";
import { getApiBaseUrl } from "@/lib/api/base-url";

const API_BASE_URL = getApiBaseUrl();

type HeroMetrics = {
  products: number;
  dealers: number;
  categories: number;
  orders: number;
};

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [heroProduct, setHeroProduct] = useState<Product | null>(null);
  const [heroMetrics, setHeroMetrics] = useState<HeroMetrics>({ products: 0, dealers: 0, categories: 0, orders: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [catalogResponse, statsResponse, layoutResponse] = await Promise.all([
          getProductsFromBackend({ limit: 500 }),
          fetch(`${API_BASE_URL}/stats/home`, { credentials: "include" }).then(async (response) => {
            const data = await response.json();

            if (!response.ok || !data?.success) {
              throw new Error(data?.message || "Failed to load home stats");
            }

            return data.stats as HeroMetrics;
          }),
          fetch(`${API_BASE_URL}/products/marketplace?role=customer`, { credentials: "include" }).then(async (response) => {
            const data = await response.json();

            if (!response.ok || !data?.success) {
              return [];
            }

            return (data.categories as string[]) || [];
          }).catch(() => []),
        ]);

        const { products, pagination } = catalogResponse;
        const liveProducts = products.length > 0 ? products : [];
        const fetchedCategories = layoutResponse.length > 0 ? layoutResponse : Array.from(new Set(liveProducts.map((product) => product.category).filter(Boolean)));

        setFeaturedProducts(liveProducts.slice(0, 4));
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
          dealers: statsResponse.dealers || new Set(liveProducts.map((product) => product.dealerId).filter(Boolean)).size,
          categories: statsResponse.categories || fetchedCategories.length,
          orders: statsResponse.orders || 0,
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
      <Navbar />
      
      <main className="flex-grow">
        <Hero metrics={heroMetrics} featuredProduct={heroProduct} />

        {/* Featured Products */}
        <section className="py-20">
          <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-4xl font-bold font-headline">Bestsellers in India</h2>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-full">Latest</Button>
                  <Button variant="outline" size="sm" className="rounded-full">Trending</Button>
                </div>
              </div>
            </div>
            
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="aspect-square bg-muted animate-pulse rounded-3xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {featuredProducts.map((product, index) => (
                  <div
                    key={product.id}
                    style={{ animationDelay: `${index * 100}ms` }}
                    className="animate-fade-in opacity-0"
                  >
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-12 text-center">
              <Button size="lg" variant="outline" className="rounded-full border-primary text-primary px-10" asChild>
                <Link href="/marketplace">Explore Full Marketplace</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="py-20 bg-primary/5">
          <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6">
            <div className="grid md:grid-cols-4 gap-8 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-card rounded-2xl shadow-sm border border-border/50 flex items-center justify-center mx-auto text-primary">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <h3 className="font-bold text-lg">Quality Assured</h3>
                <p className="text-sm text-muted-foreground">All products from verified dealers and manufacturers.</p>
              </div>
              <div className="space-y-4">
                <div className="w-16 h-16 bg-card rounded-2xl shadow-sm border border-border/50 flex items-center justify-center mx-auto text-primary">
                  <Truck className="h-8 w-8" />
                </div>
                <h3 className="font-bold text-lg">Pan India Delivery</h3>
                <p className="text-sm text-muted-foreground">Fastest shipping to every corner of India for your peace of mind.</p>
              </div>
              <div className="space-y-4">
                <div className="w-16 h-16 bg-card rounded-2xl shadow-sm border border-border/50 flex items-center justify-center mx-auto text-primary">
                  <RefreshCcw className="h-8 w-8" />
                </div>
                <h3 className="font-bold text-lg">Hassle-free Returns</h3>
                <p className="text-sm text-muted-foreground">Easy 7-day return policy for physical tools and threads.</p>
              </div>
              <div className="space-y-4">
                <div className="w-16 h-16 bg-card rounded-2xl shadow-sm border border-border/50 flex items-center justify-center mx-auto text-primary">
                  <Zap className="h-8 w-8" />
                </div>
                <h3 className="font-bold text-lg">Instant Downloads</h3>
                <p className="text-sm text-muted-foreground">Get your embroidery designs immediately after purchase.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Admin Upgrade Request */}
        <section className="py-20">
          <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6">
            <div className="relative overflow-hidden bg-gradient-to-br from-stone-950 via-red-950 to-stone-800 rounded-3xl p-8 lg:p-16 shadow-2xl border border-stone-900/20">
              <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

              <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] items-center">
                <div className="space-y-6 text-white text-center lg:text-left">
                  <Badge className="rounded-full bg-white/10 text-white border-white/10 hover:bg-white/10 w-fit mx-auto lg:mx-0">
                    Admin access application
                  </Badge>
                  <h2 className="text-4xl lg:text-5xl font-black font-theseasons">Apply for admin access from one place</h2>
                  <p className="text-white/80 text-lg max-w-2xl mx-auto lg:mx-0">
                    Existing admins can log in from the admin portal. New applicants now submit their business and identity details through a dedicated application page, and the request appears in the superadmin dashboard for review.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                    <Button size="lg" className="bg-white text-stone-950 hover:bg-stone-100 rounded-full px-10" asChild>
                      <Link href="/admin-login" className="flex items-center gap-2">
                        Admin Login <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" className="rounded-full px-10 border-white/20 text-white bg-white/5 hover:bg-white/10" asChild>
                      <Link href="/admin-login/apply" className="flex items-center gap-2">
                        Apply Now <FileText className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/15 bg-white/10 backdrop-blur-md p-6 sm:p-8 text-white space-y-4 shadow-xl">
                  <h3 className="font-bold text-xl">What the application includes</h3>
                  <div className="grid gap-3 text-sm text-white/85">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Business name, address, and business type</div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Applicant name, email, and phone number</div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">PAN, Aadhar, GST, and notes for superadmin review</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
