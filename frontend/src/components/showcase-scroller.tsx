"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Product } from "@/app/lib/mock-data";
import { formatINR, normalizeCatalogPriceToINR } from "@/lib/india";

/**
 * Apple.com homepage-style showcase with parallax:
 * - Top row scrolls slightly ahead
 * - Bottom row follows with a slight lag/delay
 * Both driven by the same scroll position but offset.
 */
export function ShowcaseScroller({ products }: { products: Product[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const topRowRef = useRef<HTMLDivElement>(null);
  const bottomRowRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAutoScrolling = useRef(false);
  const bottomAnimFrame = useRef<number>(0);

  const topProducts = products.slice(0, 6);
  const bottomProducts = products.slice(0, 8);
  const totalPages = topProducts.length;

  // Bottom row follows top row with a lag
  const syncBottomRow = useCallback(() => {
    const topEl = topRowRef.current;
    const bottomEl = bottomRowRef.current;
    if (!topEl || !bottomEl) return;

    const lerp = () => {
      const target = topEl.scrollLeft;
      const current = bottomEl.scrollLeft;
      // Ease toward the top row's position (0.08 = lag amount, lower = more lag)
      const next = current + (target - current) * 0.08;

      if (Math.abs(target - next) > 0.5) {
        bottomEl.scrollLeft = next;
        bottomAnimFrame.current = requestAnimationFrame(lerp);
      } else {
        bottomEl.scrollLeft = target;
      }
    };

    cancelAnimationFrame(bottomAnimFrame.current);
    bottomAnimFrame.current = requestAnimationFrame(lerp);
  }, []);

  // Track top row scroll for page indicator + sync bottom
  const handleTopScroll = useCallback(() => {
    const topEl = topRowRef.current;
    if (!topEl) return;
    const pageWidth = topEl.offsetWidth;
    const page = Math.round(topEl.scrollLeft / pageWidth);
    setCurrentPage(page);
    syncBottomRow();
  }, [syncBottomRow]);

  useEffect(() => {
    const topEl = topRowRef.current;
    if (!topEl) return;
    topEl.addEventListener("scroll", handleTopScroll, { passive: true });
    return () => {
      topEl.removeEventListener("scroll", handleTopScroll);
      cancelAnimationFrame(bottomAnimFrame.current);
    };
  }, [handleTopScroll]);

  // Auto-play
  useEffect(() => {
    autoPlayRef.current = setInterval(() => {
      const topEl = topRowRef.current;
      if (!topEl) return;
      isAutoScrolling.current = true;
      const nextPage = (currentPage + 1) % totalPages;
      topEl.scrollTo({ left: nextPage * topEl.offsetWidth, behavior: "smooth" });
    }, 5000);
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [currentPage, totalPages]);

  const goToPage = (page: number) => {
    const topEl = topRowRef.current;
    if (!topEl) return;
    topEl.scrollTo({ left: page * topEl.offsetWidth, behavior: "smooth" });
  };

  // Bottom row: cycle products
  const getBottomSlice = (pageIdx: number) => {
    const items: Product[] = [];
    for (let i = 0; i < 6; i++) {
      items.push(bottomProducts[(pageIdx + i) % bottomProducts.length]);
    }
    return items;
  };

  return (
    <div ref={containerRef} className="pb-8">
      {/* TOP ROW — scrollable, drives everything */}
      <div
        ref={topRowRef}
        className="overflow-x-auto scrollbar-hide snap-x snap-mandatory mb-3"
      >
        <div className="flex w-max">
          {topProducts.map((product, pageIdx) => (
            <div
              key={`top-${product.id}`}
              className="w-screen shrink-0 snap-center px-2 sm:px-3"
              style={{ maxWidth: "100vw" }}
            >
              <div className="flex gap-2 sm:gap-3 h-[35vh] sm:h-[40vh] lg:h-[50vh]">
                {/* Left peek */}
                <Link
                  href={`/product/${topProducts[(pageIdx - 1 + topProducts.length) % topProducts.length].id}`}
                  className="hidden sm:block relative w-[12%] lg:w-[15%] shrink-0 rounded-xl overflow-hidden bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={topProducts[(pageIdx - 1 + topProducts.length) % topProducts.length].image}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </Link>

                {/* Center main */}
                <Link
                  href={`/product/${product.id}`}
                  className="group relative flex-1 rounded-2xl overflow-hidden bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.image}
                    alt={product.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 z-10 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-white/50 text-[10px] sm:text-xs uppercase tracking-widest mb-1">{product.category}</p>
                      <h3 className="text-white text-lg sm:text-2xl lg:text-3xl font-bold font-headline leading-tight">{product.name}</h3>
                    </div>
                    <span className="shrink-0 bg-white text-foreground text-xs sm:text-sm font-semibold px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-full">
                      Shop now
                    </span>
                  </div>
                </Link>

                {/* Right peek */}
                <Link
                  href={`/product/${topProducts[(pageIdx + 1) % topProducts.length].id}`}
                  className="hidden sm:block relative w-[12%] lg:w-[15%] shrink-0 rounded-xl overflow-hidden bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={topProducts[(pageIdx + 1) % topProducts.length].image}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BOTTOM ROW — follows top with lag, no user scroll (overflow hidden) */}
      <div
        ref={bottomRowRef}
        className="overflow-x-hidden scrollbar-hide"
      >
        <div className="flex w-max">
          {topProducts.map((_, pageIdx) => (
            <div
              key={`btm-page-${pageIdx}`}
              className="w-screen shrink-0 px-2 sm:px-3"
              style={{ maxWidth: "100vw" }}
            >
              <div className="flex gap-2 sm:gap-3 h-[16vh] sm:h-[20vh] lg:h-[24vh]">
                {getBottomSlice(pageIdx).map((btmProduct, idx) => (
                  <Link
                    key={`btm-${pageIdx}-${btmProduct.id}-${idx}`}
                    href={`/product/${btmProduct.id}`}
                    className="group relative flex-1 min-w-0 rounded-xl overflow-hidden bg-muted"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={btmProduct.image}
                      alt={btmProduct.name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 z-10">
                      <p className="text-white text-[10px] sm:text-xs font-bold truncate">{btmProduct.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-white/60 text-[9px] sm:text-[11px] truncate">
                          {formatINR(normalizeCatalogPriceToINR(Number(btmProduct.price || 0)))}
                        </p>
                        <span className="hidden sm:inline-block text-[9px] sm:text-[10px] bg-white/90 text-foreground font-semibold px-2 py-0.5 rounded-full shrink-0">
                          Shop
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-2 pt-6">
        {Array.from({ length: totalPages }).map((_, idx) => (
          <button
            key={idx}
            onClick={() => goToPage(idx)}
            className={`transition-all duration-300 rounded-full ${
              idx === currentPage
                ? "w-7 h-2.5 bg-foreground"
                : "w-2.5 h-2.5 bg-foreground/20 hover:bg-foreground/40"
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
