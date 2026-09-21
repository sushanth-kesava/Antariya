import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Custom Hoodies | Antariya",
  description: "Browse premium hoodie bases designed for Antariya custom embroidery.",
  alternates: { canonical: "/shop/hoodies/" },
  openGraph: { url: "/shop/hoodies/", title: "Custom Hoodies | Antariya" },
};

export default function HoodiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
