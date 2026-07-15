"use client";

import { useEffect, useState, useCallback } from "react";
import { getHeroCoupons, HeroCoupon } from "@/lib/api/coupons";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Animated sliding offers banner for the homepage.
 * Smoothly transitions between active coupon offers with auto-play.
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

  // Auto-cycle every 4 seconds
  useEffect(() => {
    if (coupons.length <= 1) return;
    const timer = setInterval(() => {
      goNext();
    }, 4000);
    return () => clearInterval(timer);
  }, [coupons.length, currentIndex]);

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

  if (dismissed || coupons.length === 0) return null;

  const coupon = coupons[currentIndex];

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

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ backgroundColor: coupon.heroBannerColor || "#1a1a1a" }}
    >
      {/* Sliding content */}
      <div className="relative py-2.5 px-10">
        <div
          className={`flex items-center justify-center gap-3 text-white text-sm font-medium transition-all duration-300 ease-in-out ${
            isAnimating
              ? slideDirection === "left"
                ? "-translate-x-full opacity-0"
                : "translate-x-full opacity-0"
              : "translate-x-0 opacity-100"
          }`}
        >
          <span className="text-base">🎉</span>
          <span className="text-center">{getOfferText(coupon)}</span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-white/20 font-mono text-xs font-bold tracking-widest border border-white/10">
            {coupon.code}
          </span>
        </div>
      </div>

      {/* Navigation arrows */}
      {coupons.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors p-1"
            aria-label="Previous offer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors p-1"
            aria-label="Next offer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      {/* Dots indicator */}
      {coupons.length > 1 && (
        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-1">
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
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                idx === currentIndex ? "bg-white w-3" : "bg-white/40"
              }`}
              aria-label={`Offer ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
        aria-label="Dismiss offers"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
