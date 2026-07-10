
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Navbar } from "@/components/navbar";
import { CartItem, getCartItems, setCartItems } from "@/lib/cart";
import {
  formatINR,
  INDIA_FREE_SHIPPING_THRESHOLD,
  INDIA_GST_RATE,
  INDIA_STANDARD_SHIPPING,
  normalizeCatalogPriceToINR,
} from "@/lib/india";

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(getCartItems());
  }, []);

  const persist = (nextItems: CartItem[]) => {
    setItems(nextItems);
    setCartItems(nextItems);
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      return;
    }

    persist(items.map((item) => (item.lineId === productId ? { ...item, quantity: newQuantity } : item)));
  };

  const removeItem = (productId: string) => {
    persist(items.filter((item) => item.lineId !== productId));
  };

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + normalizeCatalogPriceToINR(item.price) * item.quantity, 0),
    [items]
  );
  const shipping = subtotal >= INDIA_FREE_SHIPPING_THRESHOLD ? 0 : INDIA_STANDARD_SHIPPING;
  const tax = subtotal * INDIA_GST_RATE;
  const total = subtotal + shipping + tax;

  const handleCheckout = () => {
    const token = localStorage.getItem("app_auth_token");
    if (!token) { router.push("/login"); return; }
    router.push("/checkout");
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <ShoppingBag className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
          <p className="text-gray-500 mb-8 max-w-md text-center">
            Looks like you haven&apos;t added any premium embroidery supplies to your cart yet.
          </p>
          <Button asChild size="lg" className="rounded-full px-8">
            <Link href="/">Continue Shopping</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50/50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Shopping Cart</h1>
          <p className="text-muted-foreground font-medium">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-4 border-b border-gray-100 px-6 py-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-6">Product</div>
                <div className="col-span-3 text-center">Quantity</div>
                <div className="col-span-3 text-right">Total</div>
              </div>

              <div className="divide-y divide-gray-100">
                {items.map((item) => (
                  <div key={item.lineId} className="p-6 transition-colors hover:bg-gray-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                      <div className="md:col-span-6 flex items-start gap-4">
                        <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                          <Image src={item.image} alt={item.name} fill className="object-cover" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <h3 className="font-semibold text-gray-900 line-clamp-2">{item.name}</h3>
                          <p className="text-sm text-muted-foreground">{item.category}</p>
                          {item.customization && (
                            <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                              <p>
                                Symbol: <span className="font-medium text-gray-700">{item.customization.symbol}</span> | Thread: <span className="font-medium text-gray-700">{item.customization.threadColor}</span>
                              </p>
                              <p>
                                Cloth: <span className="font-medium text-gray-700">{item.customization.fabricColor}</span> | Size: <span className="font-medium text-gray-700">{item.customization.size}</span> | Placement: <span className="font-medium text-gray-700">{item.customization.placement}</span>
                              </p>
                              <p>
                                {item.customization.referenceImageName && (
                                  <>
                                    Reference: <span className="font-medium text-gray-700">{item.customization.referenceImageName}</span>
                                  </>
                                )}
                              </p>
                              {item.customization.notes && (
                                <p>
                                  Notes: <span className="font-medium text-gray-700">{item.customization.notes}</span>
                                </p>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-medium text-gray-900">{formatINR(normalizeCatalogPriceToINR(item.price))}</span>
                          </div>
                        </div>
                      </div>

                      <div className="md:col-span-3 flex justify-between md:justify-center items-center w-full">
                        <span className="md:hidden text-sm font-medium text-muted-foreground">Quantity:</span>
                        <div className="flex items-center rounded-full border border-gray-200 bg-white p-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-muted-foreground hover:text-gray-900"
                            onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-muted-foreground hover:text-gray-900"
                            onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="md:col-span-3 flex justify-between md:justify-end items-center">
                        <span className="md:hidden text-sm font-medium text-muted-foreground">Total:</span>
                        <div className="flex items-center gap-4">
                          <span className="font-semibold text-lg text-gray-900">{formatINR(normalizeCatalogPriceToINR(item.price) * item.quantity)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-red-500 hover:bg-red-50"
                            onClick={() => removeItem(item.lineId)}
                            aria-label={`Remove ${item.name} from cart`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <Card className="sticky top-8 rounded-2xl shadow-sm border-gray-100">
              <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-6 rounded-t-2xl">
                <CardTitle className="text-xl">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between items-center text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium text-gray-900">{formatINR(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-gray-600">
                  <span>Shipping</span>
                  <span className="font-medium text-gray-900">{shipping === 0 ? <span className="text-green-600">Free</span> : formatINR(shipping)}</span>
                </div>
                {shipping > 0 && (
                  <p className="text-xs text-muted-foreground text-right mt-1">Free shipping on orders above {formatINR(INDIA_FREE_SHIPPING_THRESHOLD)}</p>
                )}

                <Separator className="my-4" />

                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-gray-900">{formatINR(total)}</span>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-4 pb-8">
                <Button
                  className="w-full h-12 text-base rounded-full shadow-md hover:shadow-lg transition-shadow"
                  size="lg"
                  onClick={handleCheckout}
                >
                  Proceed to Checkout
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-4">
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                  <span>Secure India checkout · UPI / COD</span>
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
