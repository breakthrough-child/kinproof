import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kinproof",
    short_name: "Kinproof",
    description: "Proof of person, not proof of voice.",
    start_url: "/inbox",
    display: "standalone",
    background_color: "#f7f1e5",
    theme_color: "#14594f",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
