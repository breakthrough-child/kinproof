"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/send", label: "Send money" },
  { href: "/inbox", label: "Inbox" },
  { href: "/circle", label: "My circle" },
  { href: "/institutions", label: "Verified payees" },
  { href: "/settings", label: "Settings" },
];

export function Nav({ name }: { name: string | null }) {
  const path = usePathname();
  const router = useRouter();
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <span aria-hidden className="inline-block h-7 w-7 rounded-lg bg-primary" />
          Kinproof
        </Link>
        {name ? (
          <>
            <nav aria-label="Main" className="flex flex-wrap gap-1 text-base">
              {links.map((l) => (
                <Link key={l.href} href={l.href} aria-current={path.startsWith(l.href) ? "page" : undefined}
                  className={`rounded-lg px-3 py-2 font-medium ${path.startsWith(l.href) ? "bg-primarysoft text-primary" : "text-muted hover:bg-surface2"}`}>
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="text-muted">Signed in as <strong className="text-ink">{name}</strong></span>
              <button onClick={signOut} className="rounded-lg px-3 py-2 font-semibold text-primary hover:bg-primarysoft">Sign out</button>
            </div>
          </>
        ) : (
          <Link href="/login" className="ml-auto rounded-xl bg-primary px-4 py-2 font-semibold text-primaryink">Sign in</Link>
        )}
      </div>
    </header>
  );
}
