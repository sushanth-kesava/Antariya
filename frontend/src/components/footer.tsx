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
    title: "Marketplace",
    links: [
      { label: "Embroidery Designs", href: "/marketplace" },
      { label: "Premium Threads", href: "/shop/hoodies" },
      { label: "Industrial Fabrics", href: "/shop" },
      { label: "Machine Parts", href: "/shop" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: "/#hero" },
      { label: "Dealer Program", href: "/portal/admin" },
      { label: "Careers", href: "/#hero" },
      { label: "Contact Support", href: "/#hero" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Tracking Orders", href: "/portal/customer" },
      { label: "Policies Hub", href: "/legal/policies" },
      { label: "Contact Support", href: "/#hero" },
    ],
  },
];

const SOCIAL_LINKS = [
  { label: "Facebook", href: "https://www.facebook.com/" },
  { label: "Instagram", href: "https://www.instagram.com/antariya.official/?__pwa=1" },
  { label: "LinkedIn", href: "https://www.linkedin.com/feed/" },
  { label: "Twitter", href: "https://x.com/" },
];

const FOOTER_COPY: Record<FooterVariant, { title: string; description: string; links: Array<{ label: string; href: string }>; note: string }> = {
  public: {
    title: "Antariya",
    description: "Empowering India's embroidery industry with premium digital assets, physical supplies, and machine solutions.",
    links: [
      { label: "All Policies", href: "/legal/policies" },
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "Contact", href: "#" },
    ],
    note: `© ${COPYRIGHT_YEAR} Antariya India. All rights reserved.`,
  },
  customer: {
    title: "Customer Portal",
    description: "Browse finished apparel, customize products, and keep track of your orders and saved items.",
    links: [
      { label: "Shop", href: "/shop" },
      { label: "Marketplace", href: "/marketplace" },
      { label: "Customer Dashboard", href: "/portal/customer" },
    ],
    note: "Customer access for Antariya shoppers and creators.",
  },
  admin: {
    title: "Admin Portal",
    description: "Manage inventory, publish products, review moderation queues, and track operations.",
    links: [
      { label: "Operations Overview", href: "/portal/admin/operations-overview" },
      { label: "Catalog", href: "/portal/admin/my-company-catalog" },
      { label: "Reviews", href: "/portal/admin/review-moderation" },
    ],
    note: "Admin workspace for dealer and catalog management.",
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
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="absolute inset-x-0 -top-24 h-48 bg-gradient-to-b from-primary/8 to-transparent blur-3xl" />
      <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6 relative">
        <div className={variant === "public" ? "grid grid-cols-1 md:grid-cols-4 gap-12 mb-16" : "grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-10 items-start mb-12"}>
          <div className="space-y-6 max-w-md">
            <Link href="/" className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BRAND_LOGO_URL} alt="Antariya logo" className="h-24 w-24 rounded-2xl object-cover shadow-sm" />
              <div>
                <h3 className="font-theseasons text-5xl font-bold tracking-tight text-foreground leading-[1.05]">Antariya</h3>
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Premium embroidery marketplace</p>
              </div>
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {variant === "public"
                ? "Empowering India's embroidery industry with premium digital assets, physical supplies, and machine solutions for growing businesses."
                : copy.description}
            </p>
            {variant === "public" && (
              <p className="inline-flex items-center rounded-full border border-border bg-background/60 px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
                {copy.note}
              </p>
            )}
            {variant === "public" && (
              <div className="max-w-sm pt-2">
                <NewsletterSignup source="footer" />
              </div>
            )}
          </div>

          {variant === "public" ? (
            PUBLIC_SECTIONS.map((section) => (
              <div key={section.title}>
                <h4 className="font-bold mb-6 text-foreground">{section.title}</h4>
                <ul className="space-y-4 text-sm text-muted-foreground">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="hover:text-primary transition-colors">
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
                <Link key={link.label} href={link.href} className="hover:text-primary transition-colors">
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
