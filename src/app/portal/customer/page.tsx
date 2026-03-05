import { Navbar } from "@/components/navbar";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Package, Heart, Download, Settings, ShoppingBag, Star, LayoutDashboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CURRENT_USER, MOCK_PRODUCTS } from "@/app/lib/mock-data";
import { personalizedProductRecommendations } from "@/ai/flows/personalized-product-recommendations-flow";
import { ProductCard } from "@/components/product-card";

export default async function CustomerPortal() {
  // Simulate fetching personalized AI recommendations
  const recommendations = await personalizedProductRecommendations({
    userId: CURRENT_USER.id,
    browsingHistory: ["Floral patterns", "Zardosi design", "Silk threads"],
    pastPurchases: ["Machine needles", "10x10 Hoop"],
    currentQuery: "Premium embroidery designs for wedding garments"
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <div className="flex-1 flex container mx-auto px-4 py-8 gap-8">
        <aside className="w-64 hidden lg:block space-y-2">
          <div className="bg-card border rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                {CURRENT_USER.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold leading-none">{CURRENT_USER.name}</p>
                <p className="text-xs text-muted-foreground mt-1">Silver Member</p>
              </div>
            </div>
            
            <div className="space-y-1">
              <Button variant="ghost" className="w-full justify-start gap-3 bg-primary/5 text-primary font-bold">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <Package className="h-4 w-4" />
                My Orders
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <Download className="h-4 w-4" />
                Downloads
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <Heart className="h-4 w-4" />
                Wishlist
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <Star className="h-4 w-4" />
                My Reviews
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </div>
          </div>
          
          <div className="bg-secondary p-6 rounded-2xl text-white space-y-4">
            <p className="text-sm font-bold">Need Help?</p>
            <p className="text-xs text-white/80">Our support team is available 24/7 for all your embroidery machine technical issues.</p>
            <Button size="sm" variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
              Contact Support
            </Button>
          </div>
        </aside>

        <main className="flex-1 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <CardHeader className="pb-2">
                <CardDescription className="text-primary-foreground/70">Total Orders</CardDescription>
                <CardTitle className="text-4xl">12</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-primary-foreground/60">+2 since last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Available Downloads</CardDescription>
                <CardTitle className="text-4xl">45</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Designs ready to use</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Loyalty Points</CardTitle>
                <CardTitle className="text-4xl text-accent">1,250</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Redeemable for discounts</p>
              </CardContent>
            </Card>
          </div>

          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold font-headline flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI-Powered Recommendations
              </h2>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-none">Personalized for you</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendations.recommendations.map((rec, idx) => {
                // Find matching product from mock or show a placeholder
                const mockMatch = MOCK_PRODUCTS.find(p => p.name.includes(rec.productName.split(' ')[0]));
                const product = mockMatch || MOCK_PRODUCTS[idx % MOCK_PRODUCTS.length];
                
                return (
                  <Card key={idx} className="flex flex-col border-primary/20 bg-primary/5">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className="border-primary/30 text-primary text-[10px] uppercase">{rec.category}</Badge>
                      </div>
                      <CardTitle className="text-lg line-clamp-1">{rec.productName}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 flex-1 space-y-4">
                      <p className="text-xs text-muted-foreground italic leading-relaxed">"{rec.reason}"</p>
                      <div className="relative aspect-video rounded-lg overflow-hidden border">
                        <Image 
                          src={product.image} 
                          alt={rec.productName} 
                          fill 
                          className="object-cover"
                        />
                      </div>
                    </CardContent>
                    <div className="p-4 pt-0 mt-auto">
                      <Button className="w-full text-xs" size="sm">Quick View</Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold font-headline">Recent Purchases</h2>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold">
                    <tr>
                      <th className="px-6 py-4">Order ID</th>
                      <th className="px-6 py-4">Product</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-mono">ORD-9921</td>
                      <td className="px-6 py-4 font-medium">Royal Zardosi Floral Pack</td>
                      <td className="px-6 py-4 text-muted-foreground">Oct 12, 2023</td>
                      <td className="px-6 py-4">
                        <Badge className="bg-green-500/10 text-green-600 border-none hover:bg-green-500/10">Delivered</Badge>
                      </td>
                      <td className="px-6 py-4 font-bold">₹3,999</td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm">Details</Button>
                      </td>
                    </tr>
                    <tr className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-mono">ORD-8812</td>
                      <td className="px-6 py-4 font-medium">Precision Embroidery Hoop</td>
                      <td className="px-6 py-4 text-muted-foreground">Oct 08, 2023</td>
                      <td className="px-6 py-4">
                        <Badge className="bg-blue-500/10 text-blue-600 border-none hover:bg-blue-500/10">Shipped</Badge>
                      </td>
                      <td className="px-6 py-4 font-bold">₹2,240</td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm">Track</Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
}

import Image from "next/image";
import { Sparkles } from "lucide-react";