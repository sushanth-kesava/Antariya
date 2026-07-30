"use client";

import { useEffect, useState, useCallback } from "react";
import { getHeroCoupons, HeroCoupon } from "@/lib/api/coupons";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Animated sliding offers banner for the homepage.
 *
 * Two render modes per slide:
 *  - Poster mode: when a coupon has `heroImage`, the uploaded poster is shown
 *    as a wide banner (with the code chip overlaid).
 *  - Text mode: otherwise, a colored bar with the offer text + code.
 *
 * Auto-plays and supports arrows + dot navigation.
 */
export function HeroCouponBanner() {
  const [coupons, setCoupons] = useState<HeroCoupon[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("left");

  useEffect(() => {
    getHeroCoupons().then((data) => {
      if (data.length > 0) setCoupons(data);
    });
  }, []);

  const goNext = useCallback(() => {
    if (isAnimating || coupons.length <= 1) return;
    setIsAnimating(true);
    setSlideDirection("left");
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % coupons.length);
      setIsAnimating(false);
    }, 300);
  }, [isAnimating, coupons.length]);

  const goPrev = useCallback(() => {
    if (isAnimating || coupons.length <= 1) return;
    setIsAnimating(true);
    setSlideDirection("right");
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + coupons.length) % coupons.length);
      setIsAnimating(false);
    }, 300);
  }, [isAnimating, coupons.length]);

  // Auto-cycle every 4 seconds (after goNext is defined)
  useEffect(() => {
    if (coupons.length <= 1) return;
    const timer = setInterval(() => {
      goNext();
    }, 4500);
    return () => clearInterval(timer);
  }, [coupons.length, goNext]);

  if (dismissed || coupons.length === 0) return null;

  const coupon = coupons[currentIndex];
  const hasPoster = Boolean(coupon.heroImage && coupon.heroImage.trim());

  const getOfferText = (c: HeroCoupon) => {
    if (c.heroBannerText) return c.heroBannerText;
    if (c.discountType === "percentage") {
      return `${c.discountValue}% OFF — Use code ${c.code}`;
    }
    if (c.discountType === "flat") {
      return `₹${c.discountValue / 100} OFF — Use code ${c.code}`;
    }
    if (c.discountType === "free_shipping") {
      return `FREE SHIPPING — Use code ${c.code}`;
    }
    return `Use code ${c.code} — ${c.title}`;
  };

  const slideAnim = isAnimating
    ? slideDirection === "left"
      ? "-translate-x-full opacity-0"
      : "translate-x-full opacity-0"
    : "translate-x-0 opacity-100";

  return (
    <div
      className="relative w-full overflow-hidden"
      style={hasPoster ? undefined : { backgroundColor: coupon.heroBannerColor || "#1a1a1a" }}
    >
      {hasPoster ? (
        /* ─── Poster mode ─────────────────────────────────────────── */
        <div className={`relative transition-all duration-300 ease-in-out ${slideAnim}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coupon.heroImage}
            alt={coupon.title || `Offer ${coupon.code}`}
            className="w-full h-28 sm:h-40 md:h-52 object-cover"
          />
          {/* Code chip overlaid on the poster */}
          <div className="absolute inset-0 flex items-end justify-center pb-3 pointer-events-none">
            <span className="inline-flex items-center gap-2 rounded-full bg-black/55 px-4 py-1.5 text-white text-sm font-semibold backdrop-blur-sm">
              Use code
              <span className="font-mono font-bold tracking-widest">{coupon.code}</span>
            </span>
          </div>
        </div>
      ) : (
        /* ─── Text mode ───────────────────────────────────────────── */
        <div className="relative py-2.5 px-10">
          <div
            className={`flex items-center justify-center gap-3 text-white text-sm font-medium transition-all duration-300 ease-in-out ${slideAnim}`}
          >
            <span className="text-base">🎉</span>
            <span className="text-center">{getOfferText(coupon)}</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-white/20 font-mono text-xs font-bold tracking-widest border border-white/10">
              {coupon.code}
            </span>
          </div>
        </div>
      )}

      {/* Navigation arrows */}
      {coupons.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white/80 hover:text-white bg-black/30 hover:bg-black/50 rounded-full p-1 transition-colors"
            aria-label="Previous offer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-8 top-1/2 -translate-y-1/2 z-10 text-white/80 hover:text-white bg-black/30 hover:bg-black/50 rounded-full p-1 transition-colors"
            aria-label="Next offer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      {/* Dots indicator */}
      {coupons.length > 1 && (
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-10 flex gap-1">
          {coupons.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSlideDirection(idx > currentIndex ? "left" : "right");
                setIsAnimating(true);
                setTimeout(() => {
                  setCurrentIndex(idx);
                  setIsAnimating(false);
                }, 300);
              }}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentIndex ? "bg-white w-3" : "bg-white/50 w-1.5"
              }`}
              aria-label={`Offer ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 rounded-full p-0.5 transition-colors"
        aria-label="Dismiss offers"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
