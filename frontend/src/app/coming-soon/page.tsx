"use client";

import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";

export default function ComingSoon() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-md text-center space-y-8">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl flex items-center justify-center border border-primary/30">
              <Rocket className="h-12 w-12 text-primary animate-bounce" />
            </div>
          </div>

          {/* Content */}
          <div className="space-y-4">
            <h1 className="text-4xl lg:text-5xl font-bold font-theseasons tracking-tight">
              Coming Soon
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              We're working on something exciting. This feature will be available soon.
            </p>
          </div>

          {/* CTA Button */}
          <div>
            <Button asChild size="lg" className="rounded-full px-8">
              <Link href="/">Back to Home</Link>
            </Button>
          </div>

          {/* Decorative elements */}
          <div className="pt-8 space-y-3 text-sm text-muted-foreground border-t pt-8">
            <p>Stay tuned for updates!</p>
            <p>In the meantime, explore our <Link href="/marketplace" className="text-primary hover:underline font-semibold">marketplace</Link></p>
          </div>
        </div>
      </main>
    </div>
  );
}
