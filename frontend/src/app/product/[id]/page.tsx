import ProductDetailsClient from "./ProductDetailsClient";
import { getApiBaseUrl } from "@/lib/api/base-url";
import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://antariyaofficial.com";

type ProductsApiResponse = {
  success?: boolean;
  products?: Array<{ id?: string }>;
};

type ProductDetailApiResponse = {
  success?: boolean;
  product?: {
    name?: string;
    description?: string;
    image?: string;
    price?: number;
  };
};

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const apiBaseUrl = getApiBaseUrl();

  try {
    const response = await fetch(`${apiBaseUrl}/products/${id}`, { cache: "no-store" });
    const data = (await response.json()) as ProductDetailApiResponse;
    const product = data.product;

    if (!product) throw new Error("No product");

    const title = `${product.name} | Antariya`;
    const description = `${product.name} from Antariya. ${product.description}`;
    const image = product.image || `${siteUrl}/og-default.jpg`;
    const url = `${siteUrl}/product/${id}`;

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        title,
        description,
        url,
        type: "website",
        images: [{ url: image }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
    };
  } catch {
    return {
      title: "Product | Antariya",
      description: "Premium embroidery marketplace.",
    };
  }
}

// For dynamic routes: generate initial product IDs, but ISR will auto-generate new ones
export async function generateStaticParams() {
  const apiBaseUrl = getApiBaseUrl();

  try {
    const response = await fetch(`${apiBaseUrl}/products?limit=500`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch products (${response.status})`);
    }

    const data = (await response.json()) as ProductsApiResponse;
    const backendIds = (data.products || [])
      .map((product) => String(product.id || "").trim())
      .filter((id) => id.length > 0);

    if (backendIds.length > 0) {
      return backendIds.map((id) => ({ id }));
    }

    // Empty array means ISR will generate pages on-demand
    return [];
  } catch (error) {
    console.warn(
      "Failed to fetch products for generateStaticParams:",
      error instanceof Error ? error.message : String(error)
    );
    // Return empty array - ISR will handle page generation on first request
    return [];
  }
}

export const revalidate = 60; // Revalidate every 60 seconds for ISR

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;

  return <ProductDetailsClient id={id} />;
}
