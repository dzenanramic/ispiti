import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Aplikacija je potpuno dinamička (sesije, rezultati, rokovi), pa nam
  // Cache Components ne donosi ništa osim obaveznih Suspense granica.
  cacheComponents: false,
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
