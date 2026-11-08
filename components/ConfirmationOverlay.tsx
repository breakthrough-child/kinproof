"use client";
import { useEffect, useRef, useState } from "react";
import { post, useLive } from "@/lib/useLive";
import { closeAudioContext, createAudioContext, documentHidden, playBeep, showSystemNotification, vibrate } from "@/lib/browser";
import type { AiAnalysis, Confirmation, TransferRequest } from "@/lib/types";
import { Avatar, Button, Money } from "./ui";
import { Seal } from "./Seal";
import { IconCheck, IconX } from "./icons";

type Inbox = { items: { confirmation: Confirmation; request: TransferRequest; senderName: string }[] };

export function ConfirmationOverlay() {
  const { data, reload } = useLive<Inbox>("/api/inbox", { pollMs: 2500, tables: ["confirmations", "transfer_requests"] });
  const item = data?.items?.[0] ?? null;
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | "confirmed" | "denied">(null);
  const [err, setErr] = useState<string | null>(null);
  const notified = useRef<string | null>(null);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Sound, vibration and a system notification when a new request arrives.
  // Every browser API here is optional: if any is missing or blocked the on-screen card still shows.
  const id = item?.request.id ?? null;
  const senderName = item?.senderName;
  useEffect(() => {
    if (!id || notified.current === id) return;
    notified.current = id;
    vibrate([200, 100, 200, 100, 400]);
    audio.current ??= createAudioContext();
    playBeep(audio.current);
    const rep = setInterval(() => playBeep(audio.current), 4000);
    const stop = setTimeout(() => clearInterval(rep), 20000);
    if (documentHidden()) {
      void showSystemNotification("Kinproof: please confirm", { body: `${senderName ?? "Someone"} is sending money in your name. Was it you?`, tag: id });
    }
    return () => {
      clearInterval(rep);
      clearTimeout(stop);
    };
  }, [id, senderName]);

  useEffect(() => () => closeAudioContext(audio.current), []);

  if (!item && !result) return null;

  if (result && !item) {
    const yes = result === "confirmed";
    return (
      <div role="status" className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4 sm:p-6">
        <div className="sheet-up w-full max-w-md rounded-[24px] bg-surface p-8 text-center shadow-2xl">
          <div className="flex justify-center"><Seal kind={yes ? "released" : "blocked"} size={128} stamp /></div>
          <p className="mt-5 font-serif text-2xl font-semibold">{yes ? "Thank you. The money is on its way." : "Thank you. The payment was stopped and the money was returned."}</p>
          <Button className="mt-6 min-h-14 w-full text-lg" variant="secondary" onClick={() => setResult(null)}>Close</Button>
        </div>
      </div>
    );
  }
  if (!item) return null;

  const { request: r } = item;
  const ai = r.ai_analysis as AiAnalysis | null;
  const msLeft = r.confirm_expires_at ? new Date(r.confirm_expires_at).getTime() - now : 0;
  const mm = Math.max(0, Math.floor(msLeft / 60000));
  const ss = Math.max(0, Math.floor((msLeft % 60000) / 1000));
  const frac = Math.max(0, Math.min(1, msLeft / (15 * 60000)));
  const question = ai?.confirmation_question || `Did you just ask ${item.senderName} for money?`;
  const text = [r.raw_message, r.transcript].filter(Boolean).join("\n\n");

  async function answer(a: "confirmed" | "denied") {
    setBusy(true);
    setErr(null);
    const res = await post(`/api/requests/${r.id}/respond`, { answer: a });
    setBusy(false);
    if (!res.ok) setErr(res.data.error ?? "Something went wrong.");
    else setResult(a);
    reload();
  }

  const R = 22;
  const C = 2 * Math.PI * R;
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="conf-title" aria-describedby="conf-q"
      className="fixed inset-0 z-50 flex h-dvh flex-col bg-bg sm:items-center sm:justify-center sm:bg-ink/70 sm:p-6">
      <div className="sheet-up flex min-h-0 w-full flex-1 flex-col bg-bg sm:max-w-xl sm:flex-none sm:overflow-hidden sm:rounded-[28px] sm:shadow-2xl sm:max-h-[92dvh]">
        {/* Scrollable story: who, how much, what was said */}
        <div className="pt-safe min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-5 sm:px-8 sm:pt-8">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-caution">
            <span className="holding inline-block h-2.5 w-2.5 rounded-full bg-caution" />Money on hold · this needs you
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Avatar name={item.senderName} size={52} />
            <h2 id="conf-title" className="text-2xl font-semibold leading-tight">{item.senderName} is sending <Money amount={r.amount} /> in your name</h2>
          </div>
          <p id="conf-q" className="mt-5 font-serif text-[1.65rem] font-semibold leading-snug sm:text-3xl">{question}</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 rounded-[16px] border border-line bg-surface p-4">
            <div><dt className="text-sm text-muted">Amount</dt><dd className="font-serif text-3xl font-semibold tabular-nums"><Money amount={r.amount} currency={r.currency} /></dd></div>
            <div className="min-w-0"><dt className="text-sm text-muted">To</dt><dd className="break-all text-base font-semibold">{r.payee_email}</dd></div>
          </dl>
          {text && (
            <figure className="mt-3 rounded-[16px] border border-line bg-surface p-4">
              <figcaption className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">What the message said</figcaption>
              <p className="whitespace-pre-wrap text-base leading-relaxed">{text}</p>
            </figure>
          )}
          <div className="mt-4 flex items-center gap-3">
            <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true" className="shrink-0 -rotate-90 text-caution">
              <circle cx="26" cy="26" r={R} fill="none" stroke="var(--line)" strokeWidth="4" />
              <circle cx="26" cy="26" r={R} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: "stroke-dashoffset 1s linear" }} />
            </svg>
            <p className="text-base text-muted" aria-live="off">
              <strong className="text-xl tabular-nums text-ink">{mm}:{String(ss).padStart(2, "0")}</strong> left to answer. If you don&apos;t, the money goes back automatically.
            </p>
          </div>
          {err && <p role="alert" className="mt-3 rounded-[14px] bg-dangersoft p-3 font-medium text-danger">{err}</p>}
        </div>

        {/* Thumb zone: two huge buttons at the bottom of the screen, safe-area aware */}
        <div className="pb-safe shrink-0 border-t border-line bg-surface px-5 pb-4 pt-4 sm:px-8 sm:pb-8">
          <div className="grid gap-3">
            <Button disabled={busy} onClick={() => answer("confirmed")} className="min-h-[4.5rem] text-xl"><IconCheck size={26} />Yes, it was me</Button>
            <Button disabled={busy} variant="danger" onClick={() => answer("denied")} className="min-h-[4.5rem] text-xl"><IconX size={26} />No, that wasn&apos;t me</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
