import ProductDetailsClient from "./ProductDetailsClient";

type ProductsApiResponse = {
  success?: boolean;
  products?: Array<{ id?: string }>;
};

export async function generateStaticParams() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!apiBaseUrl) {
    return [];
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
    return [];
  }

  return [];
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
