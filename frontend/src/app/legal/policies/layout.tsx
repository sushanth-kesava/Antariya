import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Policies | Antariya",
  description: "Review Antariya's privacy, shipping, returns, and platform policies.",
  alternates: { canonical: "/legal/policies/" },
  openGraph: { url: "/legal/policies/", title: "Policies | Antariya" },
};

export default function PoliciesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
