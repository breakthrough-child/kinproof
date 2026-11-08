import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentType, ReactNode, SVGProps } from "react";

type Tone = "caution" | "danger" | "ok" | "primary";

export function Card({ children, className = "", tone }: { children: ReactNode; className?: string; tone?: Tone }) {
  const t = tone === "caution" ? "bg-cautionsoft border-caution/35" : tone === "danger" ? "bg-dangersoft border-danger/35" : tone === "ok" ? "bg-oksoft border-ok/35" : tone === "primary" ? "bg-primarysoft border-primary/35" : "bg-surface border-line";
  return <section className={`rounded-[18px] border p-5 shadow-card sm:p-6 ${t} ${className}`}>{children}</section>;
}

type Variant = "primary" | "secondary" | "danger" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-primaryink hover:brightness-110 active:brightness-95",
  secondary: "bg-surface border border-line text-ink hover:bg-surface2",
  danger: "bg-danger text-dangerink hover:brightness-110 active:brightness-95",
  ghost: "text-primary hover:bg-primarysoft",
};
const base = "inline-flex items-center justify-center gap-2 rounded-[14px] px-5 min-h-12 text-base font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export function Button({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...p} className={`${base} ${variants[variant]} ${className}`} />;
}
export function LinkButton({ href, variant = "primary", children, className = "" }: { href: string; variant?: Variant; children: ReactNode; className?: string }) {
  return <Link href={href} className={`${base} ${variants[variant]} ${className}`}>{children}</Link>;
}

const badgeTone = { neutral: "bg-surface2 text-muted", ok: "bg-oksoft text-ok", caution: "bg-cautionsoft text-caution", danger: "bg-dangersoft text-danger", primary: "bg-primarysoft text-primary" };
/** A small status label. Always a word, optionally with an icon, so colour is never the only signal. */
export function Badge({ children, tone = "neutral", icon: Icon }: { children: ReactNode; tone?: keyof typeof badgeTone; icon?: ComponentType<SVGProps<SVGSVGElement> & { size?: number }> }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${badgeTone[tone]}`}>
      {Icon && <Icon size={16} />}
      {children}
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-base font-semibold">{label}</span>
      {hint && <span className="mb-2 block text-sm text-muted">{hint}</span>}
      {children}
    </label>
  );
}
export const inputCls = "w-full rounded-[14px] border border-line bg-surface px-4 min-h-12 text-base text-ink placeholder:text-muted/70 hover:border-muted/60";

export function Money({ amount, currency = "USD" }: { amount: number | string; currency?: string }) {
  return <span>{currency === "USD" ? "$" : ""}{Number(amount).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}{currency !== "USD" ? ` ${currency}` : ""}</span>;
}

export function riskTone(level: string): "ok" | "caution" | "danger" {
  return level === "high" ? "danger" : level === "medium" ? "caution" : "ok";
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-6">
      {eyebrow && <p className="mb-1 text-sm font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>}
      <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
      {children && <p className="mt-2 max-w-2xl text-lg text-muted">{children}</p>}
    </header>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[18px] border border-dashed border-line bg-surface/60 p-6 sm:flex-row sm:items-center sm:gap-5">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primarysoft text-primary"><Icon size={28} /></span>
      <div className="min-w-0 flex-1">
        <p className="font-serif text-xl font-semibold">{title}</p>
        <p className="mt-1 text-muted">{children}</p>
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

const AVATAR_TONES = ["bg-primarysoft text-primary", "bg-cautionsoft text-caution", "bg-dangersoft text-danger", "bg-oksoft text-ok"];
/** Initial in a soft circle. Colour is derived from the name so each family member keeps their own. */
export function Avatar({ name, size = 44, className = "" }: { name: string; size?: number; className?: string }) {
  const tone = AVATAR_TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span aria-hidden="true" className={`inline-grid shrink-0 place-items-center rounded-full border border-current/20 font-serif font-semibold ${tone} ${className}`} style={{ width: size, height: size, fontSize: size * 0.46 }}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
