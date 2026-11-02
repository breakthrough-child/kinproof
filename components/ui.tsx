import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({ children, className = "", tone }: { children: ReactNode; className?: string; tone?: "caution" | "danger" | "ok" | "primary" }) {
  const t = tone === "caution" ? "bg-cautionsoft border-caution/30" : tone === "danger" ? "bg-dangersoft border-danger/30" : tone === "ok" ? "bg-oksoft border-ok/30" : tone === "primary" ? "bg-primarysoft border-primary/30" : "bg-surface border-line";
  return <section className={`rounded-2xl border p-5 sm:p-6 ${t} ${className}`}>{children}</section>;
}

type Variant = "primary" | "secondary" | "danger" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-primaryink hover:opacity-90",
  secondary: "bg-surface border border-line text-ink hover:bg-surface2",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "text-primary hover:bg-primarysoft",
};
const base = "inline-flex items-center justify-center gap-2 rounded-xl px-5 min-h-12 text-base font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed";

export function Button({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...p} className={`${base} ${variants[variant]} ${className}`} />;
}
export function LinkButton({ href, variant = "primary", children, className = "" }: { href: string; variant?: Variant; children: ReactNode; className?: string }) {
  return <Link href={href} className={`${base} ${variants[variant]} ${className}`}>{children}</Link>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" | "caution" | "danger" | "primary" }) {
  const t = { neutral: "bg-surface2 text-muted", ok: "bg-oksoft text-ok", caution: "bg-cautionsoft text-caution", danger: "bg-dangersoft text-danger", primary: "bg-primarysoft text-primary" }[tone];
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${t}`}>{children}</span>;
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
export const inputCls = "w-full rounded-xl border border-line bg-surface px-4 min-h-12 text-base text-ink placeholder:text-muted/70";

export function Money({ amount, currency = "USD" }: { amount: number | string; currency?: string }) {
  return <span>{currency === "USD" ? "$" : ""}{Number(amount).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}{currency !== "USD" ? ` ${currency}` : ""}</span>;
}

export function riskTone(level: string): "ok" | "caution" | "danger" {
  return level === "high" ? "danger" : level === "medium" ? "caution" : "ok";
}
export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", analyzed: "Checked", awaiting_paypal_approval: "Waiting for your PayPal approval", held: "Money on hold",
  awaiting_confirmation: "Waiting for the real person", released: "Sent", blocked: "Stopped, money returned", expired: "Expired, money returned", redirected: "Paid someone safer instead",
};
