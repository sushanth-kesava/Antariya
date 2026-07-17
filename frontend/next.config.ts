import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Static export for Hostinger deployment (produces /out folder).
  // NOTE: This disables dynamic server features (ISR, middleware redirects).
  // If you move to Vercel/Render for the frontend, REMOVE this line to enable
  // full SSR and middleware capabilities.
  ...(isProduction ? { output: "export" } : {}),
  trailingSlash: true,
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
