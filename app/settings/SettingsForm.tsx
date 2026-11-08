"use client";
import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, inputCls, PageHeader } from "@/components/ui";
import { IconBell, IconCheck } from "@/components/icons";
import { notificationPermission, requestNotificationPermission, type NotificationState } from "@/lib/browser";

export function SettingsForm({ profile }: { profile: { display_name: string; preferred_language: "en" | "pcm"; large_text: boolean; phone: string | null } }) {
  const router = useRouter();
  const [p, setP] = useState(profile);
  const [msg, setMsg] = useState<string | null>(null);
  // Server render and first client render agree ("unsupported"); the real value is read after hydration.
  const detected = useSyncExternalStore(() => () => {}, notificationPermission, (): NotificationState => "unsupported");
  const [asked, setAsked] = useState<NotificationState | null>(null);
  const notif = asked ?? detected;

  async function save() {
    try {
      const r = await fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...p, phone: p.phone || null }) });
      setMsg(r.ok ? "Saved." : "Could not save.");
      router.refresh();
    } catch {
      setMsg("Could not save. Check your connection.");
    }
  }
  async function enableNotifications() {
    setAsked(await requestNotificationPermission());
  }
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader eyebrow="Make it comfortable" title="Settings">Language, text size and alerts. Changes apply to you only.</PageHeader>
      <Card className="space-y-5">
        <Field label="Your name"><input className={inputCls} value={p.display_name} onChange={(e) => setP({ ...p, display_name: e.target.value })} /></Field>
        <Field label="Language for explanations" hint="Kinproof will explain what it found in this language.">
          <select className={inputCls} value={p.preferred_language} onChange={(e) => setP({ ...p, preferred_language: e.target.value as "en" | "pcm" })}>
            <option value="en">English</option>
            <option value="pcm">Nigerian Pidgin</option>
          </select>
        </Field>
        <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[14px] border border-line bg-surface px-4 text-base font-semibold">
          <input type="checkbox" className="h-7 w-7 accent-[var(--primary)]" checked={p.large_text} onChange={(e) => setP({ ...p, large_text: e.target.checked })} />
          Larger text
        </label>
        <Field label="Mobile number (optional)" hint="Only used to text you a sign-in link when someone needs you to confirm a payment. You can never approve by replying to a text.">
          <input className={inputCls} inputMode="tel" autoComplete="tel" value={p.phone ?? ""} onChange={(e) => setP({ ...p, phone: e.target.value })} placeholder="+234…" />
        </Field>
        <div>
          <p className="mb-2 text-base font-semibold">Alerts on this device</p>
          {notif === "granted" ? <p className="flex items-center gap-2 font-semibold text-ok"><IconCheck size={20} />Notifications are on.</p> : notif === "unsupported" ? <p className="text-muted">This browser doesn&apos;t support notifications.</p> : <Button variant="secondary" onClick={enableNotifications}><IconBell size={20} />Turn on notifications</Button>}
          {notif === "denied" && <p className="mt-2 text-sm text-muted">Notifications are blocked in your browser settings. The in-app confirmation card still appears whenever Kinproof is open.</p>}
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={save}>Save</Button>
          {msg && <span role="status" className="text-muted">{msg}</span>}
        </div>
      </Card>
    </div>
  );
}
