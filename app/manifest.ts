import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kinproof",
    short_name: "Kinproof",
    description: "Proof of person, not proof of voice.",
    start_url: "/inbox",
    display: "standalone",
    background_color: "#f6f4ee",
    theme_color: "#1b6b60",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
