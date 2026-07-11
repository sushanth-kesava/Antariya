import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import type { Product } from "@/app/lib/mock-data";
import { LiveProductScroller } from "@/components/live-product-scroller";

type HeroMetrics = {
  products: number;
  dealers: number;
  categories: number;
  orders: number;
};

type HeroProps = {
  metrics: HeroMetrics;
  featuredProduct: Product | null;
};

function formatMetric(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function Hero({ metrics, featuredProduct }: HeroProps) {
  return (
    <div id="hero" className="relative overflow-hidden bg-background pt-16 pb-24 lg:pt-32 lg:pb-40">
      <div className="absolute inset-0 z-0 indian-motif-bg opacity-10" />
      
      <div className="w-full max-w-[1760px] relative z-10 mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
              <Sparkles className="h-4 w-4" />
              <span>India's Largest Embroidery Marketplace</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-foreground leading-[1.1]">
              Every Stitch Tells a <span className="text-primary italic font-headline">Story</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-xl leading-relaxed">
              Discover premium streetwear crafted for those who value quality, comfort, and individuality. From bold graphic prints to timeless essentials, Antariya delivers apparel that blends modern style with everyday confidence.
            </p>
            
            <div className="flex flex-wrap gap-4 pt-4">
              <Button size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20 hover:shadow-xl transition-all" asChild>
                <Link href="/marketplace">
                  Explore Marketplace <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="rounded-full px-8 border-primary text-primary hover:bg-primary/5" asChild>
                <Link href="/admin-login/apply">
                  Join as Dealer
                </Link>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 pt-8">
              <div className="space-y-1">
                <p className="text-2xl font-bold">{formatMetric(metrics.products)}</p>
                <p className="text-sm text-muted-foreground">Products</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="space-y-1">
                <p className="text-2xl font-bold">{formatMetric(metrics.dealers)}</p>
                <p className="text-sm text-muted-foreground">Dealers</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="space-y-1">
                <p className="text-2xl font-bold">{formatMetric(metrics.orders)}</p>
                <p className="text-sm text-muted-foreground">Orders</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="space-y-1">
                <p className="text-2xl font-bold">{formatMetric(metrics.categories)}</p>
                <p className="text-sm text-muted-foreground">Categories</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-border/50 animate-fade-in [animation-delay:200ms]">
            <LiveProductScroller initialProducts={featuredProduct ? [featuredProduct] : []} />
          </div>
        </div>
      </div>
    </div>
  );
}