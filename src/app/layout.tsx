
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Antariya | Premium Embroidery Marketplace',
  description: 'The ultimate marketplace for embroidery designs, threads, fabrics, and machine accessories.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: 'Antariya | Premium Embroidery Marketplace',
    description: 'The ultimate marketplace for embroidery designs, threads, fabrics, and machine accessories.',
    url: siteUrl,
    siteName: 'Antariya',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Antariya | Premium Embroidery Marketplace',
    description: 'The ultimate marketplace for embroidery designs, threads, fabrics, and machine accessories.',
  },
};

import { GoogleOAuthProvider } from '@react-oauth/google';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
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
