"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Star,
  Upload,
  X,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  addProductReviewOnBackend,
  getProductByIdFromBackend,
  getReviewEligibilityFromBackend,
  ProductReviewInput,
  ProductReviewTag,
  ReviewEligibility,
} from "@/lib/api/products";
import { Product } from "@/app/lib/mock-data";

const REVIEW_TAGS: ProductReviewTag[] = ["Quality", "Fit", "Delivery", "Customization"];
const MAX_IMAGES = 4;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error("Failed to read the selected image"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error("Failed to read the selected image"));
    reader.readAsDataURL(file);
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function ReviewPageClient({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState<Required<ProductReviewInput>>({
    rating: 5,
    title: "",
    comment: "",
    tags: [] as ProductReviewTag[],
    images: [] as string[],
  });

  // ─── Load product + eligibility (must be logged in) ───────────────────────
  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("app_auth_token") : null;

      if (!token) {
        router.replace(`/login?next=/product/${id}/review`);
        return;
      }

      try {
        const [productData, eligibilityData] = await Promise.all([
          getProductByIdFromBackend(id),
          getReviewEligibilityFromBackend(token, id),
        ]);

        if (!active) return;

        setProduct(productData);
        setEligibility(eligibilityData);

        // Prefill when the customer is editing an existing review.
        if (eligibilityData?.existingReview) {
          const existing = eligibilityData.existingReview;
          setForm({
            rating: existing.rating,
            title: existing.title,
            comment: existing.comment,
            tags: existing.tags || [],
            images: existing.images || [],
          });
        }
      } catch (error) {
        if (!active) return;
        toast({
          title: "Could not load review page",
          description: getErrorMessage(error, "Please try again."),
        });
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [id, router, toast]);

  const canReview = eligibility ? eligibility.canReview : false;
  const isEditing = Boolean(eligibility?.hasReviewed);

  const handleTagToggle = (tag: ProductReviewTag) => {
    setForm((prev) => {
      const exists = prev.tags.includes(tag);
      return exists
        ? { ...prev, tags: prev.tags.filter((t) => t !== tag) }
        : { ...prev, tags: [...prev.tags, tag] };
    });
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remaining = Math.max(0, MAX_IMAGES - form.images.length);
    if (remaining === 0) {
      toast({ title: "Image limit reached", description: `You can attach up to ${MAX_IMAGES} images.` });
      return;
    }

    try {
      const selected = Array.from(files).slice(0, remaining);
      const uploaded = await Promise.all(selected.map((f) => readFileAsDataUrl(f)));
      setForm((prev) => ({ ...prev, images: [...prev.images, ...uploaded].slice(0, MAX_IMAGES) }));
    } catch (error) {
      toast({ title: "Image upload failed", description: getErrorMessage(error, "Please try again.") });
    }
  };

  const removeImage = (index: number) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("app_auth_token") : null;
    if (!token) {
      router.push(`/login?next=/product/${id}/review`);
      return;
    }

    if (!form.title.trim() || !form.comment.trim()) {
      toast({ title: "Missing review details", description: "Add a title and comment before submitting." });
      return;
    }

    if (eligibility && !eligibility.canReview) {
      toast({ title: "Review not available yet", description: eligibility.message });
      return;
    }

    try {
      setSubmitting(true);
      await addProductReviewOnBackend(token, id, {
        rating: form.rating,
        title: form.title.trim(),
        comment: form.comment.trim(),
        tags: form.tags,
        images: form.images,
      });
      setSubmitted(true);
      toast({
        title: isEditing ? "Review updated" : "Review submitted",
        description: "Thanks for sharing your feedback!",
      });
    } catch (error) {
      toast({ title: "Could not submit review", description: getErrorMessage(error, "Please try again.") });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ─── Success state ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
        <h1 className="mt-4 text-2xl font-bold">Thank you for your review!</h1>
        <p className="mt-2 text-muted-foreground">
          Your feedback for <span className="font-semibold">{product?.name}</span> has been published and now
          appears on the product page.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href={`/product/${id}`}>View product page</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/portal/customer">Back to My Portal</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/portal/customer"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to My Portal
      </Link>

      {/* Product header */}
      {product && (
        <Card className="mb-6">
          <CardContent className="flex items-center gap-4 p-4">
            {product.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image}
                alt={product.name}
                className="h-20 w-20 rounded-lg border object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold">{product.name}</h1>
              <p className="text-sm text-muted-foreground">
                {isEditing ? "Update your review" : "Write a review"}
              </p>
              {eligibility?.hasDeliveredOrder && (
                <Badge variant="secondary" className="mt-1 gap-1">
                  <ShieldCheck className="h-3 w-3" /> Verified purchase
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not eligible */}
      {!canReview ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="h-10 w-10 text-amber-500" />
            <p className="font-semibold">Reviews open after delivery</p>
            <p className="text-sm text-muted-foreground">
              {eligibility?.message || "You can review this product once your order has been delivered."}
            </p>
            <Button asChild variant="outline" className="mt-2">
              <Link href={`/product/${id}`}>View product</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-6 p-6">
            {/* Star rating */}
            <div>
              <label className="mb-2 block text-sm font-semibold">Your rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, rating: value }))}
                    aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                    className="p-1"
                  >
                    <Star
                      className={`h-8 w-8 transition-colors ${
                        value <= form.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="review-title" className="mb-2 block text-sm font-semibold">
                Review title
              </label>
              <input
                id="review-title"
                type="text"
                maxLength={120}
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Sum up your experience"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Comment */}
            <div>
              <label htmlFor="review-comment" className="mb-2 block text-sm font-semibold">
                Your review
              </label>
              <textarea
                id="review-comment"
                rows={5}
                maxLength={1200}
                value={form.comment}
                onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
                placeholder="What did you like or dislike? How is the quality, fit, and finish?"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">{form.comment.length}/1200</p>
            </div>

            {/* Tags */}
            <div>
              <label className="mb-2 block text-sm font-semibold">
                What stood out? <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {REVIEW_TAGS.map((tag) => {
                  const active = form.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagToggle(tag)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-gray-200 bg-white text-gray-600 hover:border-primary"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Images */}
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Add photos <span className="font-normal text-muted-foreground">(up to {MAX_IMAGES}, optional)</span>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {form.images.map((src, index) => (
                  <div key={index} className="relative h-20 w-20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Review photo ${index + 1}`} className="h-20 w-20 rounded-lg border object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      aria-label="Remove image"
                      className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {form.images.length < MAX_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-primary hover:text-primary"
                  >
                    <Upload className="h-5 w-5" />
                    <span className="text-[10px]">Upload</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => handleImageUpload(e.target.files)}
                />
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 border-t pt-4">
              <Button asChild variant="ghost">
                <Link href={`/product/${id}`}>Cancel</Link>
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update review" : "Submit review"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
