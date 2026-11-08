import type { ReactNode } from "react";

/** A plain phone frame used on the landing page to tell the story as screens. Decorative container. */
export function Phone({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) {
  return (
    <figure className={`mx-auto w-full max-w-[19rem] ${className}`}>
      <div className="rounded-[2.2rem] border-[7px] border-ink/85 bg-bg p-3 shadow-card">
        <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-ink/20" aria-hidden="true" />
        <div className="space-y-2.5">{children}</div>
      </div>
      <figcaption className="mt-2 text-center text-sm font-semibold text-muted">{label}</figcaption>
    </figure>
  );
}

/** A tiny voice-note waveform. Decorative. */
export function Waveform() {
  const bars = [6, 12, 9, 16, 11, 7, 14, 18, 10, 13, 8, 15, 11, 6, 12, 9, 16, 7];
  return (
    <svg width="104" height="22" viewBox="0 0 104 22" aria-hidden="true" className="shrink-0 text-ink/70">
      {bars.map((h, i) => <rect key={i} x={i * 5.8 + 1} y={11 - h / 2} width="3" height={h} rx="1.5" fill="currentColor" />)}
    </svg>
  );
}
