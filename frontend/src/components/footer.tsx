import Link from "next/link";
import { BRAND_LOGO_URL } from "@/lib/brand";
import { NewsletterSignup } from "@/components/newsletter-signup";

type FooterVariant = "public" | "customer" | "admin" | "superadmin";

type FooterProps = {
  variant?: FooterVariant;
};

const COPYRIGHT_YEAR = 2026;

const PUBLIC_SECTIONS = [
  {
    title: "Shop",
    links: [
      { label: "New Arrivals", href: "/marketplace" },
      { label: "Bestsellers", href: "/shop" },
      { label: "Collections", href: "/marketplace" },
      { label: "Custom Studio", href: "/customize" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Our Craft", href: "/about" },
      { label: "Careers", href: "/coming-soon" },
      { label: "Contact", href: "/contact-support" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Track Order", href: "/track-order" },
      { label: "Shipping & Returns", href: "/legal/policies" },
      { label: "Size Guide", href: "/coming-soon" },
      { label: "Support", href: "/contact-support" },
    ],
  },
];

const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://www.instagram.com/antariya.official/?__pwa=1" },
  { label: "Facebook", href: "https://www.facebook.com/" },
  { label: "Twitter", href: "https://x.com/" },
  { label: "LinkedIn", href: "https://www.linkedin.com/feed/" },
];

const FOOTER_COPY: Record<FooterVariant, { title: string; description: string; links: Array<{ label: string; href: string }>; note: string }> = {
  public: {
    title: "Antariya",
    description: "Premium embroidered streetwear. Crafted with precision. Designed for individuality.",
    links: [
      { label: "All Policies", href: "/legal/policies" },
      { label: "Privacy Policy", href: "/legal/policies" },
      { label: "Terms of Service", href: "/legal/policies" },
      { label: "Contact", href: "/contact-support" },
    ],
    note: `© ${COPYRIGHT_YEAR} Antariya. All rights reserved.`,
  },
  customer: {
    title: "Customer Portal",
    description: "Browse finished apparel, customize products, and keep track of your orders and saved items.",
    links: [
      { label: "Shop", href: "/shop" },
      { label: "Collections", href: "/marketplace" },
      { label: "Customer Dashboard", href: "/portal/customer" },
    ],
    note: "Customer access for Antariya shoppers.",
  },
  admin: {
    title: "Admin Portal",
    description: "Manage inventory, publish products, review moderation queues, and track operations.",
    links: [
      { label: "Operations Overview", href: "/portal/admin/operations-overview" },
      { label: "Catalog", href: "/portal/admin/my-company-catalog" },
      { label: "Reviews", href: "/portal/admin/review-moderation" },
    ],
    note: "Admin workspace for catalog management.",
  },
  superadmin: {
    title: "Superadmin Portal",
    description: "Review the full platform, all dealers, and the complete product database.",
    links: [
      { label: "Overview", href: "/portal/superadmin" },
      { label: "Admin Portal", href: "/portal/admin" },
      { label: "Customer Portal", href: "/portal/customer" },
    ],
    note: "Platform-wide oversight for Antariya leadership.",
  },
};

export function Footer({ variant = "public" }: FooterProps) {
  const copy = FOOTER_COPY[variant];

  return (
    <footer className="relative overflow-hidden border-t bg-card pt-20 pb-10">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className={variant === "public" ? "grid grid-cols-1 md:grid-cols-5 gap-12 mb-16" : "grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-10 items-start mb-12"}>
          <div className="md:col-span-2 space-y-6 max-w-sm">
            <Link href="/" className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BRAND_LOGO_URL} alt="Antariya logo" className="h-16 w-16 rounded-xl object-cover" />
              <div>
                <h3 className="font-theseasons text-4xl font-bold tracking-tight text-foreground leading-[1.05]">Antariya</h3>
                <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Premium Embroidered Streetwear</p>
              </div>
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {variant === "public"
                ? "Crafted with precision. Designed for individuality. Premium streetwear that blends modern Indian artistry with bold, everyday confidence."
                : copy.description}
            </p>
            {variant === "public" && (
              <div className="max-w-sm pt-2">
                <NewsletterSignup source="footer" />
              </div>
            )}
          </div>

          {variant === "public" ? (
            PUBLIC_SECTIONS.map((section) => (
              <div key={section.title}>
                <h4 className="font-bold text-sm uppercase tracking-wider mb-6 text-foreground">{section.title}</h4>
                <ul className="space-y-4 text-sm text-muted-foreground">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="hover:text-foreground transition-colors">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-border bg-background/70 p-6 shadow-sm backdrop-blur-sm">
              <h4 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground mb-4">{copy.title}</h4>
              <p className="text-sm leading-relaxed text-muted-foreground mb-6">{copy.description}</p>
              <div className="flex flex-wrap gap-3">
                {copy.links.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t pt-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-muted-foreground">{copy.note}</p>
          {variant === "public" ? (
            <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-muted-foreground">
              {SOCIAL_LINKS.map((link) => (
                <Link key={link.label} href={link.href} className="hover:text-foreground transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {copy.links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="rounded-full border border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
