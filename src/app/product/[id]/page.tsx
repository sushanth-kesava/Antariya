"use client";

import Head from "next/head";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  ShoppingCart, 
  Heart, 
  Star, 
  ShieldCheck, 
  Truck, 
  Sparkles,
  RefreshCw,
  AlertCircle,
  Upload,
  MapPin,
  Clock3,
  Wallet,
  LocateFixed,
  Ruler,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  RotateCcw
} from "lucide-react";
import Image from "next/image";
import { useRef, useState, use, useEffect, useMemo } from "react";
import { embroideryDesignVisualizer } from "@/ai/flows/embroidery-design-visualizer";
import { Product } from "@/app/lib/mock-data";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addProductReviewOnBackend,
  getProductByIdFromBackend,
  getProductReviewsFromBackend,
  ProductReview,
  ProductReviewTag,
} from "@/lib/api/products";
import { addProductToCart, ProductCustomization } from "@/lib/cart";
import { checkDeliveryByPincode } from "@/lib/api/delivery";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getWishlistFromBackend, setWishlistItemOnBackend } from "@/lib/api/wishlist";
import { formatINR, normalizeCatalogPriceToINR } from "@/lib/india";

const LAST_SUCCESSFUL_PINCODE_KEY = "antariya_last_successful_pincode";
const APPAREL_CATEGORIES = new Set(["Hoodies", "Blouses"]);

type ReviewTag = "All" | "Quality" | "Fit" | "Delivery" | "Customization";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}

function getErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "number") {
      return code;
    }
  }

  return undefined;
}

function getSizeChart(category: string) {
  if (category === "Hoodies") {
    return [
      { size: "Small", chest: "88-95 cm", bodyLength: "66 cm" },
      { size: "Medium", chest: "96-103 cm", bodyLength: "69 cm" },
      { size: "Large", chest: "104-111 cm", bodyLength: "72 cm" },
    ] as const;
  }

  return [
    { size: "Small", chest: "82-88 cm", bodyLength: "36 cm" },
    { size: "Medium", chest: "89-95 cm", bodyLength: "38 cm" },
    { size: "Large", chest: "96-102 cm", bodyLength: "40 cm" },
  ] as const;
}

function recommendSize(chestCm: number, preference: "Regular" | "Relaxed" | "Slim", category: string) {
  const chart = getSizeChart(category);

  const adjustedChest = preference === "Relaxed" ? chestCm + 3 : preference === "Slim" ? chestCm - 2 : chestCm;

  if (adjustedChest <= Number(chart[0].chest.split("-")[1].replace(" cm", ""))) return "Small";
  if (adjustedChest <= Number(chart[1].chest.split("-")[1].replace(" cm", ""))) return "Medium";
  return "Large";
}

type DeliveryResult =
  | {
      status: "idle";
      message: string;
    }
  | {
      status: "checking";
      message: string;
    }
  | {
      status: "available";
      message: string;
      district: string;
      state: string;
      eta: string;
      shipping: string;
      codSupported: boolean;
      prepaidSupported: boolean;
      estimatedDispatchDate: string;
      lastMilePartner: string;
      returnEligible: boolean;
    }
  | {
      status: "unavailable";
      message: string;
    }
  | {
      status: "invalid";
      message: string;
    };

function getMaterialLabel(productCategory: string) {
  if (productCategory === "Hoodies") return "Heavyweight 400 GSM cotton fleece";
  if (productCategory === "Blouses") return "Silk-blend base fabric";
  if (productCategory === "Embroidery Designs") return "Digital design pack";
  return "Premium-grade base fabric";
}

function getProductHighlights(productCategory: string) {
  if (productCategory === "Hoodies") {
    return [
      "Warm, structured base that holds embroidery well",
      "Clean stitching zones for chest and sleeve placements",
      "Designed for long wear, gifting, and custom branding",
    ];
  }

  if (productCategory === "Blouses") {
    return [
      "Elegant drape suited for festive and occasion wear",
      "Refined surface for traditional or minimal embroidery",
      "Easy to customize with monograms, motifs, and borders",
    ];
  }

  return [
    "Professional base selected for clean embroidery results",
    "Balanced fabric feel for better finish and durability",
    "Well-suited for custom designs and repeated wear",
  ];
}

function getCareNotes(productCategory: string) {
  if (productCategory === "Hoodies") {
    return ["Machine wash inside out in cold water", "Do not iron directly on embroidery", "Tumble dry low or air dry for best results"];
  }

  if (productCategory === "Blouses") {
    return ["Prefer gentle hand wash or delicate cycle", "Store folded to protect embellishment", "Use low heat if ironing is required"];
  }

  return ["Use a gentle wash cycle", "Avoid direct heat on stitched areas", "Dry in shade to preserve color and finish"];
}

export default function ProductDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProduct = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getProductByIdFromBackend(id);
        setProduct(data);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to load product"));
      } finally {
        setLoading(false);
      }
    };

    void loadProduct();
  }, [id]);

  const [visualizing, setVisualizing] = useState(false);
  const [visualizedImg, setVisualizedImg] = useState<string | null>(null);
  const [openCustomizer, setOpenCustomizer] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [referenceFileName, setReferenceFileName] = useState<string | null>(null);
  const [deliveryPincode, setDeliveryPincode] = useState("");
  const [locatingPincode, setLocatingPincode] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<ReviewTag>("All");
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    title: "",
    comment: "",
    tags: [] as ProductReviewTag[],
  });
  const [openSizeGuide, setOpenSizeGuide] = useState(false);
  const [openFullscreenGallery, setOpenFullscreenGallery] = useState(false);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<string | null>(null);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [bodyChestCm, setBodyChestCm] = useState(96);
  const [fitPreference, setFitPreference] = useState<"Regular" | "Relaxed" | "Slim">("Regular");
  const [deliveryResult, setDeliveryResult] = useState<DeliveryResult>({
    status: "idle",
    message: "Check delivery availability by entering your 6-digit pincode.",
  });
  const [customization, setCustomization] = useState<ProductCustomization>({
    fabricColor: "Black",
    threadColor: "Gold",
    symbol: "Lotus Mandala",
    size: "Medium",
    placement: "Left Chest",
    notes: "",
    referenceImage: undefined as string | undefined,
    referenceImageName: undefined as string | undefined,
  });

  const symbols = ["Lotus Mandala", "Peacock Crest", "Floral Vine", "Royal Monogram", "Om Motif"];
  const threadColors = ["Gold", "Silver", "Ruby Red", "Emerald", "Royal Blue", "Ivory"];
  const fabricColors = ["Black", "Navy", "White", "Maroon", "Forest Green", "Beige"];
  const placements = ["Left Chest", "Center Chest", "Sleeve", "Back", "Pocket"];
  const isApparelProduct = APPAREL_CATEGORIES.has(product?.category || "");
  const galleryImages = useMemo(() => {
    if (!product) {
      return [] as string[];
    }

    const images = Array.isArray(product.galleryImages) ? product.galleryImages : [];
    const normalized = images.filter((entry) => typeof entry === "string" && entry.trim().length > 0);

    if (!normalized.includes(product.image)) {
      normalized.unshift(product.image);
    }

    return normalized.length > 0 ? normalized : [product.image];
  }, [product]);

  const activeImage = selectedGalleryImage || galleryImages[0] || product?.image;
  const displayImage = visualizedImg || activeImage || product?.image || "";
  const lowStockThreshold = 10;
  const isLowStock = Boolean(product && product.stock > 0 && product.stock <= lowStockThreshold);
  const stockBadgeLabel = product?.stock === 0 ? "Out of stock" : isLowStock ? `Only ${product?.stock} left` : `In stock: ${product?.stock}`;
  const expectedDeliveryRange = useMemo(() => {
    if (deliveryResult.status === "available") {
      return deliveryResult.eta;
    }

    return isApparelProduct ? "2-7 business days" : "3-6 business days";
  }, [deliveryResult, isApparelProduct]);
  const productSeoTitle = product ? `${product.name} | Antariya` : "Antariya | Premium Embroidery Marketplace";
  const productSeoDescription = product
    ? `${product.name} from Antariya. ${product.description} Delivered with live pincode checks, customizable options, and trusted delivery updates.`
    : "Antariya premium embroidery marketplace.";
  const structuredData = product
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description,
        image: galleryImages,
        sku: product.id,
        brand: { "@type": "Brand", name: "Antariya" },
        offers: {
          "@type": "Offer",
          url: `${typeof window !== "undefined" ? window.location.origin : ""}/product/${product.id}`,
          priceCurrency: "INR",
          price: product.price,
          availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        },
        aggregateRating: product.rating
          ? {
              "@type": "AggregateRating",
              ratingValue: product.rating,
              reviewCount: reviews.length || 1,
            }
          : undefined,
      }
    : null;
  const sellerName = product?.dealerName || "Admin";
  const sellerEmail = product?.dealerEmail || "Not provided";

  useEffect(() => {
    if (galleryImages.length > 0) {
      setSelectedGalleryImage(galleryImages[0]);
    }
  }, [galleryImages]);

  const filteredReviews = useMemo(() => {
    if (reviewFilter === "All") {
      return reviews;
    }

    return reviews.filter((review) => review.tags.includes(reviewFilter as ProductReviewTag));
  }, [reviewFilter, reviews]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return "0.0";
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return (total / reviews.length).toFixed(1);
  }, [reviews]);

  const recommendedSize = useMemo(() => {
    if (!isApparelProduct || !product) {
      return null;
    }

    return recommendSize(bodyChestCm, fitPreference, product.category);
  }, [bodyChestCm, fitPreference, isApparelProduct, product]);

  useEffect(() => {
    const savedPincode = localStorage.getItem(LAST_SUCCESSFUL_PINCODE_KEY);

    if (savedPincode && /^\d{6}$/.test(savedPincode)) {
      setDeliveryPincode(savedPincode);
      setDeliveryResult({
        status: "idle",
        message: `Last used pincode ${savedPincode} restored. Click Check to refresh live availability.`,
      });
    }
  }, []);

  const persistSuccessfulPincode = (pincode: string) => {
    localStorage.setItem(LAST_SUCCESSFUL_PINCODE_KEY, pincode);
  };

  useEffect(() => {
    const loadReviews = async () => {
      setReviewsLoading(true);

      try {
        const reviewData = await getProductReviewsFromBackend(id);
        setReviews(reviewData);
      } catch (reviewError) {
        console.error("Failed to load reviews", reviewError);
      } finally {
        setReviewsLoading(false);
      }
    };

    void loadReviews();
  }, [id]);

  useEffect(() => {
    const loadWishlistState = async () => {
      if (!product) {
        return;
      }

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
  }, [product]);

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
    if (!product) return;

    addProductToCart(product, quantity, {
      ...customization,
      notes: customization.notes?.trim() || undefined,
    });
    setOpenCustomizer(false);
    setQuantity(1);
    setReferencePreview(null);
    setReferenceFileName(null);
    toast({
      title: "Customized item added",
      description: `${product.name} was added to your cart with selected options.`,
    });
  };

  const handleAddToCart = () => {
    if (!product) return;

    addProductToCart(product, 1);
    toast({
      title: "Added to cart",
      description: `${product.name} has been added.`,
    });
  };

  const handleWishlistToggle = async () => {
    if (!product || wishlistLoading) {
      return;
    }

    const token = localStorage.getItem("app_auth_token");

    if (!token) {
      toast({
        title: "Login required",
        description: "Please login to save wishlist items.",
      });
      router.push("/login");
      return;
    }

    try {
      setWishlistLoading(true);
      const result = await setWishlistItemOnBackend(token, product.id, !isWishlisted);
      setIsWishlisted(result.saved);
      toast({
        title: result.saved ? "Saved to wishlist" : "Removed from wishlist",
        description: result.saved ? `${product.name} has been added to your wishlist.` : `${product.name} has been removed from your wishlist.`,
      });
    } catch (wishlistError) {
      toast({
        title: "Wishlist update failed",
        description: getErrorMessage(wishlistError, "Please try again."),
      });
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleBuyNow = () => {
    if (!product) return;

    addProductToCart(product, 1);
    router.push("/cart");
  };

  const handleTagToggle = (tag: ProductReviewTag) => {
    setReviewForm((prev) => {
      const exists = prev.tags.includes(tag);
      if (exists) {
        return { ...prev, tags: prev.tags.filter((entry) => entry !== tag) };
      }

      return { ...prev, tags: [...prev.tags, tag] };
    });
  };

  const handleSubmitReview = async () => {
    if (!product) return;

    const token = localStorage.getItem("app_auth_token");

    if (!token) {
      toast({
        title: "Login required",
        description: "Please login to submit a review.",
      });
      router.push("/login");
      return;
    }

    if (!reviewForm.title.trim() || !reviewForm.comment.trim()) {
      toast({
        title: "Missing review details",
        description: "Add a title and comment before submitting.",
      });
      return;
    }

    try {
      setSubmittingReview(true);
      await addProductReviewOnBackend(token, product.id, {
        rating: reviewForm.rating,
        title: reviewForm.title.trim(),
        comment: reviewForm.comment.trim(),
        tags: reviewForm.tags,
      });

      const [reviewData, updatedProduct] = await Promise.all([
        getProductReviewsFromBackend(product.id),
        getProductByIdFromBackend(product.id),
      ]);

      setReviews(reviewData);
      if (updatedProduct) {
        setProduct(updatedProduct);
      }

      setReviewForm({ rating: 5, title: "", comment: "", tags: [] });
      toast({
        title: "Review submitted",
        description: "Thanks for your feedback.",
      });
    } catch (submitError) {
      toast({
        title: "Review submission failed",
        description: getErrorMessage(submitError, "Please try again."),
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeliveryCheck = async () => {
    setDeliveryResult({ status: "checking", message: "Checking delivery availability..." });

    const normalized = deliveryPincode.trim();
    if (!/^\d{6}$/.test(normalized)) {
      setDeliveryResult({
        status: "invalid",
        message: "Enter a valid 6-digit Indian pincode.",
      });
      return;
    }

    try {
      const result = await checkDeliveryByPincode(normalized);

      if (!result.available) {
        setDeliveryResult({
          status: "unavailable",
          message: result.message || "Delivery is not currently available for this pincode.",
        });
        return;
      }

      setDeliveryResult({
        status: "available",
        message: result.message || "Delivery is available for this pincode.",
        district: result.district || "Unknown",
        state: result.state || "Unknown",
        eta: result.eta || "2-7 business days",
        shipping: result.shipping || "Shipping calculated at checkout",
        codSupported: Boolean(result.codSupported),
        prepaidSupported: Boolean(result.prepaidSupported),
        estimatedDispatchDate: result.estimatedDispatchDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        lastMilePartner: result.lastMilePartner || "Delhivery",
        returnEligible: Boolean(result.returnEligible),
      });
      persistSuccessfulPincode(normalized);
    } catch (checkError) {
      setDeliveryResult({
        status: "unavailable",
        message: getErrorMessage(checkError, "Unable to verify delivery right now. Please try again."),
      });
    }
  };

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setDeliveryResult({
        status: "unavailable",
        message: "Geolocation is not supported in this browser. Enter pincode manually.",
      });
      return;
    }

    try {
      setLocatingPincode(true);
      setDeliveryResult({ status: "checking", message: "Detecting your location and pincode..." });

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 12000,
          maximumAge: 300000,
        });
      });

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      const reverseResponse = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&addressdetails=1`
      );

      if (!reverseResponse.ok) {
        throw new Error("Could not map your location to a pincode.");
      }

      const reverseData = await reverseResponse.json();
      const detectedPincode = String(reverseData?.address?.postcode || "").replace(/\D/g, "").slice(0, 6);

      if (!/^\d{6}$/.test(detectedPincode)) {
        throw new Error("Pincode could not be detected from your location.");
      }

      setDeliveryPincode(detectedPincode);

      const result = await checkDeliveryByPincode(detectedPincode);

      if (!result.available) {
        setDeliveryResult({
          status: "unavailable",
          message: result.message || "Delivery is not currently available for this pincode.",
        });
        return;
      }

      setDeliveryResult({
        status: "available",
        message: result.message || "Delivery is available for this pincode.",
        district: result.district || "Unknown",
        state: result.state || "Unknown",
        eta: result.eta || "2-7 business days",
        shipping: result.shipping || "Shipping calculated at checkout",
        codSupported: Boolean(result.codSupported),
        prepaidSupported: Boolean(result.prepaidSupported),
        estimatedDispatchDate: result.estimatedDispatchDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        lastMilePartner: result.lastMilePartner || "Delhivery",
        returnEligible: Boolean(result.returnEligible),
      });
      persistSuccessfulPincode(detectedPincode);
    } catch (locationError) {
      const errorCode = getErrorCode(locationError);
      const fallbackMessage =
        errorCode === 1
          ? "Location permission denied. Please allow location access or enter pincode manually."
          : getErrorMessage(locationError, "Unable to fetch pincode from your location right now.");

      setDeliveryResult({
        status: "unavailable",
        message: fallbackMessage,
      });
    } finally {
      setLocatingPincode(false);
    }
  };

  const handleVisualize = async () => {
    if (!product) return;
    setVisualizing(true);
    try {
      const result = await embroideryDesignVisualizer({
        garmentImage: product.image,
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
              We couldn&apos;t find the product you&apos;re looking for. It might have been removed or the ID is incorrect.
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
      <Head>
        <title>{productSeoTitle}</title>
        <meta name="description" content={productSeoDescription} />
        <meta property="og:type" content="product" />
        <meta property="og:title" content={productSeoTitle} />
        <meta property="og:description" content={productSeoDescription} />
        {product ? <meta property="og:image" content={galleryImages[0] || product.image} /> : null}
        {product ? <meta property="product:price:amount" content={String(product.price)} /> : null}
        {product ? <meta property="product:price:currency" content="INR" /> : null}
        <link rel="canonical" href={`/product/${product?.id || id}`} />
      </Head>
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      ) : null}
      <Navbar />
      
      <main className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Image Display */}
          <div className="relative mx-auto w-full max-w-[720px] space-y-6 lg:mx-3">
            <div className="relative aspect-square rounded-[40px] overflow-hidden bg-muted border shadow-2xl">
              <button
                type="button"
                aria-label="Open fullscreen gallery"
                title="Open fullscreen gallery"
                onClick={() => setOpenFullscreenGallery(true)}
                className="absolute right-4 top-4 z-20 rounded-full bg-black/50 p-2 text-white backdrop-blur hover:bg-black/65 transition-colors"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <div
                className="relative h-full w-full"
              >
              <Image 
                src={displayImage} 
                alt={product.name} 
                fill 
                className="object-cover"
              />
              </div>
              {visualizedImg && (
                <div className="absolute top-6 left-6">
                  <Badge className="bg-primary/90 backdrop-blur-md shadow-xl border-none px-4 py-2 text-sm font-bold flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> AI Preview
                  </Badge>
                </div>
              )}
            </div>

            <div className="grid grid-cols-4 gap-4">
              {galleryImages.map((img, i) => (
                <button 
                  key={`${img}-${i}`}
                  type="button"
                  title={`Preview image ${i + 1}`}
                  aria-label={`Preview image ${i + 1}`}
                  onClick={() => {
                    setVisualizedImg(null);
                    setSelectedGalleryImage(img);
                  }}
                  className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all ${activeImage === img ? "border-primary opacity-100" : "border-transparent opacity-80 hover:border-primary hover:opacity-100"}`}
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
                <span className="text-4xl font-bold text-primary">{formatINR(normalizeCatalogPriceToINR(Number(product.price || 0)))}</span>
                <Badge className="bg-green-500/10 text-green-600 border-none px-4 py-1 text-sm font-bold">{stockBadgeLabel}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {product.stock === 0 ? (
                  <Badge className="rounded-full bg-red-500/10 text-red-700 border-none px-4 py-1 font-bold">Out of stock</Badge>
                ) : isLowStock ? (
                  <Badge className="rounded-full bg-amber-500/10 text-amber-700 border-none px-4 py-1 font-bold">Only {product.stock} left</Badge>
                ) : null}
                <Badge variant="outline" className="rounded-full px-4 py-1 font-medium">
                  Expected delivery: {expectedDeliveryRange}
                </Badge>
              </div>
              
              <p className="text-xl text-muted-foreground leading-relaxed">{product.description}</p>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-600 font-semibold">Seller</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{sellerName}</p>
                <p className="text-xs text-slate-600">Dealer contact: {sellerEmail}</p>
              </div>
            </div>

            <div className="p-8 rounded-[32px] bg-card border border-border/50 shadow-sm space-y-8">
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1 h-14 rounded-2xl text-lg font-bold border-primary/40 text-primary hover:bg-primary/5 transition-all"
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart
                </Button>
                <Button size="lg" className="flex-1 h-14 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all" onClick={handleBuyNow}>
                  Buy Now
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className={`h-14 rounded-2xl border-primary/20 px-6 ${isWishlisted ? "text-rose-600 bg-rose-50 hover:bg-rose-100" : "text-primary hover:bg-primary/5"}`}
                  onClick={handleWishlistToggle}
                  disabled={wishlistLoading}
                >
                  <Heart className={`h-6 w-6 ${isWishlisted ? "fill-current" : ""}`} />
                </Button>
              </div>

              {isApparelProduct && (
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-2xl"
                  onClick={() => setOpenSizeGuide(true)}
                >
                  <Ruler className="mr-2 h-4 w-4" /> Size Guide & Fit Recommendation
                </Button>
              )}

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
                <Button
                  onClick={() => setOpenCustomizer(true)}
                  variant="secondary"
                  className="w-full h-14 rounded-2xl bg-secondary text-white font-bold text-lg hover:bg-secondary/90 transition-all flex items-center justify-center gap-3"
                >
                  <Upload className="h-6 w-6" />
                  Customize This Product
                </Button>
              )}

              <div className="rounded-3xl border border-border/50 bg-muted/20 p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                    <h3 className="font-bold text-lg">Delivery Availability</h3>
                  </div>
                  <Badge variant="outline" className="rounded-full">Live Delhivery Check</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Check whether we can deliver this product to your area and see the estimated timeline before placing the order.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    value={deliveryPincode}
                    onChange={(e) => setDeliveryPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    inputMode="numeric"
                    placeholder="Enter 6-digit pincode"
                    aria-label="Delivery pincode"
                    className="h-12 rounded-2xl"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void handleDeliveryCheck();
                      }
                    }}
                  />
                  <Button className="h-12 rounded-2xl px-6" onClick={handleDeliveryCheck} disabled={deliveryResult.status === "checking"}>
                    {deliveryResult.status === "checking" ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Checking
                      </>
                    ) : (
                      "Check"
                    )}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-2xl w-full sm:w-auto"
                  onClick={handleUseCurrentLocation}
                  disabled={locatingPincode || deliveryResult.status === "checking"}
                >
                  {locatingPincode ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Detecting location
                    </>
                  ) : (
                    <>
                      <LocateFixed className="mr-2 h-4 w-4" /> Use my current location
                    </>
                  )}
                </Button>

                <div className={`rounded-2xl border px-4 py-3 text-sm ${deliveryResult.status === "available" ? "border-green-200 bg-green-50 text-green-800" : deliveryResult.status === "unavailable" || deliveryResult.status === "invalid" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-border bg-background text-muted-foreground"}`}>
                  <p className="font-medium">{deliveryResult.message}</p>
                  {deliveryResult.status === "available" && (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <div className="rounded-xl bg-white/60 px-3 py-2">
                          <p className="text-xs uppercase tracking-wider opacity-70 flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> Coverage
                          </p>
                          <p className="font-semibold">{deliveryResult.district}, {deliveryResult.state}</p>
                        </div>
                        <div className="rounded-xl bg-white/60 px-3 py-2">
                          <p className="text-xs uppercase tracking-wider opacity-70 flex items-center gap-1">
                            <Clock3 className="h-3 w-3" /> ETA
                          </p>
                          <p className="font-semibold">{deliveryResult.eta}</p>
                        </div>
                        <div className="rounded-xl bg-white/60 px-3 py-2">
                          <p className="text-xs uppercase tracking-wider opacity-70 flex items-center gap-1">
                            <Wallet className="h-3 w-3" /> Shipping
                          </p>
                          <p className="font-semibold">{deliveryResult.shipping}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <div className="rounded-xl bg-white/60 px-3 py-2">
                          <p className="text-xs uppercase tracking-wider opacity-70 flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" /> Dispatch
                          </p>
                          <p className="font-semibold">{new Date(deliveryResult.estimatedDispatchDate).toLocaleDateString()}</p>
                        </div>
                        <div className="rounded-xl bg-white/60 px-3 py-2">
                          <p className="text-xs uppercase tracking-wider opacity-70 flex items-center gap-1">
                            <Truck className="h-3 w-3" /> Partner
                          </p>
                          <p className="font-semibold">{deliveryResult.lastMilePartner}</p>
                        </div>
                        <div className="rounded-xl bg-white/60 px-3 py-2">
                          <p className="text-xs uppercase tracking-wider opacity-70 flex items-center gap-1">
                            <RotateCcw className="h-3 w-3" /> Returns
                          </p>
                          <p className="font-semibold">{deliveryResult.returnEligible ? "Eligible" : "Not eligible"}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className={`rounded-full px-3 py-1 ${deliveryResult.codSupported ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}`}>
                          {deliveryResult.codSupported ? "COD available" : "COD unavailable"}
                        </span>
                        <span className={`rounded-full px-3 py-1 ${deliveryResult.prepaidSupported ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}`}>
                          {deliveryResult.prepaidSupported ? "Prepaid available" : "Prepaid unavailable"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <Card className="rounded-[28px] border-border/50 bg-white shadow-sm">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Cart Confidence</p>
                        <h3 className="text-xl font-bold">Selected options and delivery summary</h3>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => setOpenCustomizer(true)}>
                        Edit options
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-muted/30 p-4 space-y-2">
                        <p className="font-semibold text-foreground">Customization summary</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="rounded-full">{customization.symbol}</Badge>
                          <Badge variant="secondary" className="rounded-full">{customization.threadColor}</Badge>
                          <Badge variant="secondary" className="rounded-full">{customization.fabricColor}</Badge>
                          <Badge variant="secondary" className="rounded-full">{customization.size}</Badge>
                          <Badge variant="secondary" className="rounded-full">{customization.placement}</Badge>
                        </div>
                        {customization.notes ? <p className="text-muted-foreground">Notes: {customization.notes}</p> : <p className="text-muted-foreground">No special notes added.</p>}
                      </div>

                      <div className="rounded-2xl bg-muted/30 p-4 space-y-2">
                        <p className="font-semibold text-foreground">Delivery confidence</p>
                        <p className="text-muted-foreground">Expected range: {expectedDeliveryRange}</p>
                        {deliveryResult.status === "available" ? (
                          <p className="text-muted-foreground">Dispatch: {new Date(deliveryResult.estimatedDispatchDate).toLocaleDateString()} via {deliveryResult.lastMilePartner}</p>
                        ) : (
                          <p className="text-muted-foreground">Check your pincode above for a live delivery estimate.</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
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
            
            <TabsContent value="details" className="max-w-none space-y-10">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="rounded-3xl border-border/50 shadow-sm">
                  <CardContent className="p-6 space-y-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">At a Glance</p>
                    <h3 className="text-2xl font-bold">Product Summary</h3>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p><span className="font-semibold text-foreground">Material:</span> {getMaterialLabel(product.category)}</p>
                      <p><span className="font-semibold text-foreground">Category:</span> {product.category}</p>
                      <p><span className="font-semibold text-foreground">Stock:</span> {product.stock} units available</p>
                      <p><span className="font-semibold text-foreground">Rating:</span> {product.rating}/5</p>
                      <p><span className="font-semibold text-foreground">Customization:</span> {product.customizable ? "Enabled" : "Not available"}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-border/50 shadow-sm lg:col-span-2">
                  <CardContent className="p-6 space-y-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Product Story</p>
                    <h3 className="text-2xl font-bold">Why this product stands out</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Crafted with precision and inspired by India&apos;s rich textile heritage, this product is designed for customers who want a dependable base with a premium finish. It balances comfort, durability, and embroidery readiness so your final piece looks intentional from day one.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      {getProductHighlights(product.category).map((item) => (
                        <div key={item} className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
                          {item}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-3xl border-border/50 shadow-sm">
                  <CardContent className="p-6 space-y-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Care</p>
                    <h3 className="text-2xl font-bold">Fabric & Care</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                      {getCareNotes(product.category).map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-border/50 shadow-sm">
                  <CardContent className="p-6 space-y-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Shipping</p>
                    <h3 className="text-2xl font-bold">Delivery Promise</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                      <li>Dispatch within 24-48 hours for in-stock items.</li>
                      <li>Delivery times depend on your pincode and service zone.</li>
                      <li>Delivery check above gives the latest availability status.</li>
                      <li>Packaging is designed to keep products clean and crease-free.</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="specs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: "Material", value: getMaterialLabel(product.category) },
                  { label: "Category", value: product.category },
                  { label: "Dealer Location", value: "Surat, India" },
                  { label: "Compatibility", value: product.category === "Embroidery Designs" ? "Digital download" : "Industrial & Home Machines" },
                  { label: "Availability", value: product.stock > 0 ? "In stock" : "Out of stock" },
                  { label: "Customization", value: product.customizable ? "Available" : "Not available" },
                ].map((spec, i) => (
                  <div key={i} className="flex justify-between gap-4 py-5 border-b border-border/50">
                    <span className="text-muted-foreground font-medium text-lg">{spec.label}</span>
                    <span className="font-bold text-lg text-right">{spec.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 rounded-3xl border border-border/50 bg-muted/20 p-6">
                <h3 className="text-xl font-bold mb-3">What you get</h3>
                <p className="text-muted-foreground">
                  {product.category === "Embroidery Designs"
                    ? "A ready-to-use digital design package with high-quality assets for embroidery workflows."
                    : "A premium base piece selected for custom embroidery, personalization, and long-term wear."}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="reviews" className="space-y-6">
              <Card className="rounded-3xl border-border/50 shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <h3 className="text-2xl font-bold">Customer Reviews</h3>
                    <div className="rounded-2xl bg-muted/40 px-4 py-2 text-sm">
                      <span className="font-semibold text-lg text-foreground">{averageRating}</span>
                      <span className="text-muted-foreground"> / 5 from {reviews.length} reviews</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/50 p-4 space-y-3">
                    <h4 className="font-semibold">Write a Review</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-2 md:col-span-1">
                        <Label>Rating</Label>
                        <div className="flex gap-1">
                          {Array.from({ length: 5 }).map((_, idx) => {
                            const ratingValue = idx + 1;
                            return (
                              <Button
                                key={ratingValue}
                                type="button"
                                variant={reviewForm.rating >= ratingValue ? "default" : "outline"}
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setReviewForm((prev) => ({ ...prev, rating: ratingValue }))}
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="review-title">Title</Label>
                        <Input
                          id="review-title"
                          value={reviewForm.title}
                          onChange={(e) => setReviewForm((prev) => ({ ...prev, title: e.target.value }))}
                          placeholder="Summarize your experience"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="review-comment">Comment</Label>
                      <Textarea
                        id="review-comment"
                        value={reviewForm.comment}
                        onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
                        placeholder="Tell others about quality, fit, customization, or delivery experience"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tags</Label>
                      <div className="flex flex-wrap gap-2">
                        {(["Quality", "Fit", "Delivery", "Customization"] as ProductReviewTag[]).map((tag) => (
                          <Button
                            key={tag}
                            type="button"
                            size="sm"
                            variant={reviewForm.tags.includes(tag) ? "default" : "outline"}
                            className="rounded-full"
                            onClick={() => handleTagToggle(tag)}
                          >
                            {tag}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={handleSubmitReview} disabled={submittingReview}>
                        {submittingReview ? "Submitting..." : "Submit Review"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(["All", "Quality", "Fit", "Delivery", "Customization"] as ReviewTag[]).map((filter) => (
                      <Button
                        key={filter}
                        type="button"
                        size="sm"
                        variant={reviewFilter === filter ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => setReviewFilter(filter)}
                      >
                        {filter}
                      </Button>
                    ))}
                  </div>

                  <div className="space-y-4">
                    {reviewsLoading && (
                      <div className="rounded-2xl border border-border/50 p-4 text-sm text-muted-foreground">
                        Loading reviews...
                      </div>
                    )}
                    {!reviewsLoading && filteredReviews.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                        No reviews yet for this filter. Be the first to share your feedback.
                      </div>
                    )}
                    {filteredReviews.map((review) => (
                      <div key={review.id} className="rounded-2xl border border-border/50 p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <p className="font-semibold">{review.userName}</p>
                            <p className="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-amber-500">
                              {Array.from({ length: 5 }).map((_, idx) => (
                                <Star key={idx} className={`h-4 w-4 ${idx < review.rating ? "fill-current" : "text-muted"}`} />
                              ))}
                            </div>
                            {review.verified && <Badge variant="outline">Verified Purchase</Badge>}
                          </div>
                        </div>
                        <p className="font-medium">{review.title}</p>
                        <p className="text-sm text-muted-foreground">{review.comment}</p>
                        <div className="flex flex-wrap gap-2">
                          {review.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="rounded-full">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="mt-12">
            <Card className="rounded-3xl border-border/50 shadow-sm">
              <CardContent className="p-6 space-y-4">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">FAQ</p>
                <h3 className="text-2xl font-bold">Quick answers before you order</h3>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="fabric-care">
                    <AccordionTrigger>How do I care for the fabric?</AccordionTrigger>
                    <AccordionContent>Use a gentle wash cycle, avoid direct heat on embroidery, and dry in shade to preserve color and finish.</AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="wash-instructions">
                    <AccordionTrigger>What are the wash instructions?</AccordionTrigger>
                    <AccordionContent>Wash inside out in cold water for hoodies and use a delicate hand wash or cycle for blouses. Do not iron directly on stitched areas.</AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="custom-timeline">
                    <AccordionTrigger>How long do custom orders take?</AccordionTrigger>
                    <AccordionContent>Custom orders usually move to production quickly, then ship based on stock and pincode. Most orders dispatch within 24-48 hours and reach you in about 2-7 business days.</AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="returns">
                    <AccordionTrigger>What is the return policy?</AccordionTrigger>
                    <AccordionContent>Return eligibility depends on the product and pincode serviceability. Live delivery checks show whether your order is return eligible before checkout.</AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="upload-limits">
                    <AccordionTrigger>Are there design upload limits?</AccordionTrigger>
                    <AccordionContent>Upload one reference image per customization. PNG, JPG, and WEBP are supported, and clearer references help us match the final result better.</AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={openCustomizer} onOpenChange={setOpenCustomizer}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Customize {product.name}</DialogTitle>
              <DialogDescription>
                Configure the product directly here. The AI Studio is separate and is only for building from scratch.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cloth Color</Label>
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
              </div>

              <div className="space-y-2">
                <Label>Design</Label>
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
                      <p className="text-sm font-medium">Upload a reference design or inspiration photo.</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG, WEBP supported.</p>
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
                <Label htmlFor="product-notes">Special Notes</Label>
                <Textarea
                  id="product-notes"
                  placeholder="Example: keep it subtle, place the design closer to the collar, use a soft contrast thread..."
                  value={customization.notes}
                  onChange={(e) => setCustomization((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-quantity">Quantity</Label>
                <Input
                  id="product-quantity"
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
              <Button variant="outline" onClick={() => setOpenCustomizer(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddCustomizedItem}>Add Customized Item</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={openSizeGuide} onOpenChange={setOpenSizeGuide}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Size Guide</DialogTitle>
              <DialogDescription>
                Compare your body measurement and get a quick recommendation before ordering.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="body-chest-cm">Your Chest (cm)</Label>
                  <Input
                    id="body-chest-cm"
                    type="number"
                    min={70}
                    max={140}
                    value={bodyChestCm}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setBodyChestCm(Number.isFinite(value) ? value : 96);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fit Preference</Label>
                  <div className="flex flex-wrap gap-2">
                    {(["Regular", "Relaxed", "Slim"] as const).map((fit) => (
                      <Button
                        key={fit}
                        type="button"
                        size="sm"
                        variant={fitPreference === fit ? "default" : "outline"}
                        onClick={() => setFitPreference(fit)}
                      >
                        {fit}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {isApparelProduct && recommendedSize && (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                  Recommended size for you: <span className="font-bold">{recommendedSize}</span>
                </div>
              )}

              <div className="rounded-2xl border border-border/50 overflow-hidden">
                <div className="grid grid-cols-3 bg-muted/40 px-4 py-3 text-sm font-semibold">
                  <span>Size</span>
                  <span>Chest Range</span>
                  <span>Body Length</span>
                </div>
                {getSizeChart(product.category).map((row) => (
                  <div key={row.size} className="grid grid-cols-3 px-4 py-3 text-sm border-t border-border/50">
                    <span>{row.size}</span>
                    <span>{row.chest}</span>
                    <span>{row.bodyLength}</span>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenSizeGuide(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={openFullscreenGallery} onOpenChange={setOpenFullscreenGallery}>
          <DialogContent className="sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>{product.name} Gallery</DialogTitle>
              <DialogDescription>View the full set of product images in a larger viewer.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border bg-muted">
                <Image src={activeImage || product.image} alt={product.name} fill className="object-contain" />
                <button
                  type="button"
                  title="Previous image"
                  aria-label="Previous image"
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white hover:bg-black/70"
                  onClick={() => {
                    const current = Math.max(0, galleryImages.findIndex((item) => item === (activeImage || galleryImages[0])));
                    const next = (current - 1 + galleryImages.length) % galleryImages.length;
                    setSelectedGalleryImage(galleryImages[next]);
                  }}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  title="Next image"
                  aria-label="Next image"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white hover:bg-black/70"
                  onClick={() => {
                    const current = Math.max(0, galleryImages.findIndex((item) => item === (activeImage || galleryImages[0])));
                    const next = (current + 1) % galleryImages.length;
                    setSelectedGalleryImage(galleryImages[next]);
                  }}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {galleryImages.map((img, idx) => (
                  <button
                    key={`${img}-${idx}`}
                    type="button"
                    title={`Gallery thumbnail ${idx + 1}`}
                    aria-label={`Gallery thumbnail ${idx + 1}`}
                    onClick={() => setSelectedGalleryImage(img)}
                    className={`relative aspect-square overflow-hidden rounded-lg border-2 ${activeImage === img ? "border-primary" : "border-transparent"}`}
                  >
                    <Image src={img} alt={`${product.name} ${idx + 1}`} fill className="object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
