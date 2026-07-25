import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Static export for Hostinger deployment
  ...(isProduction ? { output: "export" } : {}),
  trailingSlash: true,
  // NOTE: Redirects moved to .htaccess — Next.js redirects() does NOT work
  // with output: "export" (static site). See public/.htaccess for all 301s.
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
