import ProductDetailsClient from "./ProductDetailsClient";

// Static export: pre-build a shell page.
// The actual product ID is read from the URL by ProductDetailsClient at runtime.
// In production (Hostinger), .htaccess rewrites all /product/* to this shell.
export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductDetailsClient id={id || ""} />;
}
