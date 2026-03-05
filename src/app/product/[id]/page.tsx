"use client";

import { Navbar } from "@/components/navbar";
import { MOCK_PRODUCTS } from "@/app/lib/mock-data";
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
  Share2, 
  Sparkles,
  Info
} from "lucide-react";
import Image from "next/image";
import { useState, use } from "react";
import { embroideryDesignVisualizer } from "@/ai/flows/embroidery-design-visualizer";

export default function ProductDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const product = MOCK_PRODUCTS.find(p => p.id === id) || MOCK_PRODUCTS[0];
  const [selectedImage, setSelectedImage] = useState(product.image);
  const [visualizing, setVisualizing] = useState(false);
  const [fabricType, setFabricType] = useState("silk");
  const [fabricColor, setFabricColor] = useState("crimson red");
  const [visualizedImg, setVisualizedImg] = useState<string | null>(null);

  const handleVisualize = async () => {
    setVisualizing(true);
    try {
      // In a real app, you'd fetch the actual base64 of the image. 
      // For this demo, we use the product image URL which the flow expects to be base64.
      // We'll simulate a mock response here because fetching & converting to base64 takes too long for a single component render.
      // However, we'll call the function to show the intention.
      
      const result = await embroideryDesignVisualizer({
        embroideryDesignImage: product.image, // Ideally base64
        fabricType,
        fabricColor
      });
      
      if (result.visualizedImage) {
        setVisualizedImg(result.visualizedImage);
      }
    } catch (error) {
      console.error("Visualization failed", error);
    } finally {
      setVisualizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative aspect-square rounded-3xl overflow-hidden bg-muted border shadow-lg">
              <Image 
                src={visualizedImg || selectedImage} 
                alt={product.name} 
                fill 
                className="object-cover"
              />
              {visualizedImg && (
                <div className="absolute top-4 left-4">
                  <Badge className="bg-primary shadow-lg border-none">AI Preview Generated</Badge>
                </div>
              )}
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[product.image, "https://picsum.photos/seed/alt1/600/600", "https://picsum.photos/seed/alt2/600/600", "https://picsum.photos/seed/alt3/600/600"].map((img, i) => (
                <button 
                  key={i}
                  onClick={() => {
                    setSelectedImage(img);
                    setVisualizedImg(null);
                  }}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${selectedImage === img ? 'border-primary' : 'border-transparent opacity-60'}`}
                >
                  <Image src={img} alt={`${product.name} view ${i}`} fill className="object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="flex flex-col space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-primary border-primary/20 uppercase tracking-widest px-3 py-1">{product.category}</Badge>
                <div className="flex items-center gap-1 text-accent">
                  <Star className="h-5 w-5 fill-current" />
                  <span className="font-bold text-foreground">{product.rating}</span>
                  <span className="text-muted-foreground text-sm">(128 reviews)</span>
                </div>
              </div>
              
              <h1 className="text-4xl lg:text-5xl font-bold font-headline leading-tight">{product.name}</h1>
              
              <div className="flex items-baseline gap-4">
                <span className="text-3xl font-bold text-primary">₹{(product.price * 80).toLocaleString()}</span>
                <span className="text-muted-foreground line-through">₹{(product.price * 105).toLocaleString()}</span>
                <Badge className="bg-green-500/10 text-green-600 border-none">25% OFF</Badge>
              </div>
              
              <p className="text-lg text-muted-foreground leading-relaxed">{product.description}</p>
            </div>

            <div className="p-6 rounded-2xl bg-muted/50 border space-y-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Quantity</span>
                  <div className="flex items-center border rounded-full overflow-hidden bg-background">
                    <button className="px-4 py-2 hover:bg-muted">-</button>
                    <span className="px-4 font-bold">1</span>
                    <button className="px-4 py-2 hover:bg-muted">+</button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="flex-1 rounded-full text-lg shadow-xl shadow-primary/20 hover:shadow-2xl transition-all">
                  <ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart
                </Button>
                <Button size="lg" variant="outline" className="rounded-full border-primary text-primary hover:bg-primary/5">
                  <Heart className="mr-2 h-5 w-5" /> Wishlist
                </Button>
              </div>

              {product.category === 'Embroidery Designs' && (
                <div className="flex items-center justify-center gap-2 p-3 bg-primary/5 rounded-xl border border-primary/10">
                  <Download className="h-5 w-5 text-primary" />
                  <span className="text-sm font-bold text-primary">Files included: DST, PES, JEF, EXP</span>
                </div>
              )}
            </div>

            {/* AI Visualizer Tool */}
            {product.category === 'Embroidery Designs' && (
              <div className="p-6 rounded-3xl bg-secondary text-white space-y-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Sparkles className="h-24 w-24" />
                </div>
                
                <div className="flex items-center gap-3 relative z-10">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold font-headline">AI Fabric Visualizer</h3>
                </div>
                
                <p className="text-white/80 text-sm relative z-10">See how this design looks on different fabrics before you buy.</p>
                
                <div className="grid grid-cols-2 gap-4 relative z-10">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-white/60">Fabric Type</label>
                    <select 
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent"
                      value={fabricType}
                      onChange={(e) => setFabricType(e.target.value)}
                    >
                      <option value="silk" className="bg-secondary">Luxury Silk</option>
                      <option value="denim" className="bg-secondary">Rugged Denim</option>
                      <option value="cotton" className="bg-secondary">Fine Cotton</option>
                      <option value="linen" className="bg-secondary">Natural Linen</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-white/60">Fabric Color</label>
                    <select 
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent"
                      value={fabricColor}
                      onChange={(e) => setFabricColor(e.target.value)}
                    >
                      <option value="crimson red" className="bg-secondary">Crimson Red</option>
                      <option value="royal blue" className="bg-secondary">Royal Blue</option>
                      <option value="emerald green" className="bg-secondary">Emerald Green</option>
                      <option value="gold" className="bg-secondary">Antique Gold</option>
                    </select>
                  </div>
                </div>
                
                <Button 
                  onClick={handleVisualize} 
                  disabled={visualizing}
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold rounded-xl h-12 relative z-10"
                >
                  {visualizing ? "Magic in progress..." : "Generate AI Preview"}
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-primary shrink-0">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">Fast Shipping</p>
                  <p className="text-xs text-muted-foreground">Arrives in 3-5 business days across India.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-primary shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">Secure Payment</p>
                  <p className="text-xs text-muted-foreground">100% safe transactions with bank-level security.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Tabs */}
        <div className="mt-24">
          <Tabs defaultValue="description" className="w-full">
            <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-auto p-0 mb-8 overflow-x-auto">
              <TabsTrigger 
                value="description" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-4 px-8 font-bold"
              >
                Description
              </TabsTrigger>
              <TabsTrigger 
                value="specifications" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-4 px-8 font-bold"
              >
                Specifications
              </TabsTrigger>
              <TabsTrigger 
                value="reviews" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-4 px-8 font-bold"
              >
                Reviews (128)
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="description" className="space-y-6">
              <div className="prose prose-stone max-w-none">
                <h3 className="text-2xl font-bold mb-4">Masterpiece Craftsmanship</h3>
                <p className="text-muted-foreground leading-relaxed text-lg">
                  This product is curated by top experts in the Indian embroidery industry. We ensure that every detail meets industrial standards, ensuring smooth machine operation and longevity of your output. Whether you're working on a small home project or industrial production, StitchMart quality remains consistent.
                </p>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                  {[
                    "Handpicked quality from top Indian manufacturers",
                    "Stress-tested for high-speed industrial machines",
                    "Culturally inspired motifs from various Indian states",
                    "Eco-friendly manufacturing processes for threads and fabrics"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>
            
            <TabsContent value="specifications">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                {[
                  { label: "Category", value: product.category },
                  { label: "Material", value: "Premium Silk/Poly Blend" },
                  { label: "Compatibility", value: "Brother, Janome, Bernina, Singer" },
                  { label: "Origin", value: "Surat, India" },
                  { label: "Weight", value: "1.2kg (Packed)" },
                  { label: "Care Instructions", value: "Dry Clean Only" }
                ].map((spec, i) => (
                  <div key={i} className="flex justify-between py-3 border-b border-border/50">
                    <span className="text-muted-foreground font-medium">{spec.label}</span>
                    <span className="font-bold">{spec.value}</span>
                  </div>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="reviews">
              <div className="flex flex-col gap-8">
                <div className="flex items-center gap-12 bg-muted/30 p-8 rounded-3xl border">
                  <div className="text-center space-y-2">
                    <p className="text-6xl font-bold font-headline">{product.rating}</p>
                    <div className="flex justify-center text-accent">
                      {[1, 2, 3, 4, 5].map(s => <Star key={s} className="h-4 w-4 fill-current" />)}
                    </div>
                    <p className="text-xs text-muted-foreground">Based on 128 reviews</p>
                  </div>
                  <div className="flex-1 space-y-2">
                    {[
                      { star: 5, perc: 85 },
                      { star: 4, perc: 10 },
                      { star: 3, perc: 3 },
                      { star: 2, perc: 1 },
                      { star: 1, perc: 1 }
                    ].map(row => (
                      <div key={row.star} className="flex items-center gap-4 text-xs">
                        <span className="w-4">{row.star}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${row.perc}%` }} />
                        </div>
                        <span className="w-8 text-right">{row.perc}%</span>
                      </div>
                    ))}
                  </div>
                  <Button className="rounded-full px-8">Write a Review</Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}