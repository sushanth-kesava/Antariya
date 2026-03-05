import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export function Hero() {
  return (
    <div className="relative overflow-hidden bg-background pt-16 pb-24 lg:pt-32 lg:pb-40">
      <div className="absolute inset-0 z-0 indian-motif-bg opacity-10" />
      
      <div className="container relative z-10 mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
              <Sparkles className="h-4 w-4" />
              <span>India's Largest Embroidery Marketplace</span>
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-foreground leading-[1.1]">
              Every Stitch Tells a <span className="text-primary italic font-headline">Story</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-xl leading-relaxed">
              Discover premium embroidery designs, industrial threads, and professional machine accessories. From traditional motifs to modern patterns, find everything your machine needs.
            </p>
            
            <div className="flex flex-wrap gap-4 pt-4">
              <Button size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20 hover:shadow-xl transition-all" asChild>
                <Link href="/marketplace">
                  Explore Marketplace <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="rounded-full px-8 border-primary text-primary hover:bg-primary/5">
                Join as Dealer
              </Button>
            </div>

            <div className="flex items-center gap-8 pt-8">
              <div className="space-y-1">
                <p className="text-2xl font-bold">10k+</p>
                <p className="text-sm text-muted-foreground">Designs</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="space-y-1">
                <p className="text-2xl font-bold">500+</p>
                <p className="text-sm text-muted-foreground">Dealers</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="space-y-1">
                <p className="text-2xl font-bold">50k+</p>
                <p className="text-sm text-muted-foreground">Orders</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl animate-fade-in [animation-delay:200ms]">
            <Image 
              src="https://picsum.photos/seed/stitch-hero/1200/800" 
              alt="Embroidery craftsmanship" 
              fill
              className="object-cover"
              data-ai-hint="embroidery threads"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-8">
              <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl flex items-center gap-4 max-w-xs">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-black">New Arrival</p>
                  <p className="text-xs text-muted-foreground">Vintage Varanasi Silk Collection now available for download.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}