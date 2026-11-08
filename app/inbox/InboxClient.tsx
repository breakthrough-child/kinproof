"use client";
import Link from "next/link";
import { Avatar, Badge, Card, EmptyState, LinkButton, Money, PageHeader, Skeleton } from "@/components/ui";
import { IconAlert, IconCheck, IconClock, IconInbox, IconRedirect, IconSend, IconShield, IconX } from "@/components/icons";
import { useLive } from "@/lib/useLive";
import { statusLabel, subject } from "@/lib/wording";
import type { Confirmation, TransferRequest } from "@/lib/types";

type Inbox = {
  items: { confirmation: Confirmation; request: TransferRequest; senderName: string }[];
  vouchable: { request: TransferRequest; senderName: string }[];
  memberIds: string[];
};
type Mine = { requests: TransferRequest[]; senders: Record<string, { name: string; isMe: boolean }> };

export function InboxClient() {
  const inbox = useLive<Inbox>("/api/inbox", { pollMs: 2500 });
  const mine = useLive<Mine>("/api/requests", { pollMs: 4000 });
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <PageHeader eyebrow="Your family’s requests" title="Inbox">Anything that needs your answer comes first. Then the recent history of your circle.</PageHeader>

      <section aria-labelledby="ask">
        <h2 id="ask" className="mb-3 text-2xl font-semibold">Needs your answer</h2>
        {!inbox.data ? <Skeleton className="h-24 w-full" /> : inbox.data.items.length ? (
          <div role="status" className="flex items-center gap-3 rounded-[18px] border border-caution/40 bg-cautionsoft p-4 font-semibold text-caution">
            <IconAlert size={26} className="shrink-0" />
            <p>{inbox.data.items[0].senderName} is waiting for you. Please answer the card on your screen.</p>
          </div>
        ) : (
          <EmptyState icon={IconShield} title="Nothing is waiting for you.">
            That&apos;s the good kind of quiet. If someone ever asks for money in your name, a full-screen card appears here the moment it happens, with a button for Yes and a button for No.
          </EmptyState>
        )}
      </section>

      {!!inbox.data?.vouchable.length && (
        <section aria-labelledby="vouch">
          <h2 id="vouch" className="mb-3 text-2xl font-semibold">You can vouch</h2>
          <ul className="space-y-3">
            {inbox.data.vouchable.map(({ request: r, senderName }) => (
              <li key={r.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <p className="min-w-0 flex-1 text-lg"><strong>{senderName}</strong> is paying <Money amount={r.amount} /> on behalf of {r.claimed_requester_name ?? "someone"}. If you have personally checked it&apos;s real, you can vouch.</p>
                  <LinkButton href={`/requests/${r.id}`} variant="secondary">Review</LinkButton>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="recent">
        <h2 id="recent" className="mb-3 text-2xl font-semibold">Recent payment requests</h2>
        {!mine.data ? (
          <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
        ) : mine.data.requests.length ? (
          <ul className="space-y-3">
            {mine.data.requests.map((r) => {
              const s = mine.data!.senders[r.sender_member_id] ?? { name: "Someone", isMe: false };
              const viewer = { isSender: s.isMe, senderName: s.name };
              const done = r.status === "released";
              const stopped = r.status === "blocked" || r.status === "expired";
              return (
                <li key={r.id}>
                  <Link href={`/requests/${r.id}`} className="flex min-h-[4.5rem] items-center gap-3.5 rounded-[18px] border border-line bg-surface p-3.5 shadow-card hover:bg-surface2">
                    <Avatar name={s.name} size={46} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-semibold"><Money amount={r.amount} /> · asked by {r.claimed_requester_name ?? "someone"}</p>
                      <p className="truncate text-sm text-muted">{subject(viewer)} sent · {new Date(r.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
                    </div>
                    <Badge tone={done ? "ok" : stopped ? "primary" : "caution"} icon={done ? IconCheck : stopped ? IconX : r.status === "redirected" ? IconRedirect : IconClock}>{statusLabel(r.status, viewer)}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={IconInbox} title="No requests yet." action={<LinkButton href="/send"><IconSend size={20} />Send money safely</LinkButton>}>
            When someone in your family asks for money, or you check a request, the story of it will be kept here.
          </EmptyState>
        )}
      </section>
    </div>
  );
}
