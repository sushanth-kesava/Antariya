import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Antariya | Premium Embroidery",
  description: "Learn how Antariya connects modern apparel with India's embroidery craft and creative traditions.",
  alternates: { canonical: "/about/" },
  openGraph: { url: "/about/", title: "About Antariya | Premium Embroidery" },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
