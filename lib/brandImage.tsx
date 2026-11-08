import { SEAL_EDGE } from "@/lib/sealPath";

/** The brand seal as an inline SVG element that satori (ImageResponse) can render. */
export function BrandSeal({ size, fill = "#14594f", ink = "#fffdf6" }: { size: number; fill?: string; ink?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <path d={SEAL_EDGE} fill={fill} />
      <path d="M21 33.5l8 8 14.5-16.5" fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Fetch a Google Font as TTF for satori. Returns undefined on any failure so images fall back to the default font. */
export async function googleFont(family: string, weight: number): Promise<ArrayBuffer | undefined> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1" } })).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return undefined;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return undefined;
  }
}
