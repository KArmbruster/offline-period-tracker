import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
// "mobile" builds are bundled into the native app, which serves from the root
const isMobile = process.env.BUILD_TARGET === "mobile";

// Web production builds live under the GitHub Pages repo path
const basePath = isProd && !isMobile ? "/offline-period-tracker" : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath ? `${basePath}/` : "",
  // Exposed to the app as the single source of truth (see src/lib/base-path.ts)
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
