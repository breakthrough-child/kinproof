"use client";
import { useEffect, useRef, useState } from "react";
import { post, useLive } from "@/lib/useLive";
import { closeAudioContext, createAudioContext, documentHidden, playBeep, showSystemNotification, vibrate } from "@/lib/browser";
import type { AiAnalysis, Confirmation, TransferRequest } from "@/lib/types";
import { Button, Money } from "./ui";

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
    return (
      <div role="status" className="fixed inset-x-0 bottom-0 z-50 p-4">
        <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-5 text-center shadow-xl">
          <p className="text-lg font-semibold">{result === "confirmed" ? "Thank you. The money is on its way." : "Thank you. The payment was stopped and the money was returned."}</p>
          <Button className="mt-3" variant="secondary" onClick={() => setResult(null)}>Close</Button>
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

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="conf-title" aria-describedby="conf-q"
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink/70 p-0 sm:items-center sm:p-6">
      <div className="w-full max-w-xl rounded-t-3xl bg-surface p-6 shadow-2xl sm:rounded-3xl">
        <p className="text-sm font-bold uppercase tracking-wide text-primary">Please check, this needs you</p>
        <h2 id="conf-title" className="mt-1 text-2xl font-bold">{item.senderName} is sending <Money amount={r.amount} /> in your name</h2>
        <p id="conf-q" className="mt-4 rounded-2xl bg-primarysoft p-4 text-xl font-semibold leading-snug text-ink">{question}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-base">
          <div><dt className="text-sm text-muted">Amount</dt><dd className="font-semibold"><Money amount={r.amount} currency={r.currency} /></dd></div>
          <div><dt className="text-sm text-muted">Paying</dt><dd className="break-all font-semibold">{r.payee_email}</dd></div>
        </dl>
        {text && (
          <details className="mt-3 rounded-xl border border-line p-3">
            <summary className="cursor-pointer font-semibold">What the message said</summary>
            <p className="mt-2 whitespace-pre-wrap text-base text-muted">{text}</p>
          </details>
        )}
        <p className="mt-4 text-center text-base text-muted" aria-live="off">
          Time left to answer: <strong className="tabular-nums text-ink">{mm}:{String(ss).padStart(2, "0")}</strong>. If you don&apos;t answer, the money goes back automatically.
        </p>
        {err && <p role="alert" className="mt-3 rounded-xl bg-dangersoft p-3 text-danger">{err}</p>}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button disabled={busy} onClick={() => answer("confirmed")} className="min-h-16 text-lg">Yes, it was me</Button>
          <Button disabled={busy} variant="danger" onClick={() => answer("denied")} className="min-h-16 text-lg">No, that wasn&apos;t me</Button>
        </div>
      </div>
    </div>
  );
}
