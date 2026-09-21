import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop | Antariya",
  description: "The Antariya storefront is coming soon. Explore our marketplace in the meantime.",
  alternates: { canonical: "/shop/" },
  robots: { index: false, follow: true },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
