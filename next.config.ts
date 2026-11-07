import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mirror DEMO_MODE to the client so error screens (incl. global-error) can show real error messages in demo.
  env: { NEXT_PUBLIC_DEMO_MODE: process.env.DEMO_MODE === "true" ? "true" : "false" },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
