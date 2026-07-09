"use client";

// NOTE: The full Custom Embroidery Studio is temporarily disabled and shown as
// "Coming Soon". The original implementation is preserved in
// `page.full.tsx.bak` in this folder — to restore it, copy that file back over
// this one (page.tsx).

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Palette, ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";

export default function CustomizePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-grow flex items-center justify-center px-4 py-20">
        <div className="relative max-w-2xl w-full text-center">
          <div className="absolute inset-0 -z-10 indian-motif-bg opacity-10" />

          <div className="mx-auto mb-8 w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Palette className="h-12 w-12" />
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold border border-primary/20 mb-6">
            <Sparkles className="h-4 w-4" />
            AI Design Studio
          </div>

          <h1 className="text-4xl md:text-6xl font-bold font-headline tracking-tight mb-4">
            Coming Soon
          </h1>

          <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Our Custom Embroidery Studio is getting a beautiful upgrade. Soon you&apos;ll be able to
            choose a garment, pick a design, and preview your masterpiece with AI — right here.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20">
              <Link href="/marketplace">
                Browse the Marketplace <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full px-8 border-primary text-primary hover:bg-primary/5">
              <Link href="/">Back to Home</Link>
            </Button>
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            Thanks for your patience — something special is on the way. ✨
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
