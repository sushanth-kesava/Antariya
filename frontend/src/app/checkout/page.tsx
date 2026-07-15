"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { ArrowLeft, Loader2, ShieldCheck, Smartphone, AlertCircle, Ticket, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Navbar } from "@/components/navbar";
import { useToast } from "@/hooks/use-toast";
import { getCartItems, clearCart } from "@/lib/cart";
import { createOrderOnBackend } from "@/lib/api/orders";
import { createRazorpayOrderOnBackend, verifyRazorpayPaymentOnBackend } from "@/lib/api/payments";
import {
  formatINR,
  INDIA_FREE_SHIPPING_THRESHOLD,
  INDIA_GST_RATE,
  INDIA_STANDARD_SHIPPING,
  normalizeCatalogPriceToINR,
} from "@/lib/india";
import { checkStockAvailability, StockCheckResult } from "@/lib/api/stock";
import { getHeroCoupons, validateCouponCode, HeroCoupon, CouponValidationResult } from "@/lib/api/coupons";

export default function CheckoutPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [placingOrder, setPlacingOrder] = useState(false);
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [stockStatus, setStockStatus] = useState<Map<string, StockCheckResult>>(new Map());
  const [checkingStock, setCheckingStock] = useState(true);
  const [stockError, setStockError] = useState<string | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<HeroCoupon[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null);
  const [couponLoading, setCouponLoading] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");

  const items = useMemo(() => getCartItems(), []);

  useEffect(() => {
    if (items.length === 0) router.replace("/cart");
  }, [items, router]);

  // Check stock before allowing payment
  useEffect(() => {
    if (items.length > 0) {
      checkStockStatus();
    }
  }, [items]);

  const checkStockStatus = async () => {
    try {
      setCheckingStock(true);
      setStockError(null);

      const token = localStorage.getItem("app_auth_token");
      if (!token) {
        router.push("/login");
        return;
      }

      const checkItems = items.map(item => ({
        productId: item.productId,
        variantSku: item.variantSku,
        quantity: item.quantity,
      }));

      const result = await checkStockAvailability(token, checkItems);
      
      const statusMap = new Map<string, StockCheckResult>();
      result.items.forEach(item => {
        const key = `${item.productId}:${item.variantSku || ""}`;
        statusMap.set(key, item);
      });
      
      setStockStatus(statusMap);
      if (!result.allAvailable) {
        setStockError("Stock availability changed. Please return to your cart and update quantities.");
      }
    } catch (error) {
      console.warn("Stock check failed:", error);
    } finally {
      setCheckingStock(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.Razorpay === "function") {
      setRazorpayReady(true);
      return;
    }
    const interval = setInterval(() => {
      if (typeof window !== "undefined" && typeof window.Razorpay === "function") {
        setRazorpayReady(true);
        clearInterval(interval);
      }
    }, 300);
    return () => clearInterval(interval);
  }, []);

  const razorpayKeyId =
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() ||
    (typeof window !== "undefined" ? window.__ANTARIYA_RUNTIME_CONFIG__?.razorpayKeyId?.trim() || "" : "");

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + normalizeCatalogPriceToINR(item.price) * item.quantity, 0),
    [items]
  );

  const shipping = useMemo(
    () => (subtotal >= INDIA_FREE_SHIPPING_THRESHOLD ? 0 : INDIA_STANDARD_SHIPPING),
    [subtotal]
  );

  const tax = subtotal * INDIA_GST_RATE;
  // Backend returns discount in paise — convert to rupees to match subtotal
  const couponDiscount = (appliedCoupon?.discount || 0) / 100;
  const effectiveShipping = appliedCoupon?.freeShipping ? 0 : shipping;
  const total = Math.max(0, subtotal + effectiveShipping + tax - couponDiscount);

  // Fetch available coupons on mount
  useEffect(() => {
    getHeroCoupons().then(setAvailableCoupons).catch(() => {});
  }, []);

  const handleApplyCoupon = async (code: string) => {
    const token = localStorage.getItem("app_auth_token");
    if (!token) return;

    setCouponLoading(code);
    setCouponError(null);

    try {
      const subtotalPaise = Math.round(subtotal * 100);
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const result = await validateCouponCode(token, code, subtotalPaise, totalQuantity);
      if (result.success && result.coupon) {
        setAppliedCoupon(result.coupon);
        setCouponInput(code);
      } else {
        setCouponError(result.message || "Invalid coupon");
        setAppliedCoupon(null);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to validate coupon";
      setCouponError(msg);
    }
    setCouponLoading(null);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
  };

  const orderItems = items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    variantSku: item.variantSku || undefined,
    customization: item.customization,
  }));

  const handleUPI = async () => {
    const token = localStorage.getItem("app_auth_token");
    if (!token) { router.push("/login"); return; }

    if (!razorpayKeyId) {
      toast({ title: "Configuration error", description: "Razorpay key is missing." });
      return;
    }
    if (!razorpayReady || typeof window.Razorpay !== "function") {
      toast({ title: "Payment gateway loading", description: "Please wait a moment and try again." });
      return;
    }

    const amountInPaise = Math.round(total * 100);
    if (amountInPaise < 100) {
      toast({ title: "Amount too low", description: "Minimum payment amount is ₹1.00" });
      return;
    }

    const sessionRaw = localStorage.getItem("google_auth_user");
    const session = sessionRaw ? JSON.parse(sessionRaw) : null;
    const customerName = typeof session?.displayName === "string" ? session.displayName : "Customer";
    const customerEmail = typeof session?.email === "string" ? session.email : "";

    try {
      setPlacingOrder(true);
      const receipt = `antariya_${Date.now()}`;
      const order = await createRazorpayOrderOnBackend(token, { amount: amountInPaise, currency: "INR", receipt });

      const paymentObject = new window.Razorpay({
        key: razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: "Antariya",
        description: "Secure checkout",
        order_id: order.order_id,
        prefill: { name: customerName, email: customerEmail },
        notes: { source: "checkout_upi", items: String(items.length) },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            await verifyRazorpayPaymentOnBackend(token, {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            await createOrderOnBackend(token, orderItems, "upi", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            clearCart();
            const params = new URLSearchParams({
              status: "success",
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              amount: String(total),
            });
            router.push(`/order-status?${params.toString()}`);
          } catch (error) {
            const reason = error instanceof Error ? error.message : "Payment verification failed.";
            router.push(`/order-status?status=failed&reason=${encodeURIComponent(reason)}`);
          } finally {
            setPlacingOrder(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPlacingOrder(false);
            router.push("/order-status?status=cancelled");
          },
        },
      });

      paymentObject.on("payment.failed", (event: { error?: { description?: string } }) => {
        setPlacingOrder(false);
        const reason = event?.error?.description || "Payment could not be completed.";
        router.push(`/order-status?status=failed&reason=${encodeURIComponent(reason)}`);
      });

      paymentObject.open();
    } catch (error) {
      toast({ title: "Checkout failed", description: error instanceof Error ? error.message : "Failed to place order." });
      setPlacingOrder(false);
    }
  };

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setRazorpayReady(true)}
        onError={() => setRazorpayReady(false)}
      />
      <Navbar />
      <div className="min-h-screen bg-gray-50/50 py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-gray-900 mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Cart
          </button>

          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-8">Secure Checkout</h1>

          {/* Payment method — online only */}
          <div className="flex flex-col gap-4 mb-8">
            <div className="w-full text-left rounded-2xl border-2 border-primary bg-primary/5 shadow-sm p-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-primary text-white">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">UPI / Cards / NetBanking</p>
                  <p className="text-sm text-muted-foreground">Pay securely via Razorpay · Shipping {formatINR(INDIA_STANDARD_SHIPPING)}</p>
                </div>
                <div className="w-5 h-5 rounded-full border-2 border-primary shrink-0 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          {stockError && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Stock availability changed</p>
                <p className="text-xs mt-1">{stockError}</p>
              </div>
            </div>
          )}

          {checkingStock && (
            <div className="mb-6 flex items-center justify-center gap-2 text-sm text-muted-foreground rounded-2xl border border-gray-200 bg-gray-50 px-6 py-4">
              <div className="h-4 w-4 animate-spin border-2 border-primary border-t-transparent rounded-full" />
              Verifying stock availability…
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-4">
          <Card className="rounded-2xl shadow-sm border-gray-100 flex-1">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4 rounded-t-2xl">
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-3">
              <div className="space-y-2 mb-4 pb-4 border-b border-gray-100">
                {items.map((item) => {
                  const key = `${item.productId}:${item.variantSku || ""}`;
                  const status = stockStatus.get(key);
                  return (
                    <div key={item.lineId} className="flex justify-between text-xs">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        {item.variant && (item.variant.size || item.variant.color) && (
                          <p className="text-muted-foreground text-[11px] mt-0.5">
                            {[item.variant.size, item.variant.color, item.variant.gender].filter(Boolean).join(" • ")}
                          </p>
                        )}
                        <p className="text-muted-foreground mt-0.5">
                          {item.quantity}× {formatINR(normalizeCatalogPriceToINR(item.price))}
                          {status && (
                            <span className={`ml-2 font-medium ${status.isAvailable ? "text-green-600" : "text-red-600"}`}>
                              ({status.available} available)
                            </span>
                          )}
                        </p>
                      </div>
                      <p className="font-medium text-gray-900 text-right ml-4">
                        {formatINR(normalizeCatalogPriceToINR(item.price) * item.quantity)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between text-gray-600 text-sm">
                <span>Subtotal ({items.length} {items.length === 1 ? "item" : "items"})</span>
                <span className="font-medium text-gray-900">{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600 text-sm">
                <span>Shipping</span>
                <span className="font-medium text-gray-900">
                  {effectiveShipping === 0 ? <span className="text-green-600">Free</span> : formatINR(effectiveShipping)}
                </span>
              </div>
              {effectiveShipping > 0 && (
                <p className="text-xs text-muted-foreground text-right">
                  Free shipping on orders above {formatINR(INDIA_FREE_SHIPPING_THRESHOLD)}
                </p>
              )}
              {/* Coupon discount line */}
              {appliedCoupon && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 flex items-center gap-1">
                    <Ticket className="h-3.5 w-3.5" />
                    Coupon ({appliedCoupon.code})
                  </span>
                  <span className="font-medium text-green-600">
                    {appliedCoupon.freeShipping ? "Free Shipping" : `- ${formatINR(appliedCoupon.discount / 100)}`}
                  </span>
                </div>
              )}

              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-gray-900">{formatINR(total)}</span>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-3 pb-6">
              <Button
                className="w-full h-12 text-base rounded-full shadow-md hover:shadow-lg transition-shadow"
                size="lg"
                onClick={handleUPI}
                disabled={placingOrder || !razorpayReady || !razorpayKeyId || checkingStock || stockError !== null}
              >
                {placingOrder ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
                ) : (
                  "Pay Now"
                )}
              </Button>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                <span>Secure &amp; encrypted checkout</span>
              </div>
            </CardFooter>
          </Card>

          {/* ─── Coupon Box ─────────────────────────────────────────── */}
          <Card className="border-dashed md:w-72 self-start">
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Ticket className="h-4 w-4 text-primary" />
                Apply Coupon
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-3">
              {/* Applied coupon badge */}
              {appliedCoupon && (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <div>
                      <span className="font-mono font-bold text-green-800 text-sm">{appliedCoupon.code}</span>
                      <span className="text-green-700 text-xs ml-2">
                        {appliedCoupon.freeShipping
                          ? "Free shipping applied!"
                          : `- ${formatINR(appliedCoupon.discount / 100)} off`}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveCoupon}
                    className="text-green-600 hover:text-red-500 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Error */}
              {couponError && !appliedCoupon && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {couponError}
                </p>
              )}

              {/* Available coupons list */}
              {!appliedCoupon && availableCoupons.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableCoupons.map((coupon) => {
                    const isLoading = couponLoading === coupon.code;
                    return (
                      <div
                        key={coupon.code}
                        className="flex items-center justify-between border rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs tracking-wide bg-muted px-2 py-0.5 rounded">
                              {coupon.code}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {coupon.discountType === "percentage" && `${coupon.discountValue}% off`}
                            {coupon.discountType === "flat" && `₹${coupon.discountValue / 100} off`}
                            {coupon.discountType === "free_shipping" && "Free shipping"}
                            {coupon.minOrderValue > 0 && ` • Min ₹${coupon.minOrderValue / 100}`}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-2 text-xs h-7 px-3 rounded-full"
                          onClick={() => handleApplyCoupon(coupon.code)}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Apply"
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* No coupons available */}
              {!appliedCoupon && availableCoupons.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No coupons available right now
                </p>
              )}
            </CardContent>
          </Card>

          </div>
        </div>
      </div>
    </>
  );
}
