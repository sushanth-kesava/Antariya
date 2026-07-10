"use client";

// ─────────────────────────────────────────────────────────────────────────────
// TEMPORARY "COMING SOON" PAGE
// The full shop experience is preserved in `page.full.tsx.bak` in this folder.
// To restore the real shop, replace this file's contents with that backup.
// ─────────────────────────────────────────────────────────────────────────────

import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function ShoppingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="relative flex-1 flex items-center justify-center overflow-hidden px-4 py-24">
        {/* Subtle branded motif background */}
        <div className="absolute inset-0 z-0 indian-motif-bg opacity-10" />

        <div className="relative z-10 max-w-2xl text-center space-y-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold border border-primary/20">
            <Sparkles className="h-4 w-4" />
            <span>Antariya Storefront</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground leading-[1.1] font-headline">
            Coming <span className="text-primary italic">Soon</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Our completely <span className="font-semibold text-foreground">Antariya-branded</span> storefront is
            being crafted with care. A curated shopping experience for premium
            embroidery apparel and designs is on its way.
          </p>

          <p className="text-sm text-muted-foreground">
            In the meantime, explore our full marketplace.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Button size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20 hover:shadow-xl transition-all" asChild>
              <Link href="/marketplace">
                Explore Marketplace <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="rounded-full px-8 border-primary text-primary hover:bg-primary/5" asChild>
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
