"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { ArrowLeft, Loader2, ShieldCheck, Smartphone } from "lucide-react";
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

export default function CheckoutPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [placingOrder, setPlacingOrder] = useState(false);
  const [razorpayReady, setRazorpayReady] = useState(false);

  const items = useMemo(() => getCartItems(), []);

  useEffect(() => {
    if (items.length === 0) router.replace("/cart");
  }, [items, router]);

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
  const total = subtotal + shipping + tax;

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
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
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
          <Card className="rounded-2xl shadow-sm border-gray-100">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4 rounded-t-2xl">
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-3">
              <div className="flex justify-between text-gray-600 text-sm">
                <span>Subtotal ({items.length} {items.length === 1 ? "item" : "items"})</span>
                <span className="font-medium text-gray-900">{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600 text-sm">
                <span>Shipping</span>
                <span className="font-medium text-gray-900">
                  {shipping === 0 ? <span className="text-green-600">Free</span> : formatINR(shipping)}
                </span>
              </div>
              {shipping > 0 && (
                <p className="text-xs text-muted-foreground text-right">
                  Free shipping on orders above {formatINR(INDIA_FREE_SHIPPING_THRESHOLD)}
                </p>
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
                disabled={placingOrder || !razorpayReady || !razorpayKeyId}
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
        </div>
      </div>
    </>
  );
}
