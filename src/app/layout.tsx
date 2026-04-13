
import type {Metadata} from 'next';
import { Inter, Literata } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { BRAND_ICON_URL, BRAND_LOGO_URL } from '@/lib/brand';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const literata = Literata({
  subsets: ['latin'],
  variable: '--font-literata',
});

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
      </head>
      <body className={`${inter.variable} ${literata.variable} font-body antialiased selection:bg-primary selection:text-white`}>
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID"}>
          {children}
          <Toaster />
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
