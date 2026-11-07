"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, inputCls } from "@/components/ui";
import { post } from "@/lib/useLive";
import { toWav16k } from "@/lib/audio/toWav";
import { canRecordAudio } from "@/lib/browser";

type Circle = { id: string; name: string; members: { id: string; name: string; label: string; email: string | null }[] };
const OTHER = "__other__";

export function SendForm({ circles, ngnRate }: { circles: Circle[]; ngnRate: number }) {
  const router = useRouter();
  const [circleId, setCircleId] = useState(circles[0].id);
  const circle = circles.find((c) => c.id === circleId)!;
  const [who, setWho] = useState(circle.members[0]?.id ?? OTHER);
  const [otherName, setOtherName] = useState("");
  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [payee, setPayee] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const canRecord = useSyncExternalStore(() => () => {}, canRecordAudio, () => false);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const claimed = circle.members.find((m) => m.id === who) ?? null;
  const amt = Number(amount);

  async function upload(file: Blob, name: string) {
    setBusy(true);
    setErr(null);
    setNote("Listening to the voice note…");
    const fd = new FormData();
    try {
      // Normalise to 16 kHz mono WAV in the browser (works for recordings and WhatsApp notes the browser can decode).
      if (!/\.wav$/i.test(name)) {
        fd.append("audio", await toWav16k(file), "voice.wav");
      } else fd.append("audio", file, name);
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!(amt > 0)) return setErr("Please enter how much is being asked for.");
    if (!message.trim() && !transcript.trim()) return setErr("Please paste the message or add the voice note, so Kinproof can check it.");
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

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">Send money safely</h1>
        <p className="mt-1 text-lg text-muted">Tell us who is asking and what they said. Kinproof checks it before any money moves.</p>
      </div>

      <Card className="space-y-5">
        {circles.length > 1 && (
          <Field label="Circle">
            <select className={inputCls} value={circleId} onChange={(e) => { setCircleId(e.target.value); setWho(circles.find((c) => c.id === e.target.value)!.members[0]?.id ?? OTHER); }}>
              {circles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="1. Who is asking you for money?" hint="The person the message says it is from, even if you aren't sure it really is.">
          <select className={inputCls} value={who} onChange={(e) => setWho(e.target.value)}>
            {circle.members.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.label})</option>)}
            <option value={OTHER}>Someone else / a public figure</option>
          </select>
        </Field>
        {who === OTHER && <Field label="Who do they say they are?"><input className={inputCls} value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="e.g. a friend of my son, a famous singer" /></Field>}

        <Field label="2. What did they say?" hint="Paste the message, or add the voice note below.">
          <textarea className={`${inputCls} min-h-32 py-3`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mum it's me, I lost my phone…" />
        </Field>
        <div className="rounded-xl border border-dashed border-line p-4">
          <p className="mb-3 text-base font-semibold">Voice note (optional)</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex min-h-12 cursor-pointer items-center rounded-xl border border-line bg-surface px-5 font-semibold hover:bg-surface2">
              Upload a file
              <input type="file" className="sr-only" accept="audio/*,.opus,.ogg,.m4a,.mp3,.wav,.webm" disabled={busy}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, f.name); }} />
            </label>
            {canRecord && <Button type="button" variant={recording ? "danger" : "secondary"} onClick={toggleRecord} disabled={busy && !recording}>{recording ? "Stop recording" : "Record now"}</Button>}
          </div>
          <p className="mt-2 text-sm text-muted">WhatsApp voice notes (.opus, .ogg) work. Forward or save the note, then upload it.</p>
          {note && <p role="status" className="mt-2 text-base">{note}</p>}
          {(audioPath || transcript) && (
            <div className="mt-3"><Field label="What the voice note says"><textarea className={`${inputCls} min-h-24 py-3`} value={transcript} onChange={(e) => setTranscript(e.target.value)} /></Field></div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="3. How much? (US dollars)" hint={amt > 0 ? `≈ ₦${Math.round(amt * ngnRate).toLocaleString("en-NG")} (approximate)` : "Sandbox uses USD"}>
            <input className={inputCls} inputMode="decimal" type="number" min="1" max="10000" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </Field>
          <Field label="4. PayPal email to pay">
            <input className={inputCls} type="email" autoComplete="off" value={payee} onChange={(e) => setPayee(e.target.value)} required />
          </Field>
        </div>
        {claimed?.email && (
          <button type="button" onClick={() => setPayee(claimed.email!)} className="text-left text-base font-semibold text-primary underline underline-offset-4">
            Use {claimed.name}&apos;s verified PayPal ({claimed.email})
          </button>
        )}
      </Card>

      {err && <p role="alert" className="rounded-xl bg-dangersoft p-3 text-danger">{err}</p>}
      <Button type="submit" disabled={busy} className="min-h-14 w-full text-lg">{busy ? "Checking…" : "Check this request"}</Button>
    </form>
  );
}
