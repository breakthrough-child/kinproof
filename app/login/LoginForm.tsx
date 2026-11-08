"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Card, Field, inputCls, PageHeader } from "@/components/ui";
import { IconAlert, IconCheck } from "@/components/icons";
import { post } from "@/lib/useLive";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function LoginForm({ demo, supabase, demoUsers }: { demo: boolean; supabase: boolean; demoUsers: { key: string; name: string; label: string }[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function demoLogin(key: string) {
    setBusy(true);
    const r = await post("/api/auth/demo", { key });
    setBusy(false);
    if (r.ok) { router.push(key === "ada" ? "/send" : "/inbox"); router.refresh(); }
    else setMsg({ tone: "err", text: r.data.error ?? "Could not sign in." });
  }
  async function passwordLogin(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabaseBrowser();
    if (!sb) return;
    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMsg({ tone: "err", text: "That email and password didn't match." });
    else { router.push("/circle"); router.refresh(); }
  }
  async function magic() {
    const sb = supabaseBrowser();
    if (!sb || !email) return setMsg({ tone: "err", text: "Type your email first." });
    setBusy(true);
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    setBusy(false);
    setMsg(error ? { tone: "err", text: "Could not send the link. Please try again." } : { tone: "ok", text: "Check your email for a sign-in link." });
  }
  async function signUp() {
    const sb = supabaseBrowser();
    if (!sb || !email || password.length < 8) return setMsg({ tone: "err", text: "Use your email and a password of at least 8 characters." });
    setBusy(true);
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name: email.split("@")[0] } } });
    setBusy(false);
    if (error) return setMsg({ tone: "err", text: error.message });
    if (data.session) { router.push("/circle"); router.refresh(); }
    else setMsg({ tone: "ok", text: "Account created. Check your email to confirm it, then sign in." });
  }

  const roles: Record<string, string> = { ada: "Sends the money", chidi: "Confirms on his phone", ngozi: "Can vouch" };
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader eyebrow="Welcome back" title="Sign in" />
      {demo && (
        <Card tone="primary">
          <h2 className="text-2xl font-semibold">Meet The Okafors</h2>
          <p className="mt-1 text-lg">Pick a family member to be. Open a second browser window to be Chidi while Ada sends money.</p>
          <ul className="mt-4 grid gap-3">
            {demoUsers.map((u) => (
              <li key={u.key}>
                <button type="button" disabled={busy} onClick={() => demoLogin(u.key)}
                  className="flex min-h-[4.5rem] w-full items-center gap-4 rounded-[16px] border border-line bg-surface p-3 text-left shadow-card transition-colors hover:border-primary hover:bg-surface2 disabled:opacity-50">
                  <Avatar name={u.name} size={52} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-xl font-semibold">{u.name}</span>
                    <span className="block text-base text-muted">{u.label} · {roles[u.key] ?? "Circle member"}</span>
                  </span>
                  <span aria-hidden="true" className="text-sm font-semibold text-primary">Sign in →</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {supabase && (
        <Card>
          <form onSubmit={passwordLogin} className="space-y-4">
            <Field label="Email"><input className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
            <Field label="Password"><input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={busy}>Sign in</Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={magic}>Email me a link</Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={signUp}>Create account</Button>
            </div>
          </form>
        </Card>
      )}
      {msg && <p role="alert" className={`flex gap-2.5 rounded-[14px] p-3.5 font-medium ${msg.tone === "ok" ? "bg-oksoft text-ok" : "bg-dangersoft text-danger"}`}>{msg.tone === "ok" ? <IconCheck size={22} className="mt-0.5 shrink-0" /> : <IconAlert size={22} className="mt-0.5 shrink-0" />}{msg.text}</p>}
    </div>
  );
}
