import { ImageResponse } from "next/og";
import { BrandSeal } from "@/lib/brandImage";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<div style={{ display: "flex", width: 64, height: 64 }}><BrandSeal size={64} /></div>, size);
}
