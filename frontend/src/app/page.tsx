
"use client";

import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { Footer } from "@/components/footer";
import { ProductCard } from "@/components/product-card";
import { CATEGORIES, Product } from "@/app/lib/mock-data";
import { Button } from "@/components/ui/button";
import { ChevronRight, Zap, ShieldCheck, Truck, RefreshCcw, Loader2, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getProductsFromBackend } from "@/lib/api/products";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001/api";

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
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [upgradeName, setUpgradeName] = useState("");
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchData() {
      try {
        const [catalogResponse, statsResponse] = await Promise.all([
          getProductsFromBackend({ limit: 500 }),
          fetch(`${API_BASE_URL}/stats/home`).then(async (response) => {
            const data = await response.json();

            if (!response.ok || !data?.success) {
              throw new Error(data?.message || "Failed to load home stats");
            }

            return data.stats as HeroMetrics;
          }),
        ]);

        const { products, pagination } = catalogResponse;
        const liveProducts = products.length > 0 ? products : [];

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
          categories: statsResponse.categories || new Set(liveProducts.map((product) => product.category).filter(Boolean)).size,
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

  const handleUpgradeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = upgradeEmail.trim().toLowerCase();
    const name = upgradeName.trim();

    if (!email || !name) {
      setUpgradeError("Please enter your name and email.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setUpgradeError("Please enter a valid email address.");
      return;
    }

    setUpgradeLoading(true);
    setUpgradeError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/waitlist/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, source: "admin_upgrade_request" }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Request failed. Please try again.");
      }

      setUpgradeSuccess(true);
      setUpgradeEmail("");
      setUpgradeName("");
      toast({
        title: "Request sent!",
        description: "We've received your admin upgrade request and will follow up by email.",
      });
    } catch (err) {
      setUpgradeError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setUpgradeLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-grow">
        <Hero metrics={heroMetrics} featuredProduct={heroProduct} />

        {/* Categories Section */}
        <section className="py-16 bg-muted/30">
          <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6">
            <div className="flex items-end justify-between mb-8">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold font-headline">Shop by Category</h2>
                <p className="text-muted-foreground">Find specialized tools and materials for your embroidery business.</p>
              </div>
              <Button variant="link" className="text-primary font-semibold" asChild>
                <Link href="/marketplace">View All Categories <ChevronRight className="h-4 w-4 ml-1" /></Link>
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {CATEGORIES.map((cat) => (
                <Link 
                  key={cat} 
                  href={`/marketplace?category=${encodeURIComponent(cat)}`}
                  className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/50 hover:shadow-lg transition-all text-center group"
                >
                  <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <Zap className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-bold leading-tight line-clamp-2">{cat}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

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
                {featuredProducts.map(product => (
                  <ProductCard key={product.id} product={product} />
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
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto text-primary">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <h3 className="font-bold text-lg">Quality Assured</h3>
                <p className="text-sm text-muted-foreground">All products from verified dealers and manufacturers.</p>
              </div>
              <div className="space-y-4">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto text-primary">
                  <Truck className="h-8 w-8" />
                </div>
                <h3 className="font-bold text-lg">Pan India Delivery</h3>
                <p className="text-sm text-muted-foreground">Fastest shipping to every corner of India for your peace of mind.</p>
              </div>
              <div className="space-y-4">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto text-primary">
                  <RefreshCcw className="h-8 w-8" />
                </div>
                <h3 className="font-bold text-lg">Hassle-free Returns</h3>
                <p className="text-sm text-muted-foreground">Easy 7-day return policy for physical tools and threads.</p>
              </div>
              <div className="space-y-4">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto text-primary">
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
            <div className="bg-secondary rounded-3xl p-8 lg:p-16 flex flex-col lg:flex-row items-center gap-12 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              
              <div className="flex-1 space-y-6 text-white text-center lg:text-left relative z-10">
                <h2 className="text-4xl lg:text-5xl font-bold font-theseasons">Request Admin Access Upgrade</h2>
                <p className="text-white/80 text-lg">Enter your mail ID and request an upgrade from customer access to admin access. We will review the request and follow up by email.</p>
                <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full px-10">
                  <Link href="/admin-login" className="flex items-center gap-2">Admin Login</Link>
                </Button>
              </div>
              
              <div className="flex-1 w-full max-w-md bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 relative z-10">
                {upgradeSuccess ? (
                  <div className="flex flex-col items-center justify-center gap-4 py-4 text-center">
                    <CheckCircle className="h-12 w-12 text-accent" />
                    <h3 className="text-white font-bold text-xl">Request Received!</h3>
                    <p className="text-white/70 text-sm">We&apos;ll review your request and follow up at the email you provided.</p>
                    <Button
                      variant="ghost"
                      className="text-white/70 hover:text-white text-xs underline"
                      onClick={() => setUpgradeSuccess(false)}
                    >
                      Submit another request
                    </Button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-white font-bold text-xl mb-4">Admin Access Upgrade Request</h3>
                    <form onSubmit={handleUpgradeRequest} className="space-y-4">
                      <input
                        type="text"
                        placeholder="Your full name"
                        value={upgradeName}
                        onChange={(e) => setUpgradeName(e.target.value)}
                        required
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <input
                        type="email"
                        placeholder="Enter your mail ID"
                        value={upgradeEmail}
                        onChange={(e) => setUpgradeEmail(e.target.value)}
                        required
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      {upgradeError && <p className="text-red-300 text-xs">{upgradeError}</p>}
                      <Button
                        type="submit"
                        className="w-full bg-white text-secondary hover:bg-white/90 rounded-full"
                        disabled={upgradeLoading}
                      >
                        {upgradeLoading ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                        ) : (
                          "Send Request"
                        )}
                      </Button>
                      <p className="text-xs text-white/60 text-center">
                        Use the email linked to your customer account so we can verify the upgrade request.
                      </p>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
