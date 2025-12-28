import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  // Set base path for GitHub Pages (repo name)
  basePath: isProd ? "/offline-period-tracker" : "",
  assetPrefix: isProd ? "/offline-period-tracker/" : "",
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
