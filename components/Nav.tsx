"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "./ui";
import { IconBuilding, IconInbox, IconSend, IconSliders, IconUsers } from "./icons";

const links = [
  { href: "/send", label: "Send", long: "Send money", Icon: IconSend },
  { href: "/inbox", label: "Inbox", long: "Inbox", Icon: IconInbox },
  { href: "/circle", label: "Circle", long: "My circle", Icon: IconUsers },
  { href: "/institutions", label: "Payees", long: "Verified payees", Icon: IconBuilding },
  { href: "/settings", label: "Settings", long: "Settings", Icon: IconSliders },
];

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5 font-serif text-[1.35rem] font-semibold tracking-tight">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="text-primary">
        <path d="M32 3.5c3.6 0 5.6 2.6 8.8 3.8 3.2 1.2 6.6.3 9.1 2.8s1.6 5.9 2.8 9.1c1.2 3.2 3.8 5.2 3.8 8.8s-2.6 5.6-3.8 8.8c-1.2 3.2-.3 6.6-2.8 9.1s-5.9 1.6-9.1 2.8c-3.2 1.2-5.2 3.8-8.8 3.8s-5.6-2.6-8.8-3.8c-3.2-1.2-6.6-.3-9.1-2.8s-1.6-5.9-2.8-9.1C10.1 37.6 7.5 35.6 7.5 32s2.6-5.6 3.8-8.8c1.2-3.2.3-6.6 2.8-9.1s5.9-1.6 9.1-2.8C26.4 6.1 28.4 3.5 32 3.5z" fill="currentColor" />
        <path d="M21 33l8 8 14-16" fill="none" stroke="var(--primary-ink)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Kinproof
    </span>
  );
}

export function Nav({ name }: { name: string | null }) {
  const path = usePathname();
  const router = useRouter();
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  const active = (href: string) => path.startsWith(href);
  return (
    <>
      <header className="pt-safe border-b border-line bg-surface/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-x-6 px-4 py-2.5">
          <Link href="/" aria-label="Kinproof home" className="rounded-lg"><Logo /></Link>
          {name ? (
            <>
              <nav aria-label="Main" className="hidden gap-0.5 md:flex lg:gap-1">
                {links.map((l) => (
                  <Link key={l.href} href={l.href} aria-label={l.long} title={l.long} aria-current={active(l.href) ? "page" : undefined}
                    className={`flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-2.5 font-medium lg:px-3 ${active(l.href) ? "bg-primarysoft text-primary" : "text-muted hover:bg-surface2 hover:text-ink"}`}>
                    <l.Icon size={22} /><span className="hidden lg:inline">{l.long}</span>
                  </Link>
                ))}
              </nav>
              <div className="ml-auto flex items-center gap-2 text-sm">
                <Avatar name={name} size={34} className="md:max-lg:hidden" />
                <span className="hidden text-muted xl:inline">Signed in as <strong className="text-ink">{name}</strong></span>
                <button onClick={signOut} className="min-h-11 rounded-xl px-3 font-semibold text-primary hover:bg-primarysoft">Sign out</button>
              </div>
            </>
          ) : (
            <div className="ml-auto flex items-center gap-1">
              <Link href="/login" className="inline-flex min-h-11 items-center rounded-[14px] bg-primary px-5 font-semibold text-primaryink hover:brightness-110">Sign in</Link>
            </div>
          )}
        </div>
      </header>
      {name && (
        <nav aria-label="Main (mobile)" className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] border-t border-line bg-surface/95 backdrop-blur-sm md:hidden">
          <ul className="mx-auto grid max-w-lg grid-cols-5">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} aria-label={l.long} aria-current={active(l.href) ? "page" : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-[0.72rem] font-semibold leading-tight ${active(l.href) ? "text-primary" : "text-muted"}`}>
                  <span className={`grid h-7 w-12 place-items-center rounded-full ${active(l.href) ? "bg-primarysoft" : ""}`}><l.Icon size={22} /></span>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
