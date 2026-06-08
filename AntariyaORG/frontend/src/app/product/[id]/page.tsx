import ProductDetailsClient from "./ProductDetailsClient";
import { getApiBaseUrl } from "@/lib/api/base-url";

type ProductsApiResponse = {
  success?: boolean;
  products?: Array<{ id?: string }>;
};

export async function generateStaticParams() {
  const apiBaseUrl = getApiBaseUrl();

  try {
    const response = await fetch(`${apiBaseUrl}/products`, {
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

    throw new Error("No products found in response");
  } catch (error) {
    console.warn(
      "Failed to fetch products for generateStaticParams:",
      error instanceof Error ? error.message : String(error)
    );
    // Fallback: return an empty ID to allow build to complete
    // The actual product data will be fetched client-side
    return [{ id: "placeholder" }];
  }
}

type ProductPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;

  return <ProductDetailsClient id={id} />;
}
