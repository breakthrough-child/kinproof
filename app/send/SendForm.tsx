"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Card, Field, inputCls, PageHeader } from "@/components/ui";
import { IconAlert, IconArrowLeft, IconArrowRight, IconMic, IconShield, IconUpload } from "@/components/icons";
import { post } from "@/lib/useLive";
import { toWav16k } from "@/lib/audio/toWav";
import { canRecordAudio } from "@/lib/browser";
import { nextPayee, payeeMismatch } from "@/lib/payee";

type Member = { id: string; name: string; label: string; email: string | null };
type Circle = { id: string; name: string; members: Member[] };
const OTHER = "__other__";
const STEPS = ["Who’s asking", "What they said", "Amount and payee", "Review"] as const;

export function SendForm({ circles, ngnRate }: { circles: Circle[]; ngnRate: number }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [circleId, setCircleId] = useState(circles[0].id);
  const circle = circles.find((c) => c.id === circleId)!;
  const [who, setWho] = useState(circle.members[0]?.id ?? OTHER);
  const [otherName, setOtherName] = useState("");
  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  // Prefill with the first member's verified PayPal: the safe default is "pay the person who is asking".
  const [payee, setPayee] = useState(circle.members[0]?.email ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const canRecord = useSyncExternalStore(() => () => {}, canRecordAudio, () => false);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const claimed = circle.members.find((m) => m.id === who) ?? null;
  const amt = Number(amount);
  const mismatch = payeeMismatch(claimed?.email, payee);
  const unlinked = !!claimed && !claimed.email && !!payee.trim();
  const last = STEPS.length - 1;

  function chooseWho(id: string) {
    const prev = circle.members.find((m) => m.id === who)?.email ?? null;
    const next = circle.members.find((m) => m.id === id)?.email ?? null;
    setWho(id);
    setPayee((cur) => nextPayee(cur, prev, next));
  }
  function chooseCircle(id: string) {
    const c = circles.find((x) => x.id === id)!;
    setCircleId(id);
    setWho(c.members[0]?.id ?? OTHER);
    setPayee(c.members[0]?.email ?? "");
  }

  async function upload(file: Blob, name: string) {
    setBusy(true);
    setErr(null);
    setNote("Listening to the voice note…");
    const fd = new FormData();
    try {
      // Normalise to 16 kHz mono WAV in the browser (works for recordings and WhatsApp notes the browser can decode).
      if (!/\.wav$/i.test(name)) fd.append("audio", await toWav16k(file), "voice.wav");
      else fd.append("audio", file, name);
    } catch {
      fd.append("audio", file, name); // browser can't decode it: the server will try (and transcode if it can)
    }
    const r = await fetch("/api/transcribe", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setNote(null); return setErr(j.error ?? "Could not read that recording."); }
    setAudioPath(j.audioPath);
    setTranscript(j.transcript ?? "");
    setNote(j.mock ? "Saved. No speech-to-text key is set here, so please type what the voice note said below." : "Done. Check the words below and fix anything that is wrong.");
  }
  async function toggleRecord() {
    if (recording) {
      try { rec.current?.stop(); } catch { setRecording(false); }
      return;
    }
    if (!canRecordAudio()) {
      setErr("Recording isn't available in this browser. You can upload a voice note file or type the message instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const type = mr.mimeType || "audio/webm";
        upload(new Blob(chunks.current, { type }), type.includes("mp4") ? "recording.m4a" : "recording.webm");
      };
      mr.start();
      rec.current = mr;
      setRecording(true);
    } catch {
      setErr("We couldn't use the microphone. You can upload a voice note file or type the message instead.");
    }
  }

  /** The first problem with a step, in plain words, or null. */
  function problem(s: number): string | null {
    if (s === 1 && !message.trim() && !transcript.trim()) return "Please paste the message or add the voice note, so Kinproof can check it.";
    if (s === 2 && !(amt > 0)) return "Please enter how much is being asked for.";
    if (s === 2 && !payee.trim()) return "Please enter the PayPal email the money would go to.";
    return null;
  }
  function go(to: number) {
    setErr(null);
    if (to > step) for (let s = step; s < to; s++) { const p = problem(s); if (p) { setStep(s); return setErr(p); } }
    setStep(to);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step < last) return go(step + 1);
    setErr(null);
    const p = problem(1) ?? problem(2);
    if (p) { setStep(problem(1) ? 1 : 2); return setErr(p); }
    setBusy(true);
    const r = await post<{ request?: { id: string } }>("/api/requests", {
      circleId,
      claimedMemberId: who === OTHER ? null : who,
      claimedName: who === OTHER ? otherName || "Someone else" : undefined,
      channel: audioPath ? "voice_note" : "text",
      message,
      transcript: transcript || undefined,
      audioPath: audioPath ?? undefined,
      amount: amt,
      payeeEmail: payee,
    });
    setBusy(false);
    if (!r.ok || !r.data.request) return setErr(r.data.error ?? "Something went wrong.");
    router.push(`/requests/${r.data.request.id}`);
  }

  const askerName = who === OTHER ? otherName.trim() || "Someone else" : claimed?.name ?? "them";
  const warning = mismatch ? (
    <div role="alert" className="flex gap-3 rounded-[14px] border border-caution/40 bg-cautionsoft p-4 text-caution">
      <IconAlert size={24} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-bold">This isn&apos;t {claimed!.name}&apos;s verified PayPal account.</p>
        <p className="mt-1 text-base text-ink">{claimed!.name}&apos;s verified address is <span className="break-all font-semibold">{claimed!.email}</span>. Scammers often ask for money to a different account.</p>
        <button type="button" onClick={() => setPayee(claimed!.email!)} className="mt-2 min-h-11 rounded-xl text-left font-semibold text-primary underline underline-offset-4">Use {claimed!.name}&apos;s verified PayPal</button>
      </div>
    </div>
  ) : unlinked ? (
    <div role="status" className="flex gap-3 rounded-[14px] border border-line bg-surface2 p-4">
      <IconAlert size={24} className="mt-0.5 shrink-0 text-caution" />
      <p className="text-base">{claimed!.name} hasn&apos;t linked their PayPal yet, so Kinproof can&apos;t check this address belongs to them.</p>
    </div>
  ) : null;

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl" noValidate>
      <PageHeader eyebrow={`Step ${step + 1} of ${STEPS.length}`} title="Send money safely" />

      <ol aria-label="Progress" className="mb-6 grid grid-cols-4 gap-1.5">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}>
            <div className={`h-1.5 rounded-full ${i <= step ? "bg-primary" : "bg-line"}`} />
            <span className={`mt-1.5 hidden text-sm sm:block ${i === step ? "font-semibold text-ink" : "text-muted"}`}>{i + 1}. {s}</span>
          </li>
        ))}
      </ol>

      <Card className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold">{STEPS[step]}</h2>
          <p className="mt-1 text-muted">{step === 0 ? "Say who is asking. Kinproof checks the request before any money moves." : step === 1 ? "Paste the message or add the voice note, exactly as it came." : step === 2 ? "How much, and which PayPal account would receive it." : "One last look. Nothing is sent from here."}</p>
        </div>
        {/* Step 1: who */}
        <div hidden={step !== 0} className="space-y-5">
          {circles.length > 1 && (
            <Field label="Circle">
              <select className={inputCls} value={circleId} onChange={(e) => chooseCircle(e.target.value)}>
                {circles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
          <fieldset>
            <legend className="mb-1 text-base font-semibold">Who is asking you for money?</legend>
            <p className="mb-3 text-sm text-muted">The person the message says it is from, even if you aren&apos;t sure it really is.</p>
            <div className="grid gap-2.5">
              {circle.members.map((m) => (
                <label key={m.id} className="flex min-h-16 cursor-pointer items-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-2.5 has-[:checked]:border-primary has-[:checked]:bg-primarysoft has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--primary)]">
                  <input type="radio" name="who" value={m.id} checked={who === m.id} onChange={() => chooseWho(m.id)} className="sr-only" />
                  <Avatar name={m.name} size={44} />
                  <span className="min-w-0 flex-1"><span className="block text-lg font-semibold">{m.name}</span><span className="block text-sm text-muted">{m.label}{m.email ? " · PayPal verified" : " · PayPal not linked"}</span></span>
                  <span aria-hidden="true" className={`grid h-6 w-6 place-items-center rounded-full border-2 ${who === m.id ? "border-primary bg-primary" : "border-line"}`}>{who === m.id && <span className="h-2 w-2 rounded-full bg-primaryink" />}</span>
                </label>
              ))}
              <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded-[14px] border border-dashed border-line bg-surface px-4 py-2.5 has-[:checked]:border-primary has-[:checked]:bg-primarysoft has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--primary)]">
                <input type="radio" name="who" value={OTHER} checked={who === OTHER} onChange={() => chooseWho(OTHER)} className="sr-only" />
                <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface2 font-serif text-xl font-semibold text-muted">?</span>
                <span className="min-w-0 flex-1"><span className="block text-lg font-semibold">Someone else</span><span className="block text-sm text-muted">A friend of the family, a public figure, a company</span></span>
                <span aria-hidden="true" className={`grid h-6 w-6 place-items-center rounded-full border-2 ${who === OTHER ? "border-primary bg-primary" : "border-line"}`}>{who === OTHER && <span className="h-2 w-2 rounded-full bg-primaryink" />}</span>
              </label>
            </div>
          </fieldset>
          {who === OTHER && <Field label="Who do they say they are?"><input className={inputCls} value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="e.g. a friend of my son, a famous singer" /></Field>}
        </div>

        {/* Step 2: message */}
        <div hidden={step !== 1} className="space-y-5">
          <Field label="What did they say?" hint="Paste the message, or add the voice note below.">
            <textarea className={`${inputCls} min-h-36 py-3`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mum it's me, my phone fell and broke…" />
          </Field>
          <div className="rounded-[14px] border border-dashed border-line p-4">
            <p className="mb-3 text-base font-semibold">Voice note <span className="font-normal text-muted">(optional)</span></p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-[14px] border border-line bg-surface px-5 font-semibold hover:bg-surface2 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--primary)]">
                <IconUpload size={20} />Upload a file
                <input type="file" className="sr-only" accept="audio/*,.opus,.ogg,.m4a,.mp3,.wav,.webm" disabled={busy}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, f.name); }} />
              </label>
              {canRecord && <Button type="button" variant={recording ? "danger" : "secondary"} onClick={toggleRecord} disabled={busy && !recording}><IconMic size={20} />{recording ? "Stop recording" : "Record now"}</Button>}
            </div>
            <p className="mt-2 text-sm text-muted">WhatsApp voice notes (.opus, .ogg) work. Save the note, then upload it.</p>
            {note && <p role="status" className="mt-2 text-base">{note}</p>}
            {(audioPath || transcript) && (
              <div className="mt-3"><Field label="What the voice note says"><textarea className={`${inputCls} min-h-24 py-3`} value={transcript} onChange={(e) => setTranscript(e.target.value)} /></Field></div>
            )}
          </div>
        </div>

        {/* Step 3: amount and payee */}
        <div hidden={step !== 2} className="space-y-5">
          <Field label="How much are they asking for? (US dollars)" hint={amt > 0 ? `≈ ₦${Math.round(amt * ngnRate).toLocaleString("en-NG")} (approximate)` : "The sandbox uses US dollars."}>
            <input className={`${inputCls} text-2xl font-semibold tabular-nums`} inputMode="decimal" type="number" min="1" max="10000" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="PayPal email to pay" hint={claimed?.email ? `Filled in with ${claimed.name}'s verified PayPal. Change it only if you have a good reason.` : undefined}>
            <input className={inputCls} type="email" autoComplete="off" value={payee} onChange={(e) => setPayee(e.target.value)} />
          </Field>
          {warning}
        </div>

        {/* Step 4: review */}
        <div hidden={step !== 3} className="space-y-4">
          <dl className="divide-y divide-line rounded-[14px] border border-line bg-surface">
            {[
              { k: "Asking", v: <span className="font-semibold">{askerName}</span>, to: 0 },
              { k: "Said", v: <span className="line-clamp-3 whitespace-pre-wrap">{(message || transcript).trim() || "—"}</span>, to: 1 },
              { k: "Amount", v: <span className="font-semibold">${amt > 0 ? amt.toLocaleString("en-US") : "—"} <span className="font-normal text-muted">{amt > 0 ? `≈ ₦${Math.round(amt * ngnRate).toLocaleString("en-NG")}` : ""}</span></span>, to: 2 },
              { k: "Paying", v: <span className="break-all font-semibold">{payee || "—"}</span>, to: 2 },
            ].map((row) => (
              <div key={row.k} className="flex items-start gap-3 p-3.5">
                <dt className="w-20 shrink-0 text-sm font-semibold uppercase tracking-wide text-muted">{row.k}</dt>
                <dd className="min-w-0 flex-1">{row.v}</dd>
                <button type="button" onClick={() => go(row.to)} className="min-h-11 shrink-0 rounded-xl px-2 text-sm font-semibold text-primary underline underline-offset-4"><span className="sr-only">Change {row.k.toLowerCase()}: </span>Change</button>
              </div>
            ))}
          </dl>
          {warning}
          <p className="flex gap-2.5 rounded-[14px] bg-primarysoft p-3.5 text-base">
            <IconShield size={22} className="mt-0.5 shrink-0 text-primary" />
            <span>Next, Kinproof reads the message for scam pressure. Then you decide. <strong>Nothing is sent from this screen.</strong></span>
          </p>
        </div>
      </Card>

      {err && <p role="alert" className="mt-4 flex gap-2.5 rounded-[14px] bg-dangersoft p-3.5 font-medium text-danger"><IconAlert size={22} className="mt-0.5 shrink-0" />{err}</p>}

      {/* Sticky actions: sit above the bottom nav on phones, safe-area aware */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 -mx-4 mt-6 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur-sm md:bottom-0">
        <div className="mx-auto flex max-w-2xl gap-3">
          {step > 0 && <Button type="button" variant="secondary" onClick={() => go(step - 1)} className="min-h-14 px-5"><IconArrowLeft size={20} />Back</Button>}
          {/* Distinct keys: without them React reuses one DOM button, so tapping Next on the last-but-one step turns it into a submit button mid-click and sends the form. */}
          {step < last ? (
            <Button key="next" type="button" onClick={() => go(step + 1)} className="min-h-14 flex-1 text-lg">Next<IconArrowRight size={20} /></Button>
          ) : (
            <Button key="submit" type="submit" disabled={busy} className="min-h-14 flex-1 text-lg">{busy ? "Checking…" : "Check this request"}</Button>
          )}
        </div>
      </div>
    </form>
  );
}
