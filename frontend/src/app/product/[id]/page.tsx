import ProductDetailsClient from "./ProductDetailsClient";

// Static export: pre-build a shell page.
// The actual product ID is read from the URL by ProductDetailsClient at runtime.
// All product URLs are rewritten to this shell via .htaccess.
export async function generateStaticParams() {
  // Return a single placeholder — Next.js needs at least one entry for
  // dynamic routes in static export mode. The client reads the real ID
  // from window.location at runtime.
  return [{ id: "placeholder" }];
}

export default function ProductPage() {
  return <ProductDetailsClient id="" />;
}
