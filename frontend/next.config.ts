import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Firebase App Hosting supports SSR natively — no static export needed.
  // If you ever need static export again (e.g. for Hostinger), uncomment:
  // ...(isProduction ? { output: "export" } : {}),
  trailingSlash: true,
  async redirects() {
    return [
      // Old public_html URLs → new Next.js routes
      { source: '/products', destination: '/shop/', permanent: true },
      { source: '/products/', destination: '/shop/', permanent: true },
      { source: '/story', destination: '/about/', permanent: true },
      { source: '/story/', destination: '/about/', permanent: true },
      { source: '/contact', destination: '/contact-support/', permanent: true },
      { source: '/contact/', destination: '/contact-support/', permanent: true },
      { source: '/legal/privacy', destination: '/legal/policies/', permanent: true },
      { source: '/legal/privacy/', destination: '/legal/policies/', permanent: true },
      { source: '/legal/terms', destination: '/legal/policies/', permanent: true },
      { source: '/legal/terms/', destination: '/legal/policies/', permanent: true },
      { source: '/legal/shipping', destination: '/legal/policies/', permanent: true },
      { source: '/legal/shipping/', destination: '/legal/policies/', permanent: true },
      { source: '/legal/returns', destination: '/legal/policies/', permanent: true },
      { source: '/legal/returns/', destination: '/legal/policies/', permanent: true },
    ];
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "claura.in",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.claura.in",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
