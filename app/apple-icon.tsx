import { ImageResponse } from "next/og";
import { BrandSeal } from "@/lib/brandImage";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 180, height: 180, background: "#f7f1e5" }}><BrandSeal size={140} /></div>,
    size,
  );
}
