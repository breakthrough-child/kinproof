"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadScript } from "@paypal/paypal-js";
import { Badge, Button, Card, Field, inputCls, Money, riskTone, STATUS_LABEL } from "@/components/ui";
import { post, useLive } from "@/lib/useLive";
import type { getRequestView } from "@/lib/services/transfers";
import type { AiAnalysis } from "@/lib/types";

type VM = Awaited<ReturnType<typeof getRequestView>>;

const EVENT_LABEL: Record<string, string> = {
  request_created: "Request started",
  analyzed: "Kinproof checked the message",
  order_created: "PayPal payment prepared",
  authorized: "You approved it in PayPal. Money is on hold, not sent",
  auto_release: "Low risk to a verified account: sending now",
  held_no_confirmer: "Held: there is nobody in your circle to confirm with",
  confirmation_requested: "Asked the real person to confirm",
  confirmed: "The real person said: Yes, it was me",
  denied: "The real person said: No, that wasn't me",
  vouched: "Another family member vouched for it",
  captured: "Payment sent",
  voided: "Hold released, money returned to you",
  redirected: "Paying a verified organisation instead",
  override: "You chose to send after the cooling-off period",
  capture_failed: "PayPal couldn't complete the payment, money stays on hold",
  void_failed: "PayPal couldn't release the hold yet, will retry",
};

function Countdown({ to }: { to: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!to) return null;
  const ms = Math.max(0, new Date(to).getTime() - now);
  return <span className="tabular-nums">{Math.floor(ms / 60000)}:{String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}</span>;
}

function PayPalArea({ id, mode, clientId, onDone, onError }: { id: string; mode: "mock" | "sandbox"; clientId: string; onDone: () => void; onError: (m: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [sdkErr, setSdkErr] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "sandbox") return;
    let cancelled = false;
    loadScript({ clientId, intent: "authorize", currency: "USD", components: ["buttons"] })
      .then((paypal) => {
        if (cancelled || !paypal?.Buttons || !box.current) return;
        box.current.innerHTML = "";
        return paypal.Buttons({
          style: { layout: "vertical", shape: "pill", label: "pay" },
          createOrder: async () => {
            const r = await post<{ orderId?: string }>(`/api/requests/${id}/order`);
            if (!r.ok || !r.data.orderId) { onError(r.data.error ?? "Could not start PayPal."); throw new Error("order"); }
            return r.data.orderId;
          },
          onApprove: async () => {
            const r = await post(`/api/requests/${id}/authorize`);
            if (!r.ok) onError(r.data.error ?? "PayPal approval did not finish.");
            onDone();
          },
          onError: () => onError("PayPal had a problem. Nothing was charged. Please try again."),
        }).render(box.current);
      })
      .catch(() => setSdkErr("The PayPal button could not load. Check your connection and refresh."));
    return () => { cancelled = true; };
  }, [id, mode, clientId, onDone, onError]);

  async function simulate() {
    setBusy(true);
    const o = await post(`/api/requests/${id}/order`);
    if (!o.ok) { setBusy(false); return onError(o.data.error ?? "Could not start PayPal."); }
    const a = await post(`/api/requests/${id}/authorize`);
    setBusy(false);
    if (!a.ok) onError(a.data.error ?? "PayPal approval did not finish.");
    onDone();
  }

  if (mode === "mock") {
    return (
      <div>
        <Button onClick={simulate} disabled={busy} className="min-h-14 w-full text-lg">{busy ? "Approving…" : "Approve in PayPal (simulated)"}</Button>
        <p className="mt-2 text-sm text-muted">Development mode: no PayPal popup. Real PayPal Sandbox is used in the deployed demo.</p>
      </div>
    );
  }
  return (
    <div>
      <div ref={box} className="min-h-24" />
      {sdkErr && <p role="alert" className="text-danger">{sdkErr}</p>}
      <p className="mt-2 text-sm text-muted">In the PayPal window, sign in with your <strong>sandbox buyer account</strong>. You are only approving a hold. The money does not move yet.</p>
    </div>
  );
}

export function RequestView({ id, paypalMode, paypalClientId, ngnRate }: { id: string; paypalMode: "mock" | "sandbox"; paypalClientId: string; ngnRate: number }) {
  const router = useRouter();
  const { data, error, reload } = useLive<VM>(`/api/requests/${id}`);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [vouchNote, setVouchNote] = useState("");
  const [vouchMethod, setVouchMethod] = useState("called_known_number");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  if (!data) return <p role="status" className="text-lg text-muted">{error ?? "Loading…"}</p>;
  const { request: r, events, institution, members } = data;
  const ai = r.ai_analysis as AiAnalysis | null;
  const sender = members.find((m) => m.id === r.sender_member_id);
  const claimedName = r.claimed_requester_name ?? "someone";
  const status = r.status;
  const terminal = ["released", "blocked", "expired", "redirected"].includes(status);

  async function act(url: string, body?: unknown, then?: (d: Record<string, unknown>) => void) {
    setBusy(true); setErr(null);
    const res = await post(url, body);
    setBusy(false);
    if (!res.ok) setErr(res.data.error ?? "Something went wrong.");
    else then?.(res.data as Record<string, unknown>);
    reload();
  }

  const redirectedTo = events.find((e) => e.type === "redirected")?.payload?.to_request as string | undefined;
  const coolingLeft = r.override_available_at ? new Date(r.override_available_at).getTime() - now : 0;
  const tone = status === "released" ? "ok" : status === "blocked" || status === "expired" ? "primary" : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Payment request</p>
        <h1 className="font-serif text-3xl font-bold">
          <Money amount={r.amount} currency={r.currency} /> to {institution ? institution.name : r.payee_email}
        </h1>
        <p className="mt-1 text-muted">≈ ₦{Math.round(Number(r.amount) * ngnRate).toLocaleString("en-NG")} (approximate) · asked by {claimedName}{sender ? ` · sent by ${sender.display_name}` : ""}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={terminal ? (status === "released" ? "ok" : "primary") : "caution"}>{STATUS_LABEL[status]}</Badge>
          <Badge tone={riskTone(r.risk_level)}>{r.risk_level === "low" ? "Looks normal" : r.risk_level === "medium" ? "Some warning signs" : "Strong warning signs"}</Badge>
          {institution && <Badge tone="ok">Verified payee</Badge>}
        </div>
      </div>

      {err && <p role="alert" className="rounded-xl bg-dangersoft p-3 text-danger">{err}</p>}

      {/* Outcome banner */}
      {status === "released" && <Card tone="ok"><p className="text-xl font-bold">The payment was sent.</p><p className="mt-1">It arrives in the recipient&apos;s PayPal account within seconds.</p></Card>}
      {status === "blocked" && <Card tone="primary"><p className="text-xl font-bold">We stopped this payment and your money is back.</p><p className="mt-1">The hold on your PayPal was released. Nothing was taken.</p></Card>}
      {status === "expired" && <Card tone="primary"><p className="text-xl font-bold">Nobody confirmed in time, so your money was returned.</p><p className="mt-1">You can start again if you reach the real person another way.</p></Card>}
      {status === "redirected" && <Card tone="primary"><p className="text-xl font-bold">This hold was released. You chose to pay a verified organisation directly.</p>{redirectedTo && <Link className="mt-2 inline-block font-semibold text-primary underline" href={`/requests/${redirectedTo}`}>See that payment</Link>}</Card>}

      {/* Explanation */}
      {ai && (
        <Card tone={r.risk_level === "high" ? "caution" : undefined}>
          <h2 className="text-xl font-bold">What Kinproof found</h2>
          <p className="mt-2 text-lg">{ai.sender_explanation}</p>
          {ai.fallback && <p className="mt-2 text-sm text-muted">The AI check was unavailable, so this is based on our safety rules alone. We never send money automatically in that case.</p>}
          {(ai.signals.length > 0 || r.rule_signals.length > 0) && (
            <ul className="mt-4 space-y-3">
              {ai.signals.map((s, i) => (
                <li key={`a${i}`} className="rounded-xl bg-surface p-3">
                  <p className="font-semibold capitalize">{s.type.replace(/_/g, " ")}</p>
                  {s.quote && <p className="mt-1 text-base"><mark className="rounded bg-cautionsoft px-1 text-ink">&ldquo;{s.quote}&rdquo;</mark></p>}
                  <p className="mt-1 text-sm text-muted">{s.explanation}</p>
                </li>
              ))}
              {r.rule_signals.filter((s) => !ai.signals.some((a) => a.type === s.id)).map((s) => (
                <li key={s.id} className="rounded-xl bg-surface p-3">
                  <p className="font-semibold capitalize">{s.id.replace(/_/g, " ")}</p>
                  <p className="mt-1 text-sm text-muted">{s.evidence}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Sender actions */}
      {/* Stay mounted through awaiting_paypal_approval: createOrder moves the request there while the popup is open, and unmounting the buttons would kill it (and block retries). */}
      {data.isSender && (status === "analyzed" || status === "awaiting_paypal_approval") && (
        <Card>
          <h2 className="text-xl font-bold">{r.risk_level === "low" ? "Ready to send" : "Next: approve a hold in PayPal"}</h2>
          <p className="mb-4 mt-1 text-muted">{r.risk_level === "low" ? "This looks normal. After you approve in PayPal it will be sent." : "Your money will be held, not sent, until the real person confirms."}</p>
          <PayPalArea id={id} mode={paypalMode} clientId={paypalClientId} onDone={reload} onError={setErr} />
        </Card>
      )}

      {data.isSender && data.redirectOffer && data.institutionSuggestions.length > 0 && (
        <Card tone="primary">
          <h2 className="text-xl font-bold">Safer option: pay the organisation directly</h2>
          <p className="mb-3 mt-1">If you can&apos;t reach {claimedName}, pay the verified organisation instead. A scammer can&apos;t receive money this way, and a real emergency still gets paid.</p>
          <ul className="space-y-3">
            {data.institutionSuggestions.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface p-3">
                <div><p className="font-semibold">{i.name}</p><p className="text-sm text-muted capitalize">{i.kind.replace("_", " ")}{i.city ? ` · ${i.city}` : ""}</p></div>
                <Button disabled={busy} onClick={() => act(`/api/requests/${id}/redirect`, { institutionId: i.id }, (d) => router.push(`/requests/${d.nextRequestId}`))}>Pay {i.name.split(" ")[0]} {i.kind === "hospital" ? "Hospital" : ""} directly</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Waiting for the real person */}
      {status === "awaiting_confirmation" && (
        <Card tone="caution">
          <h2 className="text-xl font-bold">{data.isSender ? `We are asking ${claimedName} right now` : "Waiting for the real person to answer"}</h2>
          <p className="mt-2 text-lg">Your money is on hold. If {claimedName} says <strong>Yes</strong> it is sent in seconds. If they say <strong>No</strong>, or don&apos;t answer in <Countdown to={r.confirm_expires_at} />, it goes back to you.</p>
          {data.isSender && <Button variant="secondary" className="mt-4" disabled={busy} onClick={() => act(`/api/requests/${id}/cancel`)}>Cancel and get my money back</Button>}
        </Card>
      )}

      {/* Vouch (other circle members) */}
      {status === "awaiting_confirmation" && !data.isSender && !data.isAsked && r.claimed_requester_member_id !== data.me.id && (
        <Card>
          <h2 className="text-xl font-bold">Vouch for this request</h2>
          <p className="mt-1 text-muted">Only if you have personally checked that {claimedName} really asked. For example, you called a number you already had, or you met them.</p>
          <div className="mt-3 space-y-3">
            <Field label="How did you check?">
              <select className={inputCls} value={vouchMethod} onChange={(e) => setVouchMethod(e.target.value)}>
                <option value="called_known_number">I called a number I already knew</option>
                <option value="in_person">I met them in person</option>
                <option value="other">Another way</option>
              </select>
            </Field>
            <Field label="What did you do?"><input className={inputCls} value={vouchNote} onChange={(e) => setVouchNote(e.target.value)} /></Field>
            <Button disabled={busy || vouchNote.trim().length < 3} onClick={() => act(`/api/requests/${id}/vouch`, { method: vouchMethod, note: vouchNote })}>I vouch for this</Button>
          </div>
        </Card>
      )}

      {/* Outside the circle: cooling off + override */}
      {data.overrideRequired && data.isSender && (
        <Card tone="caution">
          <h2 className="text-xl font-bold">There is nobody to confirm with</h2>
          <p className="mt-2 text-lg">Because {claimedName} isn&apos;t in your circle, we can&apos;t check with them. Your money stays on hold for a short cooling-off period.</p>
          {coolingLeft > 0 ? (
            <p className="mt-3 text-lg font-semibold">You can decide in <Countdown to={r.override_available_at} />. Take the time to talk to someone you trust.</p>
          ) : (
            <div className="mt-4 space-y-3">
              <Field label="To send anyway, type this sentence exactly" hint={data.overridePhrase}>
                <input className={inputCls} value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" />
              </Field>
              <Button variant="danger" disabled={busy || phrase.trim() !== data.overridePhrase} onClick={() => act(`/api/requests/${id}/override`, { phrase })}>Send anyway</Button>
            </div>
          )}
          <div className="mt-4"><Button variant="secondary" disabled={busy} onClick={() => act(`/api/requests/${id}/cancel`)}>Cancel and get my money back</Button></div>
        </Card>
      )}

      {terminal && data.isSender && status !== "released" && status !== "redirected" && <Link href="/send" className="inline-block text-lg font-semibold text-primary underline">Start a new request</Link>}

      {/* Timeline */}
      <Card tone={tone}>
        <h2 className="text-xl font-bold">What happened</h2>
        <ol className="mt-3 space-y-3 border-l-2 border-line pl-5">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span aria-hidden className="absolute -left-[1.6rem] top-2 h-3 w-3 rounded-full bg-primary" />
              <p className="text-base font-medium">{EVENT_LABEL[e.type] ?? e.type.replace(/_/g, " ")}</p>
              <p className="text-sm text-muted">{new Date(e.created_at).toLocaleTimeString()}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
