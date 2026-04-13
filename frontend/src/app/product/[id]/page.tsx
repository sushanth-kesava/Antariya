import { MOCK_PRODUCTS } from "@/app/lib/mock-data";
import ProductDetailsClient from "./ProductDetailsClient";

type ProductsApiResponse = {
  success?: boolean;
  products?: Array<{ id?: string }>;
};

export async function generateStaticParams() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!apiBaseUrl) {
    return MOCK_PRODUCTS.map((product) => ({ id: product.id }));
  }

  try {
    const response = await fetch(`${apiBaseUrl}/products`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch products for static params (${response.status})`);
    }

    const data = (await response.json()) as ProductsApiResponse;
    const backendIds = (data.products || [])
      .map((product) => String(product.id || "").trim())
      .filter((id) => id.length > 0);

    if (backendIds.length > 0) {
      return backendIds.map((id) => ({ id }));
    }
  } catch {
    // Fallback keeps build stable when API is temporarily unavailable.
  }

  return MOCK_PRODUCTS.map((product) => ({ id: product.id }));
}

type ProductPageProps = {
  params: {
    id: string;
  };
};

export default function ProductPage({ params }: ProductPageProps) {
  return <ProductDetailsClient id={params.id} />;
}
