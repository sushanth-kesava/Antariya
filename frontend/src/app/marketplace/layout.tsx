import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace | Antariya",
  description: "Explore Antariya's premium embroidered apparel, supplies, and collections.",
  alternates: { canonical: "/marketplace/" },
  openGraph: { url: "/marketplace/", title: "Marketplace | Antariya" },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
