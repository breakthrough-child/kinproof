import { ImageResponse } from "next/og";
import { BrandSeal } from "@/lib/brandImage";

const SIZES = new Set([192, 512]);

/** PWA manifest icons (192 and 512). The seal sits inside the maskable safe zone. */
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const n = Number((await ctx.params).size);
  if (!SIZES.has(n)) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: n, height: n, background: "#f7f1e5" }}><BrandSeal size={Math.round(n * 0.7)} /></div>,
    { width: n, height: n },
  );
}
