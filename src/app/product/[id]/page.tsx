"use client";

import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ShoppingCart, 
  Heart, 
  Download, 
  Star, 
  ShieldCheck, 
  Truck, 
  Sparkles,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import Image from "next/image";
import { useState, use, useMemo } from "react";
import { embroideryDesignVisualizer } from "@/ai/flows/embroidery-design-visualizer";
import { useFirestore, useDoc } from "@/firebase";
import { doc } from "firebase/firestore";
import { Product } from "@/app/lib/mock-data";
import Link from "next/link";

export default function ProductDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useFirestore();
  
  const productRef = useMemo(() => doc(db, "products", id) as any, [db, id]);
  const { data: product, loading, error } = useDoc<Product>(productRef);

  const [visualizing, setVisualizing] = useState(false);
  const [visualizedImg, setVisualizedImg] = useState<string | null>(null);

  const handleVisualize = async () => {
    if (!product) return;
    setVisualizing(true);
    try {
      const result = await embroideryDesignVisualizer({
        embroideryDesignImage: product.image,
        fabricType: "cotton",
        fabricColor: "neutral"
      });
      if (result.visualizedImage) {
        setVisualizedImg(result.visualizedImage);
      }
    } catch (err) {
      console.error("Visualization failed", err);
    } finally {
      setVisualizing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <RefreshCw className="h-12 w-12 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium">Fetching product details...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-6">
          <div className="w-20 h-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center">
            <AlertCircle className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold font-headline">Product Not Found</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              We couldn't find the product you're looking for. It might have been removed or the ID is incorrect.
            </p>
          </div>
          <Button asChild className="rounded-full px-8 h-12">
            <Link href="/marketplace">Back to Marketplace</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Image Display */}
          <div className="space-y-6">
            <div className="relative aspect-square rounded-[40px] overflow-hidden bg-muted border shadow-2xl group">
              <Image 
                src={visualizedImg || product.image} 
                alt={product.name} 
                fill 
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              {visualizedImg && (
                <div className="absolute top-6 left-6">
                  <Badge className="bg-primary/90 backdrop-blur-md shadow-xl border-none px-4 py-2 text-sm font-bold flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> AI Preview
                  </Badge>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-4 gap-4">
              {[product.image, "https://picsum.photos/seed/alt1/600/600", "https://picsum.photos/seed/alt2/600/600"].map((img, i) => (
                <button 
                  key={i}
                  onClick={() => setVisualizedImg(null)}
                  className="relative aspect-square rounded-2xl overflow-hidden border-2 border-transparent hover:border-primary transition-all opacity-80 hover:opacity-100"
                >
                  <Image src={img} alt={`${product.name} ${i}`} fill className="object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="flex flex-col space-y-10">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="bg-primary/10 text-primary border-none uppercase tracking-widest px-4 py-1 font-bold">{product.category}</Badge>
                <div className="flex items-center gap-1.5 text-accent">
                  <Star className="h-5 w-5 fill-current" />
                  <span className="font-bold text-foreground text-lg">{product.rating}</span>
                  <span className="text-muted-foreground text-sm">(Verified Purchases)</span>
                </div>
              </div>
              
              <h1 className="text-5xl lg:text-6xl font-bold font-headline leading-tight">{product.name}</h1>
              
              <div className="flex items-center gap-6">
                <span className="text-4xl font-bold text-primary">₹{(product.price * 80).toLocaleString()}</span>
                <Badge className="bg-green-500/10 text-green-600 border-none px-4 py-1 text-sm font-bold">In Stock: {product.stock}</Badge>
              </div>
              
              <p className="text-xl text-muted-foreground leading-relaxed">{product.description}</p>
            </div>

            <div className="p-8 rounded-[32px] bg-card border border-border/50 shadow-sm space-y-8">
              <div className="flex flex-col sm:flex-row gap-4">
                <Button asChild size="lg" variant="outline" className="flex-1 h-14 rounded-2xl text-lg font-bold border-primary/40 text-primary hover:bg-primary/5 transition-all">
                  <Link href="/cart">
                    <ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart
                  </Link>
                </Button>
                <Button asChild size="lg" className="flex-1 h-14 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all">
                  <Link href="/cart">
                    Buy Now
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-14 rounded-2xl border-primary/20 text-primary hover:bg-primary/5 px-6">
                  <Heart className="h-6 w-6" />
                </Button>
              </div>

              {product.category === 'Embroidery Designs' && (
                <Button 
                  onClick={handleVisualize} 
                  disabled={visualizing}
                  variant="secondary"
                  className="w-full h-14 rounded-2xl bg-secondary text-white font-bold text-lg hover:bg-secondary/90 transition-all flex items-center justify-center gap-3"
                >
                  {visualizing ? <RefreshCw className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
                  {visualizing ? "Magic in progress..." : "Try with AI Visualizer"}
                </Button>
              )}

              {product.customizable && (
                <Button asChild variant="secondary" className="w-full h-14 rounded-2xl bg-secondary text-white font-bold text-lg">
                  <Link href="/customize">Start Customizing this Piece</Link>
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex items-center gap-5 p-4 rounded-2xl bg-muted/30 border border-border/40">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm shrink-0">
                  <Truck className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold">Fast Delivery</p>
                  <p className="text-xs text-muted-foreground">3-5 days across India</p>
                </div>
              </div>
              <div className="flex items-center gap-5 p-4 rounded-2xl bg-muted/30 border border-border/40">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm shrink-0">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold">Quality Guaranteed</p>
                  <p className="text-xs text-muted-foreground">Premium materials only</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Tabs */}
        <div className="mt-32">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-auto p-0 mb-12 gap-8 overflow-x-auto">
              {["details", "specs", "reviews"].map(tab => (
                <TabsTrigger 
                  key={tab}
                  value={tab} 
                  className="rounded-none border-b-4 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-4 px-4 font-bold text-xl uppercase tracking-widest transition-all"
                >
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>
            
            <TabsContent value="details" className="prose prose-stone max-w-none">
              <h3 className="text-4xl font-bold mb-8 font-headline">Why choose this product?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-lg text-muted-foreground leading-relaxed">
                <p>
                  Crafted with precision and inspired by India's rich textile heritage, this product is designed to meet the highest industrial standards. Every element is tested for durability and aesthetic appeal.
                </p>
                <p>
                  Whether you are a professional designer or a hobbyist, StitchMart ensures that you receive only the most authentic and high-quality materials for your creative journey.
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="specs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-6">
                {[
                  { label: "Material", value: "Premium Grade" },
                  { label: "Category", value: product.category },
                  { label: "Dealer Location", value: "Surat, India" },
                  { label: "Compatibility", value: "Industrial & Home Machines" }
                ].map((spec, i) => (
                  <div key={i} className="flex justify-between py-5 border-b border-border/50">
                    <span className="text-muted-foreground font-medium text-lg">{spec.label}</span>
                    <span className="font-bold text-lg">{spec.value}</span>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
