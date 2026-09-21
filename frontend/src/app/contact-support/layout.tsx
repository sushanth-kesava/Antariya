import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Support | Antariya",
  description: "Contact the Antariya support team by email, phone, WhatsApp, or support ticket.",
  alternates: { canonical: "/contact-support/" },
  openGraph: { url: "/contact-support/", title: "Contact Support | Antariya" },
};

export default function ContactSupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
