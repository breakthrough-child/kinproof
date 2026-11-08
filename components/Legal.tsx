import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl">
      <p className="mb-1 text-sm font-bold uppercase tracking-[0.14em] text-primary">Kinproof</p>
      <h1 className="text-4xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted">Last updated {updated}</p>
      <div className="mt-6 space-y-5 text-lg [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-6 [&_a]:font-semibold [&_a]:text-primary [&_a]:underline">{children}</div>
    </article>
  );
}
