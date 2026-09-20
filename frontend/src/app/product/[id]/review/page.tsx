import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { getProductsFromBackend } from "@/lib/api/products";
import ReviewPageClient from "./ReviewPageClient";

// ─── Static export: emit one /product/<id>/review/ page per product ──────────
// Mirrors the sibling product page's generateStaticParams so `output: "export"`
// produces a crawlable shell for every product's review route. A "placeholder"
// entry is always included so the .htaccess fallback (and products created
// after the last build) still resolve to a shell that hydrates client-side.
export async function generateStaticParams() {
  const ids = new Set<string>(["placeholder"]);

  try {
    const limit = 100;
    let page = 1;
    let pages = 1;

    do {
      const { products, pagination } = await getProductsFromBackend({ page, limit });
      for (const product of products) {
        if (product?.id) ids.add(String(product.id));
      }
      pages = pagination?.pages || 1;
      page += 1;
      if (page > 200) break;
    } while (page <= pages);
  } catch (error) {
    console.warn(
      "[product/review/generateStaticParams] Could not fetch products at build time; " +
        "shipping placeholder shell only.",
      error instanceof Error ? error.message : error
    );
  }

  return Array.from(ids).map((id) => ({ id }));
}

// Review pages are personal, gated actions — keep them out of the index.
export const metadata: Metadata = {
  title: "Write a Review | Antariya",
  robots: { index: false, follow: false },
};

export default async function ProductReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50/50 font-sans">
      <Navbar />
      <ReviewPageClient id={id || ""} />
    </div>
  );
}
