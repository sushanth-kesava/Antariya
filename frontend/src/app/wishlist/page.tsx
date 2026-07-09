"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Heart, Trash2, ShoppingCart, ArrowRight, ShieldCheck, Loader2, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Navbar } from "@/components/navbar";
import { useToast } from "@/hooks/use-toast";
import { getWishlistFromBackend, setWishlistItemOnBackend, type WishlistItem } from "@/lib/api/wishlist";
import { createOrderOnBackend } from "@/lib/api/orders";
import { createRazorpayOrderOnBackend, verifyRazorpayPaymentOnBackend } from "@/lib/api/payments";
import { addProductToCart } from "@/lib/cart";
import {
  formatINR,
  INDIA_FREE_SHIPPING_THRESHOLD,
  INDIA_GST_RATE,
  INDIA_STANDARD_SHIPPING,
  normalizeCatalogPriceToINR,
} from "@/lib/india";
import { useAuth } from "@/context/AuthContext";

export default function WishlistPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [placingOrder, setPlacingOrder] = useState(false);
  const [razorpayReady, setRazorpayReady] = useState(false);

  const razorpayKeyId =
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() ||
    (typeof window !== "undefined" ? window.__ANTARIYA_RUNTIME_CONFIG__?.razorpayKeyId?.trim() || "" : "");

  // Poll for Razorpay SDK
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

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  // Load wishlist
  useEffect(() => {
    if (authLoading || !user) return;
    const token = localStorage.getItem("app_auth_token") || "";
    setLoadingItems(true);
    getWishlistFromBackend(token)
      .then((data) => {
        setItems(data);
        setSelectedIds(new Set(data.map((i) => i.id)));
      })
      .catch(() => toast({ title: "Failed to load wishlist", variant: "destructive" }))
      .finally(() => setLoadingItems(false));
  }, [authLoading, user, toast]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === items.length ? new Set() : new Set(items.map((i) => i.id)));
  };

  const handleRemove = async (item: WishlistItem) => {
    const token = localStorage.getItem("app_auth_token") || "";
    setRemovingId(item.id);
    try {
      await setWishlistItemOnBackend(token, item.productId, false);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(item.id); return next; });
      toast({ title: "Removed from wishlist" });
    } catch {
      toast({ title: "Failed to remove item", variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  const handleAddToCart = (item: WishlistItem) => {
    addProductToCart(item.product);
    toast({ title: "Added to cart", description: item.product.name });
  };

  const selectedItems = useMemo(() => items.filter((i) => selectedIds.has(i.id)), [items, selectedIds]);

  const subtotal = useMemo(
    () => selectedItems.reduce((sum, i) => sum + normalizeCatalogPriceToINR(Number(i.product.price)), 0),
    [selectedItems]
  );
  const shipping = subtotal > 0 && subtotal < INDIA_FREE_SHIPPING_THRESHOLD ? INDIA_STANDARD_SHIPPING : 0;
  const tax = subtotal * INDIA_GST_RATE;
  const total = subtotal + shipping + tax;

  const handleCheckout = async () => {
    if (selectedItems.length === 0) {
      toast({ title: "No items selected", description: "Select at least one item to checkout." });
      return;
    }

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
      const rzpOrder = await createRazorpayOrderOnBackend(token, {
        amount: amountInPaise,
        currency: "INR",
        receipt: `wishlist_${Date.now()}`,
      });

      const orderItems = selectedItems.map((i) => ({ productId: i.productId, quantity: 1 }));

      const paymentObject = new window.Razorpay({
        key: razorpayKeyId,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        name: "Antariya",
        description: "Wishlist checkout",
        order_id: rzpOrder.order_id,
        prefill: { name: customerName, email: customerEmail },
        notes: { source: "wishlist_checkout", items: String(selectedItems.length) },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await verifyRazorpayPaymentOnBackend(token, response);
            await createOrderOnBackend(token, orderItems);
            const params = new URLSearchParams({
              status: "success",
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              amount: String(total),
            });
            router.push(`/order-status?${params.toString()}`);
          } catch (err) {
            const reason = err instanceof Error ? err.message : "Payment verification failed. Please contact support.";
            router.push(`/order-status?${new URLSearchParams({ status: "failed", reason }).toString()}`);
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
        const reason = event?.error?.description || "Your payment could not be completed. Please try again.";
        router.push(`/order-status?${new URLSearchParams({ status: "failed", reason }).toString()}`);
      });

      paymentObject.open();
    } catch (err) {
      toast({ title: "Checkout failed", description: err instanceof Error ? err.message : "Failed to place order.", variant: "destructive" });
      setPlacingOrder(false);
    }
  };

  if (authLoading || loadingItems) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mb-6">
            <Heart className="w-12 h-12 text-rose-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your wishlist is empty</h1>
          <p className="text-gray-500 mb-8 max-w-md">
            Save items you love by tapping the heart icon on any product.
          </p>
          <Button asChild size="lg" className="rounded-full px-8">
            <Link href="/marketplace">Browse Marketplace</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setRazorpayReady(true)}
        onError={() => setRazorpayReady(false)}
      />
      <div className="min-h-screen bg-gray-50/50 flex flex-col">
        <Navbar />
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
                <Heart className="h-7 w-7 text-rose-500 fill-rose-500" />
                My Wishlist
              </h1>
              <p className="text-muted-foreground mt-1">{items.length} saved {items.length === 1 ? "item" : "items"}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-muted-foreground gap-2"
              onClick={toggleSelectAll}
            >
              {selectedIds.size === items.length
                ? <><CheckSquare className="h-4 w-4" /> Deselect All</>
                : <><Square className="h-4 w-4" /> Select All</>
              }
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

            {/* Items list */}
            <div className="lg:col-span-8 space-y-4">
              {items.map((item) => {
                const price = normalizeCatalogPriceToINR(Number(item.product.price));
                const selected = selectedIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl border transition-all shadow-sm p-5 flex gap-5 items-start ${selected ? "border-primary/40 shadow-primary/5" : "border-gray-100"}`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelect(item.id)}
                      className="mt-1 shrink-0 text-primary"
                      aria-label={selected ? "Deselect item" : "Select item"}
                    >
                      {selected
                        ? <CheckSquare className="h-5 w-5" />
                        : <Square className="h-5 w-5 text-gray-300" />
                      }
                    </button>

                    {/* Image */}
                    <Link href={`/product/${item.product.id}`} className="shrink-0">
                      <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-gray-100 border border-gray-100">
                        <Image src={item.product.image} alt={item.product.name} fill className="object-cover" />
                      </div>
                    </Link>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link href={`/product/${item.product.id}`}>
                            <h3 className="font-semibold text-gray-900 hover:text-primary transition-colors line-clamp-2">
                              {item.product.name}
                            </h3>
                          </Link>
                          <Badge variant="secondary" className="mt-1 rounded-full text-xs">{item.product.category}</Badge>
                        </div>
                        <span className="font-bold text-lg text-gray-900 shrink-0">{formatINR(price)}</span>
                      </div>

                      {item.product.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{item.product.description}</p>
                      )}

                      <div className="flex items-center gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full gap-2"
                          onClick={() => handleAddToCart(item)}
                        >
                          <ShoppingCart className="h-3.5 w-3.5" /> Add to Cart
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 gap-2"
                          onClick={() => handleRemove(item)}
                          disabled={removingId === item.id}
                        >
                          {removingId === item.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />
                          }
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-4">
              <Card className="sticky top-8 rounded-2xl shadow-sm border-gray-100">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 rounded-t-2xl pb-5">
                  <CardTitle className="text-xl">Order Summary</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedItems.length} of {items.length} items selected
                  </p>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {selectedItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Select items above to see the total.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {selectedItems.map((i) => (
                          <div key={i.id} className="flex justify-between text-sm text-gray-600">
                            <span className="line-clamp-1 flex-1 mr-2">{i.product.name}</span>
                            <span className="font-medium text-gray-900 shrink-0">
                              {formatINR(normalizeCatalogPriceToINR(Number(i.product.price)))}
                            </span>
                          </div>
                        ))}
                      </div>
                      <Separator />
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span>
                        <span className="font-medium text-gray-900">{formatINR(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Shipping</span>
                        <span className="font-medium text-gray-900">
                          {shipping === 0 ? <span className="text-green-600">Free</span> : formatINR(shipping)}
                        </span>
                      </div>
                      {shipping > 0 && (
                        <p className="text-xs text-muted-foreground text-right">
                          Free shipping above {formatINR(INDIA_FREE_SHIPPING_THRESHOLD)}
                        </p>
                      )}
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-gray-900">Total</span>
                        <span className="text-2xl font-bold text-gray-900">{formatINR(total)}</span>
                      </div>
                    </>
                  )}
                </CardContent>
                <CardFooter className="flex-col gap-3 pb-8">
                  <Button
                    className="w-full h-12 text-base rounded-full shadow-md hover:shadow-lg transition-shadow"
                    size="lg"
                    onClick={handleCheckout}
                    disabled={placingOrder || selectedItems.length === 0 || !razorpayReady || !razorpayKeyId}
                  >
                    {placingOrder ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing Payment...</>
                    ) : !razorpayKeyId ? (
                      "Razorpay Not Configured"
                    ) : !razorpayReady ? (
                      "Loading Payment Gateway..."
                    ) : (
                      <>Checkout Selected <ArrowRight className="ml-2 h-5 w-5" /></>
                    )}
                  </Button>
                  <Button variant="outline" className="w-full rounded-full" asChild>
                    <Link href="/marketplace">Continue Shopping</Link>
                  </Button>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-2">
                    <ShieldCheck className="h-4 w-4 text-green-500" />
                    <span>Secure India checkout (UPI / Cards / NetBanking)</span>
                  </div>
                </CardFooter>
              </Card>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
