"use client";
import Link from "next/link";
import { Badge, Card, LinkButton, Money } from "@/components/ui";
import { useLive } from "@/lib/useLive";
import type { Confirmation, TransferRequest } from "@/lib/types";

type Inbox = {
  items: { confirmation: Confirmation; request: TransferRequest; senderName: string }[];
  vouchable: { request: TransferRequest; senderName: string }[];
};
type Mine = { requests: TransferRequest[] };

export function InboxClient() {
  const inbox = useLive<Inbox>("/api/inbox", { pollMs: 2500 });
  const mine = useLive<Mine>("/api/requests", { pollMs: 4000 });
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl font-bold">Inbox</h1>

      <section aria-labelledby="ask">
        <h2 id="ask" className="mb-3 text-xl font-bold">Needs your answer</h2>
        {inbox.data?.items.length ? (
          <p className="rounded-xl bg-cautionsoft p-3 font-semibold text-caution">Someone is waiting for you. Please answer the card on your screen.</p>
        ) : (
          <Card><p className="text-lg text-muted">Nothing is waiting for you. You&apos;ll see a full-screen card here the moment someone needs you to confirm a payment.</p></Card>
        )}
      </section>

      {!!inbox.data?.vouchable.length && (
        <section aria-labelledby="vouch">
          <h2 id="vouch" className="mb-3 text-xl font-bold">You can vouch</h2>
          <ul className="space-y-3">
            {inbox.data.vouchable.map(({ request: r, senderName }) => (
              <li key={r.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-lg"><strong>{senderName}</strong> is paying <Money amount={r.amount} /> on behalf of {r.claimed_requester_name ?? "someone"}. If you have personally checked it&apos;s real, you can vouch.</p>
                  <LinkButton href={`/requests/${r.id}`} variant="secondary">Review</LinkButton>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="recent">
        <h2 id="recent" className="mb-3 text-xl font-bold">Recent payment requests</h2>
        {mine.data?.requests.length ? (
          <ul className="space-y-3">
            {mine.data.requests.map((r) => (
              <li key={r.id}>
                <Link href={`/requests/${r.id}`} className="block rounded-2xl border border-line bg-surface p-4 hover:bg-surface2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-lg font-semibold"><Money amount={r.amount} /> · {r.claimed_requester_name ?? "Someone"}</p>
                    <Badge tone={r.status === "released" ? "ok" : r.status === "blocked" || r.status === "expired" ? "primary" : "caution"}>{r.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">{new Date(r.created_at).toLocaleString()}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-muted">No payment requests yet. <Link className="font-semibold text-primary underline" href="/send">Send money safely</Link>.</p>}
      </section>
    </div>
  );
}
