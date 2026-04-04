
"use client";

import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { ProductCard } from "@/components/product-card";
import { CATEGORIES, Product } from "@/app/lib/mock-data";
import { Button } from "@/components/ui/button";
import { ChevronRight, Zap, ShieldCheck, Truck, RefreshCcw, Database } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getProductsFromBackend, seedProductsOnBackend } from "@/lib/api/products";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getProductsFromBackend();
        setFeaturedProducts(data.slice(0, 4));
      } catch (error) {
        console.error("Failed to load products", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleSeed = async () => {
    const res = await seedProductsOnBackend();
    toast({
      title: res.success ? "Success" : "Info",
      description: res.message,
    });
    // Refresh data
    const data = await getProductsFromBackend();
    setFeaturedProducts(data.slice(0, 4));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-grow">
        <Hero />

        {/* Categories Section */}
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
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
              {CATEGORIES.map((cat, idx) => (
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
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-4xl font-bold font-headline">Bestsellers in India</h2>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-full gap-2 border-dashed border-primary text-primary"
                  onClick={handleSeed}
                >
                  <Database className="h-4 w-4" /> Seed DB
                </Button>
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
          <div className="container mx-auto px-4">
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

        {/* Newsletter/CTA */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="bg-secondary rounded-3xl p-8 lg:p-16 flex flex-col lg:flex-row items-center gap-12 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              
              <div className="flex-1 space-y-6 text-white text-center lg:text-left relative z-10">
                <h2 className="text-4xl lg:text-5xl font-bold font-headline">Launch Your Embroidery Business with StitchMart</h2>
                <p className="text-white/80 text-lg">Are you a supplier? Reach thousands of embroidery machine owners across India today.</p>
                <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full px-10">
                  Register as Dealer
                </Button>
              </div>
              
              <div className="flex-1 w-full max-w-md bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 relative z-10">
                <h3 className="text-white font-bold text-xl mb-4">Subscribe for Free Designs</h3>
                <div className="flex gap-2">
                  <input 
                    type="email" 
                    placeholder="Enter your email" 
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <Button className="bg-white text-secondary hover:bg-white/90">Join</Button>
                </div>
                <p className="text-xs text-white/60 mt-4 text-center">We value your privacy. Unsubscribe anytime.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-card border-t pt-20 pb-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="space-y-6">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-xl">
                  S
                </div>
                <span className="font-headline text-2xl font-bold text-primary">StitchMart</span>
              </Link>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Empowering India's embroidery industry since 2024. Providing premium digital assets and hardware solutions for small and medium scale embroidery businesses.
              </p>
            </div>
            
            <div>
              <h4 className="font-bold mb-6">Marketplace</h4>
              <ul className="space-y-4 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-primary transition-colors">Embroidery Designs</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Premium Threads</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Industrial Fabrics</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Machine Parts</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-6">Company</h4>
              <ul className="space-y-4 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-primary transition-colors">About Us</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Dealer Program</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Careers</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Contact Support</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-6">Support</h4>
              <ul className="space-y-4 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-primary transition-colors">Tracking Orders</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Shipping Policy</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Privacy & Terms</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors">Help Center</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t pt-10 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
            <p>© 2024 StitchMart India. All rights reserved.</p>
            <div className="flex items-center gap-8">
              <Link href="#" className="hover:text-primary">Facebook</Link>
              <Link href="#" className="hover:text-primary">Instagram</Link>
              <Link href="#" className="hover:text-primary">LinkedIn</Link>
              <Link href="#" className="hover:text-primary">Twitter</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
