"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Package, Heart, Download, Settings, Star, LayoutDashboard, Sparkles, ShoppingBag, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MOCK_PRODUCTS } from "@/app/lib/mock-data";

export default function CustomerDashboardClient({ user, recommendations }: any) {
  const [orders, setOrders] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedOrders = JSON.parse(localStorage.getItem('stitchmart_orders') || '[]');
    setOrders(savedOrders);
  }, []);

  if (!mounted) return null; // Avoid hydration mismatch

  const isNewCustomer = orders.length === 0;

  return (
    <div className="flex-1 flex flex-col lg:flex-row container mx-auto px-4 py-8 gap-8">
      {/* Sidebar - responsive: hidden on small screens */}
      <aside className="w-full lg:w-64 space-y-4">
        <div className="bg-card border shadow-sm rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
              {user.name.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-lg leading-tight">{user.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isNewCustomer ? "New Member" : "Silver Member"}
              </p>
            </div>
          </div>
          
          <div className="space-y-1">
            <Button variant="secondary" className="w-full justify-start gap-3 text-primary font-bold bg-primary/10">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground">
              <Package className="h-4 w-4" />
              My Orders {orders.length > 0 && <Badge className="ml-auto rounded-full bg-primary/20 text-primary border-none">{orders.length}</Badge>}
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground">
              <Download className="h-4 w-4" />
              Downloads {orders.length > 0 && <Badge className="ml-auto rounded-full bg-primary/20 text-primary border-none">12</Badge>}
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground">
              <Heart className="h-4 w-4" />
              Wishlist
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </div>
        </div>
        
        <div className="bg-primary p-6 rounded-2xl text-primary-foreground space-y-4 hidden lg:block shadow-lg shadow-primary/20">
          <p className="text-lg font-bold">Need Help?</p>
          <p className="text-sm text-primary-foreground/90 leading-relaxed">Our support team is available 24/7 for all your embroidery machine technical issues.</p>
          <Button size="sm" variant="secondary" className="w-full mt-2 rounded-full font-bold">
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
                <Badge variant="outline" className="border-primary text-primary font-bold tracking-widest px-3 py-1 bg-white">WELCOME TO STITCHMART</Badge>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">
                  Your Creative <br className="hidden md:block"/> Journey Begins Here.
                </h1>
                <p className="text-lg text-muted-foreground max-w-xl">
                  Explore our premium, industry-certified embroidery designs, robust machines, and exquisite base garments. As a new member, enjoy an exclusive <span className="text-primary font-bold">15% off</span> your first order!
                </p>
                <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                  <Button asChild size="lg" className="rounded-full h-12 px-8 shadow-lg shadow-primary/30">
                    <Link href="/shop">
                      Start Shopping <ArrowRight className="ml-2 h-4 w-4"/>
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="rounded-full h-12 px-8">
                    <Link href="/customize">
                      <Sparkles className="mr-2 h-4 w-4"/> Try AI Design Studio
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="hidden lg:block w-64 h-64 relative rounded-full overflow-hidden border-8 border-white shadow-xl bg-gray-100 flex-shrink-0">
                <Image src="https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&q=80&w=800" alt="Embroidery Splash" fill className="object-cover" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center mb-4"><ShoppingBag className="h-6 w-6"/></div>
                  <CardTitle>Shop Designs</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">Discover 10,000+ premium digital embroidery designs instantly downloadable.</p>
                  <Button variant="link" asChild className="p-0 text-blue-600"><Link href="/shop">Explore Library &rarr;</Link></Button>
                </CardContent>
              </Card>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center mb-4"><Sparkles className="h-6 w-6"/></div>
                  <CardTitle>AI Customization</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">Generate completely unique designs from text prompts using our AI Studio.</p>
                  <Button variant="link" asChild className="p-0 text-purple-600"><Link href="/customize">Open Studio &rarr;</Link></Button>
                </CardContent>
              </Card>
              <Card className="hover:shadow-md transition-shadow border-primary/20 bg-primary/5">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/20 text-primary rounded-xl flex items-center justify-center mb-4"><Star className="h-6 w-6"/></div>
                  <CardTitle>Member Perks</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">Complete your profile to earn 500 Loyalty points instantly!</p>
                  <Button variant="outline" size="sm" className="rounded-full w-full">Complete Profile</Button>
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
                  <p className="text-sm text-primary-foreground/90 bg-primary-foreground/10 inline-block px-3 py-1 rounded-full">+1 new today</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>Available Downloads</CardDescription>
                  <CardTitle className="text-4xl lg:text-5xl">12</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Designs ready to use</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>Loyalty Points</CardDescription>
                  <CardTitle className="text-4xl lg:text-5xl text-accent">1,250</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Redeemable for discounts</p>
                </CardContent>
              </Card>
            </div>

            <section className="space-y-4">
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
                      {orders.map((order, i) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-5 font-mono font-medium text-gray-900">{order.id}</td>
                          <td className="px-6 py-5 text-muted-foreground">{order.date}</td>
                          <td className="px-6 py-5">
                            <Badge className="bg-green-500/10 text-green-700 border-none shadow-none">{order.status}</Badge>
                          </td>
                          <td className="px-6 py-5 font-medium">{order.items?.length || 0}</td>
                          <td className="px-6 py-5 font-bold text-gray-900">${parseFloat(order.total).toFixed(2)}</td>
                          <td className="px-6 py-5 text-right">
                            <Button variant="secondary" size="sm" className="rounded-full shadow-sm">Details</Button>
                          </td>
                        </tr>
                      ))}
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
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations?.recommendations?.map((rec: any, idx: number) => {
              const mockMatch = MOCK_PRODUCTS.find(p => p.name.includes(rec.productName.split(' ')[0]));
              const product = mockMatch || MOCK_PRODUCTS[idx % MOCK_PRODUCTS.length];
              
              return (
                <Card key={idx} className="flex flex-col hover:shadow-lg transition-all duration-300 group overflow-hidden border-gray-100 shadow-sm cursor-pointer">
                  <div className="relative aspect-square sm:aspect-video w-full overflow-hidden bg-gray-100">
                    <Image 
                      src={product.image} 
                      alt={rec.productName} 
                      fill 
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-white/90 text-gray-900 backdrop-blur-sm border-none shadow-sm font-bold">
                        {rec.category}
                      </Badge>
                    </div>
                  </div>
                  <CardHeader className="p-5 pb-2">
                    <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">{rec.productName}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 flex-1 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{rec.reason}</p>
                  </CardContent>
                  <div className="p-5 pt-0 mt-auto flex items-center justify-between">
                    <span className="font-bold text-lg">${product.price.toFixed(2)}</span>
                    <Button size="sm" className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 shadow-md">
                      View Item <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

      </main>
    </div>
  );
}
