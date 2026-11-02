"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Field, inputCls } from "@/components/ui";
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
    <div className="space-y-8">
      <h1 className="font-serif text-3xl font-bold">My circle</h1>
      {msg && <p role="status" className="rounded-xl bg-primarysoft p-3 text-primary">{msg}</p>}
      {circles.map(({ circle, members, myMemberId }) => (
        <Card key={circle.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-bold">{circle.name}</h2>
            <p className="text-muted">Invite code: <code className="rounded bg-surface2 px-2 py-1 font-mono text-ink">{circle.invite_code}</code></p>
          </div>
          <ul className="mt-4 divide-y divide-line">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold">{m.name} <span className="font-normal text-muted">· {m.label}{m.mine ? " (you)" : ""}</span></p>
                  {m.email && <p className="truncate text-sm text-muted">{m.email}</p>}
                </div>
                {m.verified ? <Badge tone="ok">PayPal verified</Badge> : <Badge tone="caution">PayPal not linked</Badge>}
                {m.mine && <Button variant={m.verified ? "secondary" : "primary"} disabled={busy} onClick={() => link(myMemberId)}>{m.verified ? "Re-link PayPal" : "Link PayPal"}</Button>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">Linking uses Log in with PayPal, so Kinproof knows each person&apos;s real PayPal account. Nobody can type in someone else&apos;s.</p>
        </Card>
      ))}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="text-xl font-bold">Start a circle</h2>
          <div className="mt-3 space-y-3">
            <Field label="Circle name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="The Okafors" /></Field>
            <Field label="What do they call you?" hint="e.g. Mum, Son, Auntie"><input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
            <Button disabled={busy || !name.trim()} onClick={() => act(() => post("/api/circle", { name, label: label || "Family" }))}>Create circle</Button>
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-bold">Join with an invite code</h2>
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
