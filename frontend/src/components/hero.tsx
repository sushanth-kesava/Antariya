import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Product } from "@/app/lib/mock-data";
import { LiveProductScroller } from "@/components/live-product-scroller";

type HeroMetrics = {
  products: number;
};

type HeroProps = {
  metrics: HeroMetrics;
  featuredProduct: Product | null;
};

export function Hero({ metrics: _metrics, featuredProduct }: HeroProps) {
  return (
    <section id="hero" className="relative overflow-hidden bg-background">
      {/* Full-width hero with split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[85vh]">
        {/* Left — Brand Statement */}
        <div className="flex flex-col justify-center px-6 sm:px-10 lg:px-16 xl:px-24 py-20 lg:py-32">
          <div className="max-w-xl space-y-8 animate-fade-in">
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground font-medium">
              Premium Embroidered Streetwear
            </p>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight text-foreground leading-[0.95] font-headline">
              Every Stitch Tells a
              <br />
              <span className="text-primary italic font-theseasons">Story.</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-md">
              Crafted with precision. Designed for individuality. Premium streetwear that blends modern Indian artistry with bold, everyday confidence.
            </p>
            
            <div className="flex flex-wrap gap-4 pt-4">
              <Button size="lg" className="rounded-full px-10 h-14 text-base shadow-lg shadow-primary/15 hover:shadow-xl transition-all" asChild>
                <Link href="/shop">
                  Shop Now <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="rounded-full px-10 h-14 text-base border-foreground/20 hover:bg-foreground/5" asChild>
                <Link href="/marketplace">
                  Explore Collections
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Right — Featured Product Visual */}
        <div className="relative w-full min-h-[50vh] lg:min-h-full animate-fade-in [animation-delay:200ms] pt-6 lg:pt-10">
          <LiveProductScroller initialProducts={featuredProduct ? [featuredProduct] : []} />
        </div>
      </div>
    </section>
  );
}
