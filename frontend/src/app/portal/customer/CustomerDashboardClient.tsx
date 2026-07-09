"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Package, Heart, Download, Settings, Star, LayoutDashboard, Sparkles, ShoppingBag, ArrowRight, ChevronDown, Mail, Phone, MessageCircle, MessageSquare, User as UserIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { type Product } from "@/app/lib/mock-data";
import { getMyOrdersFromBackend } from "@/lib/api/orders";
import { getWishlistFromBackend, WishlistItem } from "@/lib/api/wishlist";
import { getProductsFromBackend } from "@/lib/api/products";
import { formatINR, formatIndianDate, normalizeCatalogPriceToINR } from "@/lib/india";
import { clearAuthSession, getPortalPathForRole } from "@/lib/auth-session";
import { getCustomerProfileFromBackend, type CustomerProfileData } from "@/lib/api/customerProfile";
import { useAuth } from "@/context/AuthContext";

type RecommendationCard = {
  product: Product;
  reason: string;
};

function buildRecommendations(products: Product[], orders: any[], wishlist: WishlistItem[]): RecommendationCard[] {
  const productById = new Map(products.map((product) => [product.id, product]));
  const categoryScores = new Map<string, number>();
  const productIdsFromWishlist = new Set<string>();
  const productIdsFromOrders = new Set<string>();

  const addScore = (category: string | undefined, weight: number) => {
    if (!category) {
      return;
    }
    categoryScores.set(category, (categoryScores.get(category) || 0) + weight);
  };

  wishlist.forEach((item) => {
    productIdsFromWishlist.add(item.product.id);
    addScore(item.product.category, 3);
  });

  orders.forEach((order) => {
    order.items.forEach((orderItem: { productId?: string }) => {
      if (!orderItem.productId) {
        return;
      }

      productIdsFromOrders.add(orderItem.productId);
      const product = productById.get(orderItem.productId);
      addScore(product?.category, 2);
    });
  });

  const rankedProducts = [...products].sort((left, right) => {
    const leftScore = categoryScores.get(left.category) || 0;
    const rightScore = categoryScores.get(right.category) || 0;

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    if (right.rating !== left.rating) {
      return right.rating - left.rating;
    }

    return right.stock - left.stock;
  });

  return rankedProducts.slice(0, 3).map((product) => {
    let reason = `Trending now in ${product.category}.`;

    if (productIdsFromWishlist.has(product.id)) {
      reason = "You already saved this item, so it is a strong match for your wishlist.";
    } else if (productIdsFromOrders.has(product.id)) {
      reason = "Built around a product you already ordered, with a similar style and fit.";
    } else if ((categoryScores.get(product.category) || 0) > 0) {
      reason = `Matches your interest in ${product.category}.`;
    }

    return { product, reason };
  });
}

export default function CustomerDashboardClient() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const [customerProfile, setCustomerProfile] = useState<CustomerProfileData | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationCard[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);

  const scrollToSection = (id: string) => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openProfile = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("antariya-open-profile"));
    }
  };

  useEffect(() => {
    if (authLoading) return;

    if (!authUser) {
      router.replace("/");
      return;
    }

    if (authUser.role !== "customer") {
      router.replace(getPortalPathForRole(authUser.role));
      return;
    }

    const token = localStorage.getItem("app_auth_token") || "";

    const loadData = async () => {
      const [backendOrders] = await Promise.all([
        getMyOrdersFromBackend(token),
        getCustomerProfileFromBackend(token)
          .then((profile) => setCustomerProfile(profile))
          .catch(() => null),
      ]);
      setOrders(backendOrders);
      try {
        const wishlistItems = await getWishlistFromBackend(token);
        setWishlist(wishlistItems);
        try {
          const catalog = await getProductsFromBackend({ limit: 24 });
          setRecommendations(buildRecommendations(catalog.products, backendOrders, wishlistItems));
        } catch { setRecommendations([]); }
      } catch {
        try {
          const catalog = await getProductsFromBackend({ limit: 24 });
          setRecommendations(buildRecommendations(catalog.products, backendOrders, []));
        } catch { setRecommendations([]); }
      }
      setDataLoaded(true);
    };

    void loadData();
  }, [authUser, authLoading, router]);

  if (authLoading || !authUser) return null;

  const user = { name: authUser.displayName || "Customer", email: authUser.email, photoURL: authUser.photoURL };
  const isNewCustomer = orders.length === 0;
  const purchasedItemsCount = orders.reduce((sum, order) => sum + (order.items?.length || 0), 0);
  const today = new Date().toDateString();
  const todayOrdersCount = orders.filter((o) => new Date(o.createdAt).toDateString() === today).length;

  return (
    <div className="flex-1 flex flex-col w-full">
    <div className="flex flex-col lg:flex-row w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6 py-8 gap-8">
      {/* Sidebar - responsive: hidden on small screens */}
      <aside className="w-full lg:w-64 space-y-4">
        <div className="bg-card border shadow-sm rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-4">
            {customerProfile?.photoURL || user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={customerProfile?.photoURL || user.photoURL || undefined}
                alt="Avatar"
                className="h-12 w-12 rounded-full object-cover border shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-primary font-bold text-lg">{user.name?.[0]?.toUpperCase() || "C"}</span>
              </div>
            )}
            <div>
              <p className="font-bold text-lg leading-tight">{user.name}</p>
              <p className="text-sm text-muted-foreground mt-1 capitalize">
                {customerProfile?.membershipTier ?? (isNewCustomer ? "New Member" : "Silver Member")}
              </p>
            </div>
          </div>
          
          <div className="space-y-1">
            <Button variant="secondary" className="w-full justify-start gap-3 text-primary font-bold bg-primary/10" asChild>
              <Link href="/portal/customer"><LayoutDashboard className="h-4 w-4" />Dashboard</Link>
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground" onClick={() => scrollToSection("orders")}>
              <Package className="h-4 w-4" />
              My Orders {orders.length > 0 && <Badge className="ml-auto rounded-full bg-primary/20 text-primary border-none">{orders.length}</Badge>}
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground" onClick={() => scrollToSection("wishlist")}>
              <Download className="h-4 w-4" />
              Purchases {purchasedItemsCount > 0 && <Badge className="ml-auto rounded-full bg-primary/20 text-primary border-none">{purchasedItemsCount}</Badge>}
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground" asChild>
              <Link href="/wishlist"><Heart className="h-4 w-4" />Wishlist</Link>
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground" onClick={openProfile}>
              <Settings className="h-4 w-4" />Settings
            </Button>
          </div>
        </div>
        
        <div className="bg-primary p-6 rounded-2xl text-primary-foreground space-y-4 hidden lg:block shadow-lg shadow-primary/20">
          <p className="text-lg font-bold">Need Help?</p>
          <p className="text-sm text-primary-foreground/90 leading-relaxed">Our support team is available for embroidery orders, customization, and product help.</p>
          <Button size="sm" variant="secondary" className="w-full mt-2 rounded-full font-bold" onClick={() => setSupportOpen(true)}>
            Contact Support
          </Button>
        </div>
      </aside>

      <main className="flex-1 space-y-10">
        
        {isNewCustomer ? (
          // --- NEW CUSTOMER DASHBOARD ---
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-3xl p-8 sm:p-12 text-center md:text-left flex flex-col md:flex-row items-center gap-8 shadow-sm">
              <div className="flex-1 space-y-4">
                <Badge variant="outline" className="border-primary text-primary font-bold tracking-widest px-3 py-1 bg-white">WELCOME TO ANTARIYA</Badge>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">
                  Your Creative <br className="hidden md:block"/> Journey Begins Here.
                </h1>
                <p className="text-lg text-muted-foreground max-w-xl">
                  Explore our premium, industry-certified embroidery designs, robust machines, and exquisite base garments. As a new member, ask support about the latest welcome offers available on live orders.
                </p>
                <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                  <Button asChild size="lg" className="rounded-full h-12 px-8 shadow-lg shadow-primary/30">
                    <Link href="/shop">
                      Start Shopping <ArrowRight className="ml-2 h-4 w-4"/>
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="rounded-full h-12 px-8">
                    <Link href="/customize">
                      <Sparkles className="mr-2 h-4 w-4"/> Build From Scratch
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="hidden lg:flex w-64 h-64 relative rounded-full overflow-hidden border-8 border-white shadow-xl bg-gradient-to-br from-primary via-primary/70 to-accent flex-shrink-0 items-center justify-center text-center px-6">
                <div className="space-y-2 text-white">
                  <Sparkles className="h-10 w-10 mx-auto" />
                  <p className="text-lg font-bold">Live Studio</p>
                  <p className="text-sm text-white/80">Orders, designs, and support update from your account</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center mb-4"><ShoppingBag className="h-6 w-6"/></div>
                  <CardTitle>Shop Designs</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">Browse live embroidery designs, garments, and supplies from the current catalog.</p>
                  <Button variant="link" asChild className="p-0 text-blue-600"><Link href="/shop">Explore Library &rarr;</Link></Button>
                </CardContent>
              </Card>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center mb-4"><Sparkles className="h-6 w-6"/></div>
                  <CardTitle>AI Customization</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">Generate completely unique designs from text prompts using the scratch-build studio.</p>
                  <Button variant="link" asChild className="p-0 text-purple-600"><Link href="/customize">Open Builder &rarr;</Link></Button>
                </CardContent>
              </Card>
              <Card className="hover:shadow-md transition-shadow border-primary/20 bg-primary/5">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/20 text-primary rounded-xl flex items-center justify-center mb-4"><Star className="h-6 w-6"/></div>
                  <CardTitle>Member Perks</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">Complete your profile to unlock loyalty rewards tied to your live orders.</p>
                  <Button variant="outline" size="sm" className="rounded-full w-full" onClick={openProfile}>Complete Profile</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          // --- RETURNING CUSTOMER DASHBOARD ---
          <div className="space-y-8 animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back, {user.name.split(' ')[0]}!</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <CardHeader className="pb-2">
                  <CardDescription className="text-primary-foreground/80 font-medium">Total Orders</CardDescription>
                  <CardTitle className="text-4xl lg:text-5xl">{orders.length}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-primary-foreground/90 bg-primary-foreground/10 inline-block px-3 py-1 rounded-full">{todayOrdersCount > 0 ? `+${todayOrdersCount} new today` : "No new orders today"}</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>Purchased Items</CardDescription>
                  <CardTitle className="text-4xl lg:text-5xl">{purchasedItemsCount}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Items across all completed and active orders</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>Rewards Status</CardDescription>
                  <CardTitle className="text-2xl font-semibold text-accent">Live</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Redeemable for discounts</p>
                </CardContent>
              </Card>
            </div>

            <section id="orders" className="space-y-4 scroll-mt-24">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Recent Purchases</h2>
                <Button variant="outline" size="sm" className="rounded-full" asChild>
                  <Link href="/shop">Shop More</Link>
                </Button>
              </div>
              <Card className="overflow-hidden shadow-sm border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-gray-50/80 text-muted-foreground uppercase text-[11px] font-bold tracking-wider">
                      <tr>
                        <th className="px-6 py-5">Order ID</th>
                        <th className="px-6 py-5">Date</th>
                        <th className="px-6 py-5">Status</th>
                        <th className="px-6 py-5">Total Items</th>
                        <th className="px-6 py-5">Amount</th>
                        <th className="px-6 py-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {orders.map((order, i) => {
                        const isOpen = expandedOrderId === order.id;
                        return (
                        <>
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-5 font-mono font-medium text-gray-900">{order.id}</td>
                          <td className="px-6 py-5 text-muted-foreground">{formatIndianDate(order.createdAt)}</td>
                          <td className="px-6 py-5">
                            <Badge className="bg-green-500/10 text-green-700 border-none shadow-none">{order.status}</Badge>
                          </td>
                          <td className="px-6 py-5 font-medium">{order.items?.length || 0}</td>
                          <td className="px-6 py-5 font-bold text-gray-900">{formatINR(Number(order.total || 0))}</td>
                          <td className="px-6 py-5 text-right">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="rounded-full shadow-sm gap-1"
                              onClick={() => setExpandedOrderId(isOpen ? null : order.id)}
                            >
                              Details <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                            </Button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={`${i}-details`} className="bg-gray-50/40">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="space-y-3">
                                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Items in this order</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {(order.items || []).map((item: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3">
                                      {item.image ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={item.image} alt={item.name} className="h-14 w-14 rounded-lg object-cover border shrink-0" />
                                      ) : (
                                        <div className="h-14 w-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><Package className="h-5 w-5 text-gray-400" /></div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold truncate">{item.name}</p>
                                        {item.variant && (item.variant.size || item.variant.color) ? (
                                          <p className="text-xs text-muted-foreground truncate">
                                            {[item.variant.size, item.variant.color, item.variant.gender].filter(Boolean).join(" · ")}
                                          </p>
                                        ) : null}
                                        <p className="text-xs text-muted-foreground">Qty {item.quantity} · {formatINR(Number(item.price || 0))}</p>
                                      </div>
                                      <Link href={`/product/${item.productId}`} className="text-xs font-semibold text-primary hover:underline shrink-0">View</Link>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex flex-wrap gap-4 pt-2 text-sm">
                                  <span className="text-muted-foreground">Subtotal: <span className="font-semibold text-foreground">{formatINR(Number(order.subtotal || 0))}</span></span>
                                  <span className="text-muted-foreground">Shipping: <span className="font-semibold text-foreground">{formatINR(Number(order.shipping || 0))}</span></span>
                                  <span className="text-muted-foreground">Tax: <span className="font-semibold text-foreground">{formatINR(Number(order.tax || 0))}</span></span>
                                  <span className="text-muted-foreground">Total: <span className="font-bold text-foreground">{formatINR(Number(order.total || 0))}</span></span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </section>
          </div>
        )}

        {/* AI Recommendations - Show for both, very e-commerce feature! */}
        <section className="space-y-6 pt-8 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {isNewCustomer ? "Trending For You" : "AI-Powered Recommendations"}
            </h2>
            <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20">{isNewCustomer ? "Welcome Picks" : "Personalized"}</Badge>
          </div>
          
          {recommendations.length === 0 ? (
            <Card className="border-dashed border-gray-200 shadow-sm">
              <CardContent className="p-6 text-sm text-muted-foreground">
                Recommendations will appear once live products and customer activity are available.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendations.map((rec) => {
                const product = rec.product;

                return (
                  <Card key={product.id} className="flex flex-col hover:shadow-lg transition-all duration-300 group overflow-hidden border-gray-100 shadow-sm">
                    <Link href={`/product/${product.id}`} className="contents">
                    <div className="relative aspect-square sm:aspect-video w-full overflow-hidden bg-gray-100">
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-3 left-3">
                        <Badge className="bg-white/90 text-gray-900 backdrop-blur-sm border-none shadow-sm font-bold">
                          {product.category}
                        </Badge>
                      </div>
                    </div>
                    <CardHeader className="p-5 pb-2">
                      <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">{product.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 pt-0 flex-1 space-y-4">
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{rec.reason}</p>
                    </CardContent>
                    <div className="p-5 pt-0 mt-auto flex items-center justify-between">
                      <span className="font-bold text-lg">{formatINR(normalizeCatalogPriceToINR(Number(product.price || 0)))}</span>
                      <Button size="sm" className="rounded-full shadow-md">
                        View Item <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </Link>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

            <section id="wishlist" className="space-y-4 scroll-mt-24">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  <Heart className="h-5 w-5 text-rose-600" />
                  Saved Wishlist
                </h2>
                <Badge variant="secondary" className="rounded-full">{wishlist.length} items</Badge>
              </div>

              {wishlist.length === 0 ? (
                <Card className="border-dashed border-gray-200 shadow-sm">
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    Your wishlist is empty. Tap the heart on any product to save it here.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {wishlist.map((item) => (
                    <Card key={item.id} className="overflow-hidden shadow-sm border-gray-100">
                      <div className="relative aspect-square bg-gray-100">
                        <Image src={item.product.image} alt={item.product.name} fill className="object-cover" />
                      </div>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="secondary" className="rounded-full">{item.product.category}</Badge>
                          <span className="text-xs font-semibold text-muted-foreground">{formatINR(normalizeCatalogPriceToINR(Number(item.product.price || 0)))}</span>
                        </div>
                        <h3 className="font-semibold text-lg line-clamp-1">{item.product.name}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.product.description}</p>
                        <Button asChild size="sm" className="rounded-full w-full">
                          <Link href={`/product/${item.product.id}`}>View Product</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

      </main>
    </div>

    {/* Contact Support dialog */}
    <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" /> Contact Support</DialogTitle>
          <DialogDescription>
            We&apos;re here to help with orders, customization, and product questions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <a
            href="mailto:antariyaofficial@gmail.com?subject=Support%20request%20from%20my%20account"
            className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 hover:border-primary/50 transition-colors"
          >
            <Mail className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold">Email us</p>
              <p className="text-xs text-muted-foreground">antariyaofficial@gmail.com</p>
            </div>
          </a>
          <a
            href="tel:+917013296469"
            className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 hover:border-primary/50 transition-colors"
          >
            <Phone className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold">Call us</p>
              <p className="text-xs text-muted-foreground">+91 70132 96469 · Available 24/7 for orders</p>
            </div>
          </a>
          <a
            href="https://wa.me/917013296469?text=Hi%20Antariya%2C%20I%20need%20help%20with%20my%20order"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 hover:border-primary/50 transition-colors"
          >
            <MessageCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold">WhatsApp chat</p>
              <p className="text-xs text-muted-foreground">Chat with us on WhatsApp · fastest replies</p>
            </div>
          </a>
          <Link
            href="/legal/policies"
            onClick={() => setSupportOpen(false)}
            className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 hover:border-primary/50 transition-colors"
          >
            <UserIcon className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold">Policies &amp; FAQs</p>
              <p className="text-xs text-muted-foreground">Shipping, returns, and account help</p>
            </div>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
    </div>
  );
}
