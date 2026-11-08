"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadScript } from "@paypal/paypal-js";
import { Badge, Button, Card, Field, inputCls, Money, riskTone, Skeleton } from "@/components/ui";
import { Seal, type SealKind } from "@/components/Seal";
import { IconAlert, IconCheck, IconClock, IconLock, IconRedirect, IconShield, IconX } from "@/components/icons";
import { post, useLive } from "@/lib/useLive";
import { eventLabel, possessive, statusLabel, type Viewer } from "@/lib/wording";
import type { getRequestView } from "@/lib/services/transfers";
import type { AiAnalysis } from "@/lib/types";

type VM = Awaited<ReturnType<typeof getRequestView>>;

const norm = (t: string) => t.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');

/** The original message with each flagged quote highlighted in place, so the evidence is read where it was said. */
function HighlightedMessage({ text, quotes }: { text: string; quotes: string[] }) {
  const hay = norm(text).toLowerCase();
  const ranges: [number, number][] = [];
  for (const q of quotes) {
    const needle = norm(q).trim().replace(/^["']|["']$/g, "").toLowerCase();
    if (needle.length < 3) continue;
    const i = hay.indexOf(needle);
    if (i >= 0) ranges.push([i, i + needle.length]);
  }
  ranges.sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const l = merged[merged.length - 1];
    if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]);
    else merged.push([...r]);
  }
  const out: React.ReactNode[] = [];
  let at = 0;
  merged.forEach(([from, to], i) => {
    if (from > at) out.push(text.slice(at, from));
    out.push(<mark key={i} className="quote">{text.slice(from, to)}</mark>);
    at = to;
  });
  if (at < text.length) out.push(text.slice(at));
  return <p className="whitespace-pre-wrap text-lg leading-relaxed">{out}</p>;
}

const STAGES = ["Checked", "On hold", "Real person confirms", "Paid"];
/** Where the request is on its way, as four plain steps. A blocked or expired request stops at step three, in words and an icon. */
function Stages({ status }: { status: string }) {
  const failed = status === "blocked" || status === "expired";
  const redirected = status === "redirected";
  const at = status === "released" ? 3 : failed || redirected ? 2 : status === "awaiting_confirmation" ? 2 : status === "held" ? 1 : 0;
  const labels = STAGES.map((l, i) => (i === 2 && failed ? (status === "blocked" ? "Blocked" : "Expired") : i === 2 && redirected ? "Redirected" : l));
  return (
    <ol aria-label="Progress" className="grid grid-cols-4 gap-1.5">
      {labels.map((l, i) => {
        const done = i < at || (status === "released" && i === 3);
        const current = i === at && status !== "released";
        const bad = i === 2 && failed;
        return (
          <li key={l} aria-current={current ? "step" : undefined} className="min-w-0">
            <div className={`h-1.5 rounded-full ${bad ? "bg-danger" : done || current ? (current && status !== "released" && !failed ? "bg-caution" : "bg-primary") : "bg-line"} ${current && !failed && !redirected ? "holding" : ""}`} />
            <p className={`mt-1.5 flex items-center gap-1 text-[0.8rem] leading-tight sm:text-sm ${current || bad ? "font-bold text-ink" : done ? "font-semibold text-primary" : "text-muted"}`}>
              {bad ? <IconX size={14} className="shrink-0 text-danger" /> : redirected && i === 2 ? <IconRedirect size={14} className="shrink-0" /> : done ? <IconCheck size={14} className="shrink-0" /> : current ? <IconClock size={14} className="shrink-0" /> : null}
              <span className="min-w-0">{l}</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}

const SEAL_FOR: Record<string, SealKind> = { released: "released", blocked: "blocked", expired: "expired", redirected: "redirected" };

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

  if (!data) {
    return (
      <div role="status" className="mx-auto max-w-3xl space-y-4">
        <span className="sr-only">{error ?? "Loading…"}</span>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-11 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }
  const { request: r, events, institution, members } = data;
  const ai = r.ai_analysis as AiAnalysis | null;
  const sender = members.find((m) => m.id === r.sender_member_id);
  const viewer: Viewer = { isSender: data.isSender, senderName: sender?.display_name ?? "Someone" };
  const claimedName = r.claimed_requester_name ?? "someone";
  const status = r.status;
  const terminal = ["released", "blocked", "expired", "redirected"].includes(status);
  const ownerPlain = viewer.isSender ? "you" : viewer.senderName;

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
  const messageText = [r.raw_message, r.transcript].filter(Boolean).join("\n\n");
  const quotes = ai?.signals.map((x) => x.quote).filter((q): q is string => !!q) ?? [];
  const verdict =
    r.risk_level === "high" ? { head: "Please don’t send this money.", body: "Several things in this request match known scams.", Icon: IconAlert, tone: "danger" as const }
    : r.risk_level === "medium" ? { head: "A few things don’t add up.", body: "Take a moment before anything is sent.", Icon: IconAlert, tone: "caution" as const }
    : { head: "This looks normal.", body: "Nothing in it matches the usual scam patterns.", Icon: IconShield, tone: "ok" as const };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="mb-1 text-sm font-bold uppercase tracking-[0.14em] text-primary">Payment request</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">
          <Money amount={r.amount} currency={r.currency} /> to {institution ? institution.name : <span className="break-all">{r.payee_email}</span>}
        </h1>
        <p className="mt-1.5 text-muted">≈ ₦{Math.round(Number(r.amount) * ngnRate).toLocaleString("en-NG")} (approximate) · asked by {claimedName}{sender ? ` · sent by ${sender.display_name}` : ""}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={terminal ? (status === "released" ? "ok" : "primary") : "caution"} icon={terminal ? (status === "released" ? IconCheck : status === "redirected" ? IconRedirect : IconX) : IconClock}>{statusLabel(status, viewer)}</Badge>
          <Badge tone={riskTone(r.risk_level)} icon={r.risk_level === "low" ? IconShield : IconAlert}>{r.risk_level === "low" ? "Looks normal" : r.risk_level === "medium" ? "Some warning signs" : "Strong warning signs"}</Badge>
          {institution && <Badge tone="ok" icon={IconLock}>Verified payee</Badge>}
        </div>
        <div className="mt-5"><Stages status={status} /></div>
      </div>

      {err && <p role="alert" className="flex gap-2.5 rounded-[14px] bg-dangersoft p-3.5 font-medium text-danger"><IconAlert size={22} className="mt-0.5 shrink-0" />{err}</p>}

      {/* The stamp lands: the outcome, in words and a seal */}
      {terminal && (
        <Card tone={status === "released" ? "ok" : "primary"} className="flex items-center gap-5">
          <Seal kind={SEAL_FOR[status]} size={104} stamp className="hidden sm:inline-block" />
          <Seal kind={SEAL_FOR[status]} size={72} stamp className="sm:hidden" />
          <div className="min-w-0">
            {status === "released" && <><p className="font-serif text-2xl font-semibold">The payment was sent.</p><p className="mt-1">It arrives in the recipient&apos;s PayPal account within seconds.</p></>}
            {status === "blocked" && <><p className="font-serif text-2xl font-semibold">{viewer.isSender ? "We stopped this payment and your money is back." : `We stopped this payment. ${possessive(viewer.senderName)} money is back.`}</p><p className="mt-1">The hold on the PayPal was released. Nothing was taken.</p></>}
            {status === "expired" && <><p className="font-serif text-2xl font-semibold">{viewer.isSender ? "Nobody confirmed in time, so your money was returned." : `Nobody confirmed in time, so ${possessive(viewer.senderName)} money was returned.`}</p><p className="mt-1">{viewer.isSender ? "You can start again if you reach the real person another way." : `${viewer.senderName} can start again if they reach the real person another way.`}</p></>}
            {status === "redirected" && <><p className="font-serif text-2xl font-semibold">{viewer.isSender ? "This hold was released. You chose to pay a verified organisation directly." : `This hold was released. ${viewer.senderName} chose to pay a verified organisation directly.`}</p>{redirectedTo && <Link className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4" href={`/requests/${redirectedTo}`}>See that payment</Link>}</>}
          </div>
        </Card>
      )}

      {/* The verdict, then the evidence in the words that were said */}
      {ai && (
        <Card tone={r.risk_level === "high" ? "danger" : r.risk_level === "medium" ? "caution" : undefined} className="space-y-5">
          <div className="flex items-start gap-4">
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${verdict.tone === "danger" ? "bg-danger text-dangerink" : verdict.tone === "caution" ? "bg-caution text-cautionsoft" : "bg-ok text-oksoft"}`}><verdict.Icon size={26} /></span>
            <div>
              <h2 className="text-2xl font-semibold sm:text-3xl">{verdict.head}</h2>
              <p className="mt-1 text-lg">{verdict.body}</p>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-xl font-semibold">What Kinproof found</h3>
            <p className="text-lg">{ai.sender_explanation}</p>
            {ai.fallback && <p className="mt-2 text-sm text-muted">The AI check was unavailable, so this is based on our safety rules alone. We never send money automatically in that case.</p>}
          </div>
          {messageText && (
            <figure className="rounded-[14px] border border-line bg-surface p-4">
              <figcaption className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">What was said{quotes.length ? " · flagged words marked" : ""}</figcaption>
              <HighlightedMessage text={messageText} quotes={quotes} />
            </figure>
          )}
          {(ai.signals.length > 0 || r.rule_signals.length > 0) && (
            <ul className="space-y-2.5">
              {ai.signals.map((sg, i) => (
                <li key={`a${i}`} className="rounded-[14px] bg-surface p-3.5">
                  <p className="font-semibold capitalize">{sg.type.replace(/_/g, " ")}</p>
                  {sg.quote && <p className="mt-1 text-base"><mark className="quote">&ldquo;{sg.quote}&rdquo;</mark></p>}
                  <p className="mt-1 text-base text-muted">{sg.explanation}</p>
                </li>
              ))}
              {r.rule_signals.filter((sg) => !ai.signals.some((a) => a.type === sg.id)).map((sg) => (
                <li key={sg.id} className="rounded-[14px] bg-surface p-3.5">
                  <p className="font-semibold capitalize">{sg.id.replace(/_/g, " ")}</p>
                  <p className="mt-1 text-base text-muted">{sg.evidence}</p>
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
          <h2 className="text-2xl font-semibold">{r.risk_level === "low" ? "Ready to send" : "Next: approve a hold in PayPal"}</h2>
          <p className="mb-4 mt-1 text-lg">
            {r.risk_level === "low" ? "This looks normal. After you approve in PayPal it will be sent." : <>Your money will be <strong>held, not sent</strong>, until the real person confirms. If they say no, it goes straight back to you.</>}
          </p>
          <PayPalArea id={id} mode={paypalMode} clientId={paypalClientId} onDone={reload} onError={setErr} />
        </Card>
      )}
      {!data.isSender && (status === "analyzed" || status === "awaiting_paypal_approval") && (
        <Card><p className="flex items-center gap-2.5 text-lg"><IconClock size={22} className="shrink-0 text-caution" />{statusLabel(status, viewer)}. Nothing has moved yet.</p></Card>
      )}

      {data.isSender && data.redirectOffer && data.institutionSuggestions.length > 0 && (
        <Card tone="primary">
          <h2 className="text-2xl font-semibold">Safer option: pay the organisation directly</h2>
          <p className="mb-3 mt-1 text-lg">If you can&apos;t reach {claimedName}, pay the verified organisation instead. A scammer can&apos;t receive money this way, and a real emergency still gets paid.</p>
          <ul className="space-y-3">
            {data.institutionSuggestions.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-surface p-3.5">
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
          <h2 className="text-2xl font-semibold">{data.isSender ? `We are asking ${claimedName} right now` : "Waiting for the real person to answer"}</h2>
          <p className="mt-2 text-lg">{viewer.isSender ? "Your" : `${possessive(viewer.senderName)}`} money is on hold. If {claimedName} says <strong>Yes</strong> it is sent in seconds. If they say <strong>No</strong>, or don&apos;t answer in <Countdown to={r.confirm_expires_at} />, it goes back to {ownerPlain}.</p>
          {data.isSender && <Button variant="secondary" className="mt-4" disabled={busy} onClick={() => act(`/api/requests/${id}/cancel`)}>Cancel and get my money back</Button>}
        </Card>
      )}

      {/* Vouch (other circle members) */}
      {status === "awaiting_confirmation" && !data.isSender && !data.isAsked && r.claimed_requester_member_id !== data.me.id && (
        <Card>
          <h2 className="text-2xl font-semibold">Vouch for this request</h2>
          <p className="mt-1 text-lg text-muted">Only if you have personally checked that {claimedName} really asked. For example, you called a number you already had, or you met them.</p>
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
          <h2 className="text-2xl font-semibold">There is nobody to confirm with</h2>
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

      {terminal && data.isSender && status !== "released" && status !== "redirected" && <Link href="/send" className="inline-flex min-h-12 items-center text-lg font-semibold text-primary underline underline-offset-4">Start a new request</Link>}

      {/* The story, ending in the stamp */}
      <Card>
        <h2 className="text-2xl font-semibold">What happened</h2>
        <ol className="mt-4 space-y-4 border-l-2 border-line pl-6">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span aria-hidden="true" className="absolute -left-[1.95rem] top-2 h-3 w-3 rounded-full border-2 border-surface bg-primary" />
              <p className="text-base font-medium">{eventLabel(e.type, viewer) ?? e.type.replace(/_/g, " ")}</p>
              <p className="text-sm text-muted">{new Date(e.created_at).toLocaleTimeString()}</p>
            </li>
          ))}
        </ol>
        {terminal && (
          <div className="mt-5 flex items-center gap-3 border-t border-line pt-5">
            <Seal kind={SEAL_FOR[status]} size={56} />
            <p className="font-serif text-lg font-semibold">{statusLabel(status, viewer)}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
