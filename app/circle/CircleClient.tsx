"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Badge, Button, Card, EmptyState, Field, inputCls, PageHeader } from "@/components/ui";
import { Seal } from "@/components/Seal";
import { IconAlert, IconCheck, IconLink, IconUsers } from "@/components/icons";
import { post } from "@/lib/useLive";

type CircleVM = {
  circle: { id: string; name: string; invite_code: string };
  myMemberId: string;
  members: { id: string; name: string; label: string; role: string; verified: boolean; email: string | null; mine: boolean }[];
};

export function CircleClient({ circles, linkResult }: { circles: CircleVM[]; linkResult: string | null }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(
    linkResult === "ok" ? "PayPal linked and verified." : linkResult === "unverified" ? "That PayPal email isn't verified yet." : linkResult === "failed" ? "We couldn't link PayPal. Please try again." : null,
  );
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");

  async function act(fn: () => Promise<{ ok: boolean; data: { error?: string } }>) {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) setMsg(r.data.error ?? "Something went wrong.");
    else { setMsg(null); router.refresh(); }
  }
  async function link(memberId: string) {
    setBusy(true);
    const r = await post<{ url?: string; linked?: boolean }>("/api/paypal/link", { memberId });
    setBusy(false);
    if (!r.ok) return setMsg(r.data.error ?? "Could not start PayPal linking.");
    if (r.data.url) window.location.assign(r.data.url);
    else { setMsg("PayPal linked (simulated)."); router.refresh(); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow="The people who can vouch for each other" title="My circle">Each person links their own PayPal, so Kinproof knows who is real. Nobody can type in someone else&apos;s.</PageHeader>
      {msg && <p role="status" className="flex gap-2.5 rounded-[14px] bg-primarysoft p-3.5 font-medium text-primary"><IconCheck size={22} className="mt-0.5 shrink-0" />{msg}</p>}
      {circles.length === 0 && <EmptyState icon={IconUsers} title="You aren’t in a circle yet.">Start one for your family, or join with the invite code someone sent you.</EmptyState>}
      {circles.map(({ circle, members, myMemberId }) => (
        <Card key={circle.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-3xl font-semibold">{circle.name}</h2>
            <p className="text-muted">Invite code <code className="ml-1 rounded-lg bg-surface2 px-2.5 py-1 font-mono text-base tracking-widest text-ink">{circle.invite_code}</code></p>
          </div>
          <ul className="mt-4 divide-y divide-line">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
                <Avatar name={m.name} size={52} />
                <div className="min-w-0 flex-1 basis-40">
                  <p className="text-lg font-semibold">{m.name} <span className="font-normal text-muted">· {m.label}{m.mine ? " (you)" : ""}</span></p>
                  {m.email && <p className="truncate text-sm text-muted">{m.email}</p>}
                </div>
                {m.verified ? (
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-ok"><Seal kind="verified" size={34} label="" className="text-ok" />PayPal verified</span>
                ) : <Badge tone="caution" icon={IconAlert}>PayPal not linked</Badge>}
                {m.mine && <Button variant={m.verified ? "secondary" : "primary"} disabled={busy} onClick={() => link(myMemberId)}><IconLink size={20} />{m.verified ? "Re-link PayPal" : "Link PayPal"}</Button>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">Linking uses Log in with PayPal, so Kinproof knows each person&apos;s real PayPal account.</p>
        </Card>
      ))}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="text-2xl font-semibold">Start a circle</h2>
          <div className="mt-3 space-y-3">
            <Field label="Circle name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="The Okafors" /></Field>
            <Field label="What do they call you?" hint="e.g. Mum, Son, Auntie"><input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
            <Button disabled={busy || !name.trim()} onClick={() => act(() => post("/api/circle", { name, label: label || "Family" }))}>Create circle</Button>
          </div>
        </Card>
        <Card>
          <h2 className="text-2xl font-semibold">Join with an invite code</h2>
          <div className="mt-3 space-y-3">
            <Field label="Invite code"><input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
            <Field label="What do they call you?"><input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
            <Button variant="secondary" disabled={busy || !code.trim()} onClick={() => act(() => post("/api/circle/join", { code, label: label || "Family" }))}>Join circle</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
