import type { Metadata } from "next";
import ProductDetailsClient from "./ProductDetailsClient";
import { getProductsFromBackend, getProductByIdFromBackend } from "@/lib/api/products";
import { normalizeCatalogPriceToINR } from "@/lib/india";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://antariyaofficial.com").replace(/\/+$/, "");

// ─── Build-time: pre-render a real HTML page for every product ───────────────
// With `output: "export"`, Next.js emits one static page per returned param.
// We paginate through the PUBLIC products API at build time so each product URL
// (/product/<id>/) ships as crawlable HTML with real per-product metadata —
// fixing the soft-404 / thin-content issue caused by the old single-shell
// approach. A "placeholder" entry is always included so the .htaccess fallback
// (and any product created after the last build) still resolves to a shell.
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
      // Hard stop so a misbehaving API can never spin the build forever.
      if (page > 200) break;
    } while (page <= pages);
  } catch (error) {
    // If the backend is unreachable at build time, fall back to just the shell
    // so the deploy still succeeds (dynamic client fetch continues to work).
    console.warn(
      "[product/generateStaticParams] Could not fetch products at build time; " +
        "shipping placeholder shell only.",
      error instanceof Error ? error.message : error
    );
  }

  return Array.from(ids).map((id) => ({ id }));
}

// ─── Per-product SEO metadata (title, description, canonical, OpenGraph) ─────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  if (!id || id === "placeholder") {
    return { title: "Product | Antariya", robots: { index: false, follow: true } };
  }

  try {
    const product = await getProductByIdFromBackend(id);
    if (!product) {
      return { title: "Product | Antariya", robots: { index: false, follow: true } };
    }

    const canonical = `${siteUrl}/product/${id}/`;
    const rawDescription = String(product.description || "")
      .replace(/<[^>]*>/g, " ") // strip any HTML
      .replace(/\s+/g, " ")
      .trim();
    const description =
      rawDescription.slice(0, 160) ||
      `${product.name} — available on Antariya, the premium embroidery marketplace.`;
    const image = product.image || (product.images && product.images[0]);

    return {
      title: `${product.name} | Antariya`,
      description,
      alternates: { canonical },
      openGraph: {
        title: `${product.name} | Antariya`,
        description,
        url: canonical,
        siteName: "Antariya",
        type: "website",
        ...(image ? { images: [{ url: image }] } : {}),
      },
      twitter: {
        card: "summary_large_image",
        title: `${product.name} | Antariya`,
        description,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch {
    // On any fetch error, don't block the build — emit a safe default.
    return { title: "Product | Antariya" };
  }
}

// Build a schema.org Product JSON-LD object, rendered server-side so it ships
// in the static HTML (crawlable by Google for rich results). Prices are
// normalized to INR to match what the storefront actually displays.
function buildProductJsonLd(product: NonNullable<Awaited<ReturnType<typeof getProductByIdFromBackend>>>) {
  const canonical = `${siteUrl}/product/${product.id}/`;
  const priceInr = normalizeCatalogPriceToINR(Number(product.price) || 0);
  const images = [product.image, ...(product.images || []), ...(product.galleryImages || [])]
    .filter((src): src is string => typeof src === "string" && src.length > 0);
  const description = String(product.description || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(description ? { description } : {}),
    ...(images.length ? { image: Array.from(new Set(images)) } : {}),
    sku: product.id,
    brand: { "@type": "Brand", name: "Antariya" },
    offers: {
      "@type": "Offer",
      url: canonical,
      priceCurrency: "INR",
      price: priceInr.toFixed(2),
      availability:
        (product.stock || 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: "Antariya" },
    },
  };

  const ratingValue = Number(product.reviewAverage ?? product.rating ?? 0);
  const reviewCount = Number(product.reviewCount ?? 0);
  if (ratingValue > 0 && reviewCount > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: ratingValue.toFixed(1),
      reviewCount,
    };
  }

  return jsonLd;
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let jsonLd: Record<string, unknown> | null = null;
  if (id && id !== "placeholder") {
    try {
      const product = await getProductByIdFromBackend(id);
      if (product) jsonLd = buildProductJsonLd(product);
    } catch {
      // Non-fatal: skip structured data if the product can't be fetched at build.
      jsonLd = null;
    }
  }

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <ProductDetailsClient id={id || ""} />
    </>
  );
}
