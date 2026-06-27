import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  typescript: {
    ignoreBuildErrors: true,
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
