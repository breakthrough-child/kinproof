import { useId } from "react";
import { SEAL_EDGE as EDGE } from "@/lib/sealPath";
import { IconCheck, IconClock, IconPause, IconRedirect, IconX } from "./icons";

export type SealKind = "verified" | "released" | "held" | "blocked" | "expired" | "redirected";

const KINDS: Record<SealKind, { tone: string; label: string; Glyph: typeof IconCheck }> = {
  verified: { tone: "text-primary", label: "Verified", Glyph: IconCheck },
  released: { tone: "text-ok", label: "Sent", Glyph: IconCheck },
  held: { tone: "text-caution", label: "Held", Glyph: IconPause },
  blocked: { tone: "text-danger", label: "Blocked", Glyph: IconX },
  expired: { tone: "text-muted", label: "Expired", Glyph: IconClock },
  redirected: { tone: "text-primary", label: "Redirected", Glyph: IconRedirect },
};

/**
 * The Kinproof seal: the "proof" in Kinproof. Used for every verified/held/blocked moment.
 * `stamp` plays the landing animation once (disabled by prefers-reduced-motion).
 * Never relies on color alone: it has a glyph and an accessible name.
 */
export function Seal({ kind, size = 72, stamp = false, label, className = "" }: { kind: SealKind; size?: number; stamp?: boolean; label?: string; className?: string }) {
  const { tone, label: defaultLabel, Glyph } = KINDS[kind];
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const showRing = size >= 64;
  return (
    <span role="img" aria-label={label ?? defaultLabel} className={`inline-block shrink-0 ${tone} ${stamp ? "stamp" : "seal-static"} ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
        <path d={EDGE} fill="currentColor" fillOpacity={0.11} stroke="currentColor" strokeWidth={1.4} />
        <circle cx={32} cy={32} r={showRing ? 21.5 : 24} fill="none" stroke="currentColor" strokeWidth={1} strokeOpacity={0.55} />
        {showRing && (
          <>
            <defs><path id={`ring${id}`} d="M32 32m-25.2 0a25.2 25.2 0 1 1 50.4 0a25.2 25.2 0 1 1-50.4 0" /></defs>
            <text fontSize={3.9} letterSpacing={0.4} fill="currentColor" fontWeight={700} style={{ fontFamily: "var(--font-sans)" }}>
              <textPath href={`#ring${id}`} startOffset="0" textLength={152} lengthAdjust="spacing">KINPROOF · PROOF OF PERSON · KINPROOF ·</textPath>
            </text>
          </>
        )}
        <Glyph size={showRing ? 22 : 30} x={showRing ? 21 : 17} y={showRing ? 21 : 17} strokeWidth={2.2} />
      </svg>
    </span>
  );
}
