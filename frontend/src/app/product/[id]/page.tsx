import ProductDetailsClient from "./ProductDetailsClient";

// Static export: pre-build a shell page.
// The actual product ID is read from the URL by ProductDetailsClient at runtime.
// In production (Hostinger), .htaccess rewrites all /product/* to this shell.
// In dev mode, Next.js serves this for any /product/[id] URL automatically.
export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function ProductPage({ params }: { params: { id: string } }) {
  // Pass the param to the client component — in production it'll be "placeholder"
  // but ProductDetailsClient reads the real ID from window.location anyway.
  return <ProductDetailsClient id={params.id || ""} />;
}
