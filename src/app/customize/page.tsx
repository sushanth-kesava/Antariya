"use client";

import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Palette, Check, ArrowRight, Upload } from "lucide-react";
import { useState, useEffect } from "react";
import { embroideryDesignVisualizer } from "@/ai/flows/embroidery-design-visualizer";
import Image from "next/image";
import { Product } from "@/app/lib/mock-data";
import { getProductsFromBackend } from "@/lib/api/products";

export default function CustomizePage() {
  const [selectedGarment, setSelectedGarment] = useState<Product | null>(null);
  const [selectedDesign, setSelectedDesign] = useState<Product | null>(null);
  const [visualizing, setVisualizing] = useState(false);
  const [visualizedImg, setVisualizedImg] = useState<string | null>(null);
  const [visualizationMessage, setVisualizationMessage] = useState<string | null>(null);
  const [apparel, setApparel] = useState<Product[]>([]);
  const [designs, setDesigns] = useState<Product[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [apparelData, designData] = await Promise.all([
          getProductsFromBackend({ customizable: true }),
          getProductsFromBackend({ category: "Embroidery Designs" }),
        ]);
        setApparel(apparelData);
        setDesigns(designData);
      } catch (error) {
        console.error("Failed to load customization data", error);
      }
    };

    void loadData();
  }, []);

  const handleVisualize = async () => {
    if (!selectedGarment || !selectedDesign) return;
    setVisualizing(true);
    setVisualizationMessage(null);
    try {
      const result = await embroideryDesignVisualizer({
        embroideryDesignImage: selectedDesign.image,
        fabricType: selectedGarment.category.toLowerCase(),
        fabricColor: "original" // Simplifying for the flow
      });
      if (result.visualizedImage) {
        setVisualizedImg(result.visualizedImage);
      }
      if (result.fallbackUsed) {
        setVisualizationMessage(result.message || "AI preview is currently unavailable. Showing fallback image.");
      }
    } catch (error) {
      console.error("AI Visualization failed", error);
      setVisualizationMessage("AI preview failed unexpectedly. Please try again in a few minutes.");
    } finally {
      setVisualizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-12">
        <div className="flex flex-col gap-12">
          <div className="text-center space-y-4">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-none px-4 py-1">
              AI Design Studio
            </Badge>
            <h1 className="text-5xl font-bold font-headline">Custom Embroidery Studio</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Select your garment, choose a design, and let our AI show you exactly how the final masterpiece will look.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Selection Column */}
            <div className="lg:col-span-4 space-y-8">
              <section className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm">1</span>
                  Choose Base Garment
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {apparel.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { setSelectedGarment(item); setVisualizedImg(null); }}
                      className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all ${selectedGarment?.id === item.id ? 'border-primary shadow-lg ring-2 ring-primary/20' : 'border-border/50 opacity-70 hover:opacity-100'}`}
                    >
                      <Image src={item.image} alt={item.name} fill className="object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2">
                        <p className="text-[10px] text-white font-bold truncate">{item.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm">2</span>
                  Choose Embroidery Design
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {designs.slice(0, 4).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { setSelectedDesign(item); setVisualizedImg(null); }}
                      className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all ${selectedDesign?.id === item.id ? 'border-primary shadow-lg ring-2 ring-primary/20' : 'border-border/50 opacity-70 hover:opacity-100'}`}
                    >
                      <Image src={item.image} alt={item.name} fill className="object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2">
                        <p className="text-[10px] text-white font-bold truncate">{item.name}</p>
                      </div>
                    </button>
                  ))}
                  <button className="aspect-square rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-muted transition-colors">
                    <Upload className="h-6 w-6" />
                    <span className="text-[10px] font-bold">Upload Custom</span>
                  </button>
                </div>
              </section>

              <Button 
                size="lg" 
                className="w-full h-14 rounded-2xl shadow-xl shadow-primary/20 text-lg font-bold"
                onClick={handleVisualize}
                disabled={!selectedGarment || !selectedDesign || visualizing}
              >
                {visualizing ? (
                  <Sparkles className="mr-2 h-5 w-5 animate-pulse" />
                ) : (
                  <Palette className="mr-2 h-5 w-5" />
                )}
                {visualizing ? "Visualizing..." : "Generate Preview"}
              </Button>
            </div>

            {/* Preview Column */}
            <div className="lg:col-span-8">
              {visualizationMessage && (
                <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 text-sm font-medium">
                  {visualizationMessage}
                </div>
              )}
              <Card className="rounded-[40px] overflow-hidden border-none shadow-2xl bg-muted/30 relative aspect-[4/3] flex items-center justify-center">
                {visualizedImg ? (
                  <div className="relative w-full h-full">
                    <Image src={visualizedImg} alt="AI Preview" fill className="object-cover animate-fade-in" />
                    <div className="absolute top-6 left-6">
                      <Badge className="bg-primary/90 backdrop-blur-md border-none px-4 py-2 text-sm font-bold flex items-center gap-2">
                        <Sparkles className="h-4 w-4" /> AI Generated Preview
                      </Badge>
                    </div>
                  </div>
                ) : selectedGarment ? (
                  <div className="relative w-full h-full opacity-40">
                    <Image src={selectedGarment.image} alt="Base garment" fill className="object-cover grayscale" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 bg-black/10">
                      <Palette className="h-16 w-16 mb-4 text-primary" />
                      <h4 className="text-2xl font-bold text-white">Ready for Magic</h4>
                      <p className="text-white/80 max-w-sm">
                        {selectedDesign 
                          ? `Ready to visualize ${selectedDesign.name} on this ${selectedGarment.name}.`
                          : "Select an embroidery design to see it on the garment."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-6 max-w-sm p-8">
                    <div className="w-24 h-24 bg-card rounded-full flex items-center justify-center mx-auto shadow-inner">
                      <Palette className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold">Your Canvas Awaits</h4>
                      <p className="text-muted-foreground mt-2">
                        Select a base product from the left to start your custom embroidery journey.
                      </p>
                    </div>
                  </div>
                )}
              </Card>

              {visualizedImg && (
                <div className="mt-8 p-8 rounded-3xl bg-secondary text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
                  <div className="space-y-2 text-center md:text-left">
                    <h3 className="text-2xl font-bold font-headline">Love this design?</h3>
                    <p className="text-white/70">Get this combination stitched and delivered to your doorstep.</p>
                  </div>
                  <div className="flex gap-4">
                    <Button size="lg" variant="outline" className="rounded-full border-white/20 text-white hover:bg-white/10 px-8">
                      Save as Draft
                    </Button>
                    <Button size="lg" className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 px-8 font-bold">
                      Order Custom <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
