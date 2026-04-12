"use client";

import { Product } from "@/app/lib/mock-data";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Heart, Star, Download } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addProductToCart, ProductCustomization } from "@/lib/cart";
import { getWishlistFromBackend, setWishlistItemOnBackend } from "@/lib/api/wishlist";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatINR, normalizeCatalogPriceToINR } from "@/lib/india";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const isDesign = product.category === 'Embroidery Designs';
  const isCustomizable = Boolean(product.customizable);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [openCustomizer, setOpenCustomizer] = useState(false);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [referenceFileName, setReferenceFileName] = useState<string | null>(null);
  const [customization, setCustomization] = useState<ProductCustomization>({
    symbol: "Lotus Mandala",
    threadColor: "Gold",
    fabricColor: "Black",
    size: "Medium",
    placement: "Left Chest",
    referenceImage: undefined,
    referenceImageName: undefined,
    notes: "",
  });
  const [quantity, setQuantity] = useState(1);
  const lowStockThreshold = 10;
  const isLowStock = product.stock > 0 && product.stock <= lowStockThreshold;

  const symbols = ["Lotus Mandala", "Peacock Crest", "Floral Vine", "Royal Monogram", "Om Motif"];
  const threadColors = ["Gold", "Silver", "Ruby Red", "Emerald", "Royal Blue", "Ivory"];
  const fabricColors = ["Black", "Navy", "White", "Maroon", "Forest Green", "Beige"];
  const placements = ["Left Chest", "Center Chest", "Sleeve", "Back", "Pocket"];

  useEffect(() => {
    const loadWishlistState = async () => {
      const token = localStorage.getItem("app_auth_token");

      if (!token) {
        setIsWishlisted(false);
        return;
      }

      try {
        const items = await getWishlistFromBackend(token);
        setIsWishlisted(items.some((item) => item.productId === product.id));
      } catch (wishlistError) {
        console.error("Failed to load wishlist state", wishlistError);
      }
    };

    void loadWishlistState();
  }, [product.id]);

  const handleWishlistToggle = async () => {
    const token = localStorage.getItem("app_auth_token");

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setWishlistLoading(true);
      const result = await setWishlistItemOnBackend(token, product.id, !isWishlisted);
      setIsWishlisted(result.saved);
    } catch (wishlistError) {
      console.error("Failed to update wishlist", wishlistError);
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleReferenceUpload = (file: File | undefined) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) {
        return;
      }

      setReferencePreview(result);
      setReferenceFileName(file.name);
      setCustomization((prev) => ({
        ...prev,
        referenceImage: result,
        referenceImageName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleAddCustomizedItem = () => {
    addProductToCart(
      product,
      quantity,
      {
        ...customization,
        notes: customization.notes?.trim() || undefined,
        referenceImage: customization.referenceImage,
        referenceImageName: customization.referenceImageName,
      }
    );
    setOpenCustomizer(false);
    setQuantity(1);
    setReferencePreview(null);
    setReferenceFileName(null);
    router.push("/cart");
  };

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-xl border-border/50 bg-card/50 backdrop-blur-sm">
      <Link href={`/product/${product.id}`} className="block relative aspect-square overflow-hidden bg-muted">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />
        {isDesign && (
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="flex items-center gap-1 bg-white/90 backdrop-blur text-primary border-primary/20">
              <Download className="h-3 w-3" />
              Digital
            </Badge>
          </div>
        )}
        {product.stock === 0 ? (
          <div className="absolute top-2 left-2">
            <Badge className="bg-red-500/90 text-white border-none shadow-sm">Out of stock</Badge>
          </div>
        ) : isLowStock ? (
          <div className="absolute top-2 left-2">
            <Badge className="bg-amber-500/90 text-white border-none shadow-sm">Only {product.stock} left</Badge>
          </div>
        ) : null}
        <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className={`h-8 w-8 rounded-full bg-white/90 backdrop-blur shadow-sm ${isWishlisted ? "text-rose-600" : ""}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void handleWishlistToggle();
            }}
            disabled={wishlistLoading}
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            title={isWishlisted ? "Saved to wishlist" : "Save to wishlist"}
          >
            <Heart className={`h-4 w-4 ${isWishlisted ? "fill-current" : "text-secondary"}`} />
          </Button>
        </div>
      </Link>
      
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{product.category}</p>
          <div className="flex items-center gap-1 text-xs font-bold text-accent">
            <Star className="h-3 w-3 fill-current" />
            {product.rating}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Added by {product.dealerName || "Admin"}
        </p>
        
        <Link href={`/product/${product.id}`}>
          <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">{product.name}</h3>
        </Link>
        
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-primary">{formatINR(normalizeCatalogPriceToINR(Number(product.price || 0)))}</span>
          {isDesign && <span className="text-xs text-muted-foreground">Unlimited License</span>}
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0">
        {isCustomizable ? (
          <>
            <Button
              className="w-full gap-2 rounded-full font-semibold shadow-sm hover:shadow-md transition-all active:scale-95"
              variant="default"
              onClick={() => setOpenCustomizer(true)}
            >
              <ShoppingCart className="h-4 w-4" />
              Customize & Add
            </Button>

            <Dialog open={openCustomizer} onOpenChange={setOpenCustomizer}>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Customize {product.name}</DialogTitle>
                  <DialogDescription>
                    Pick your symbol, colors, size, placement, and upload a reference image if you want.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label>Embroidery Symbol</Label>
                    <div className="flex flex-wrap gap-2">
                      {symbols.map((symbol) => (
                        <Button
                          key={symbol}
                          type="button"
                          variant={customization.symbol === symbol ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCustomization((prev) => ({ ...prev, symbol }))}
                        >
                          {symbol}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Thread Color</Label>
                      <div className="flex flex-wrap gap-2">
                        {threadColors.map((threadColor) => (
                          <Button
                            key={threadColor}
                            type="button"
                            variant={customization.threadColor === threadColor ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCustomization((prev) => ({ ...prev, threadColor }))}
                          >
                            {threadColor}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Garment Color</Label>
                      <div className="flex flex-wrap gap-2">
                        {fabricColors.map((fabricColor) => (
                          <Button
                            key={fabricColor}
                            type="button"
                            variant={customization.fabricColor === fabricColor ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCustomization((prev) => ({ ...prev, fabricColor }))}
                          >
                            {fabricColor}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Upload Reference Photo</Label>
                    <div className="rounded-2xl border border-dashed border-border p-4 space-y-3">
                      <input
                        ref={uploadInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        aria-label="Upload reference photo"
                        title="Upload reference photo"
                        onChange={(event) => handleReferenceUpload(event.target.files?.[0])}
                      />
                      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Upload a photo of your design idea or reference piece.</p>
                          <p className="text-xs text-muted-foreground">PNG, JPG, WEBP supported. This helps us match your request better.</p>
                        </div>
                        <Button type="button" variant="outline" onClick={() => uploadInputRef.current?.click()}>
                          Upload Photo
                        </Button>
                      </div>
                      {referencePreview && referenceFileName && (
                        <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
                          <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-background border shrink-0">
                            <Image src={referencePreview} alt={referenceFileName} fill className="object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{referenceFileName}</p>
                            <p className="text-xs text-muted-foreground">Reference image attached</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Size</Label>
                      <div className="flex flex-wrap gap-2">
                        {(["Small", "Medium", "Large"] as const).map((size) => (
                          <Button
                            key={size}
                            type="button"
                            variant={customization.size === size ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCustomization((prev) => ({ ...prev, size }))}
                          >
                            {size}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label>Placement</Label>
                      <div className="flex flex-wrap gap-2">
                        {placements.map((placement) => (
                          <Button
                            key={placement}
                            type="button"
                            variant={customization.placement === placement ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCustomization((prev) => ({ ...prev, placement }))}
                          >
                            {placement}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`customization-notes-${product.id}`}>Special Notes</Label>
                    <Textarea
                      id={`customization-notes-${product.id}`}
                      placeholder="Example: keep embroidery subtle, avoid metallic shine, use a clean neckline placement..."
                      value={customization.notes || ""}
                      onChange={(e) => setCustomization((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`customization-qty-${product.id}`}>Quantity</Label>
                    <Input
                      id={`customization-qty-${product.id}`}
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => {
                        const parsed = Number(e.target.value);
                        setQuantity(Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1);
                      }}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setOpenCustomizer(false);
                      setReferencePreview(null);
                      setReferenceFileName(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddCustomizedItem}>Add Customized Item</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <Button
            className="w-full gap-2 rounded-full font-semibold shadow-sm hover:shadow-md transition-all active:scale-95"
            variant="default"
            asChild
          >
            <Link
              href="/cart"
              onClick={() => {
                addProductToCart(product, 1);
              }}
            >
              <ShoppingCart className="h-4 w-4" />
              Add to Cart
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}