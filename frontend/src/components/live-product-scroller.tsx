"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getProductsFromBackend } from "@/lib/api/products";
import { formatINR, normalizeCatalogPriceToINR } from "@/lib/india";
import type { Product } from "@/app/lib/mock-data";

// How many recent products to rotate through, how long each is shown,
// and how often to re-fetch for newly uploaded products.
const CARD_COUNT = 5;
const SLIDE_MS = 5000;
const REFRESH_MS = 30000;

export function LiveProductScroller({ initialProducts = [] }: { initialProducts?: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts.slice(0, CARD_COUNT));
  const [index, setIndex] = useState(0);
  const [withTransition, setWithTransition] = useState(true);

  // Fetch the most recent products (and refresh periodically).
  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        // Backend sorts by createdAt desc, so the first page is the most recent.
        const { products: fresh } = await getProductsFromBackend({ limit: CARD_COUNT });
        if (active && Array.isArray(fresh) && fresh.length > 0) {
          setProducts(fresh.slice(0, CARD_COUNT));
        }
      } catch (err) {
        console.error("Failed to load live products", err);
      }
    };

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  // Advance to the next product every SLIDE_MS. We allow index to reach
  // products.length (a cloned copy of the first slide appended to the track)
  // so the final → first transition always moves FORWARD instead of rewinding.
  useEffect(() => {
    if (products.length <= 1) return;
    const timer = setInterval(() => {
      setWithTransition(true);
      setIndex((current) => current + 1);
    }, SLIDE_MS);
    return () => clearInterval(timer);
  }, [products.length]);

  // When we land on the cloned slide (index === products.length), let the
  // forward transition finish, then silently snap back to the real first
  // slide with the transition disabled (invisible because they're identical).
  useEffect(() => {
    if (products.length <= 1) return;
    if (index !== products.length) return;
    const snap = setTimeout(() => {
      setWithTransition(false);
      setIndex(0);
    }, 750); // slightly longer than the 700ms slide transition
    return () => clearTimeout(snap);
  }, [index, products.length]);

  // Keep the index valid if the product list shrinks after a refresh.
  useEffect(() => {
    if (index > products.length && products.length > 0) {
      setIndex(0);
    }
  }, [products.length, index]);

  // Empty state — keeps the old placeholder feel until products exist.
  if (products.length === 0) {
    return (
      <div className="h-full w-full bg-gradient-to-br from-muted via-background to-muted flex items-center justify-center">
        <div className="bg-card/90 backdrop-blur-sm p-4 rounded-xl flex items-center gap-4 max-w-xs border border-border/50 shadow-lg">
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-card-foreground">Live catalog highlight</p>
            <p className="text-xs text-muted-foreground">Live catalog content will appear here once products load.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-muted/40 via-background to-muted/40">
      {/* Track holds all slides side by side; we shift it left one full width per step. */}
      <div
        className="flex h-full ease-in-out"
        style={{
          transform: `translateX(-${index * 100}%)`,
          transition: withTransition ? "transform 700ms ease-in-out" : "none",
        }}
        onTransitionEnd={() => setWithTransition(true)}
      >
        {/* Real slides + a clone of the first slide appended for a seamless loop. */}
        {[...products, products[0]].map((product, idx) => {
          const price = normalizeCatalogPriceToINR(Number(product.price));
          return (
            <Link
              key={`${product.id}-${idx}`}
              href={`/product/${product.id}`}
              className="group relative block h-full w-full shrink-0 overflow-hidden"
            >
              {/* Full product image fills the entire slide */}
              <div className="absolute inset-0 overflow-hidden bg-muted">
                {product.image ? (
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority={idx === 0}
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-muted to-background" />
                )}
              </div>

              {/* Floating product card overlaid on the bottom-left of the image */}
              <div className="absolute bottom-6 left-6 right-6 z-10 flex max-w-sm items-center gap-4 rounded-2xl border border-border/50 bg-card/90 p-4 shadow-lg backdrop-blur-sm">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-card-foreground">{product.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {product.dealerName ? `· ${product.dealerName}` : product.category}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-primary">{formatINR(price)}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Slide indicator dots */}
      {products.length > 1 && (
        <div className="absolute right-6 top-6 z-20 flex gap-2">
          {products.map((product, idx) => (
            <button
              key={`dot-${product.id}-${idx}`}
              type="button"
              aria-label={`Show product ${idx + 1}`}
              onClick={() => setIndex(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === index % products.length ? "w-6 bg-primary" : "w-2 bg-primary/30 hover:bg-primary/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
