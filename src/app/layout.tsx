
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { BRAND_ICON_URL, BRAND_LOGO_URL } from '@/lib/brand';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Antariya | Premium Embroidery Marketplace',
  description: 'The ultimate marketplace for embroidery designs, threads, fabrics, and machine accessories.',
  metadataBase: new URL(siteUrl),
  icons: {
    icon: [{ url: BRAND_ICON_URL, href: BRAND_ICON_URL }],
    shortcut: [BRAND_ICON_URL],
    apple: [BRAND_ICON_URL],
  },
  openGraph: {
    title: 'Antariya | Premium Embroidery Marketplace',
    description: 'The ultimate marketplace for embroidery designs, threads, fabrics, and machine accessories.',
    url: siteUrl,
    siteName: 'Antariya',
    type: 'website',
    images: [{ url: BRAND_LOGO_URL }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Antariya | Premium Embroidery Marketplace',
    description: 'The ultimate marketplace for embroidery designs, threads, fabrics, and machine accessories.',
    images: [BRAND_LOGO_URL],
  },
};

import { GoogleOAuthProvider } from '@react-oauth/google';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN">
      <head>
        <link rel="icon" href={BRAND_ICON_URL} />
        <link rel="shortcut icon" href={BRAND_ICON_URL} />
        <link rel="apple-touch-icon" href={BRAND_ICON_URL} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Literata:opsz,wght@7..72,400;7..72,600;7..72,700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased selection:bg-primary selection:text-white">
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID"}>
          {children}
          <Toaster />
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
