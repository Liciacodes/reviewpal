import type { NextConfig } from "next";

// Where the ReviewPal API runs. Only the dashboard server uses this: the browser always
// calls the dashboard's own domain, so cookies stay first-party (see rewrites below).
const API_ORIGIN = (process.env.API_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The dev-only "N" badge would cover the sidebar's Sign out button in the bottom-left
  devIndicators: { position: "bottom-right" },
  // Forward API, sign-in and health requests to the API server
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` },
      { source: "/auth/:path*", destination: `${API_ORIGIN}/auth/:path*` },
      { source: "/health", destination: `${API_ORIGIN}/health` },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    // The repo has two lockfiles (server in the root, dashboard here). Next.js runs from web/
    // locally and on Vercel (Root Directory "web"), so that's the dashboard's root.
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
