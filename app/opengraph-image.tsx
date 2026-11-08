import { ImageResponse } from "next/og";
import { BrandSeal, googleFont } from "@/lib/brandImage";

export const alt = "Kinproof: proof of person, not proof of voice";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const serif = await googleFont("Fraunces", 600);
  const fonts = serif ? [{ name: "Fraunces", data: serif, weight: 600 as const, style: "normal" as const }] : [];
  const family = serif ? "Fraunces" : "serif";
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: 1200, height: 630, background: "#f7f1e5", color: "#1e2a2b", padding: 72, fontFamily: family, position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 40, fontWeight: 600 }}>
            <BrandSeal size={56} />
            Kinproof
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 92, lineHeight: 1.04, fontWeight: 600, letterSpacing: -2 }}>Proof of person,</div>
            <div style={{ fontSize: 92, lineHeight: 1.04, fontWeight: 600, letterSpacing: -2, color: "#14594f" }}>not proof of voice.</div>
            <div style={{ marginTop: 28, fontSize: 32, color: "#55605d", maxWidth: 760, fontFamily: "sans-serif" }}>
              Before money leaves, the real family member confirms on their own phone.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 330, opacity: 0.95 }}>
          <div style={{ display: "flex", transform: "rotate(-6deg)" }}><BrandSeal size={300} /></div>
        </div>
        <div style={{ position: "absolute", left: 72, bottom: 40, display: "flex", fontSize: 22, color: "#55605d", fontFamily: "sans-serif" }}>Sandbox demo · no real money moves</div>
      </div>
    ),
    { ...size, fonts },
  );
}
