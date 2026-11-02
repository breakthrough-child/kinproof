"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, inputCls } from "@/components/ui";
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

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="font-serif text-3xl font-bold">Sign in</h1>
      {demo && (
        <Card tone="primary">
          <h2 className="text-xl font-bold">One-click demo</h2>
          <p className="mt-1 text-muted">Sign in as a seeded member of The Okafors. Open a second browser window to be Chidi while Ada sends money.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {demoUsers.map((u) => (
              <Button key={u.key} variant={u.key === "ada" ? "primary" : "secondary"} disabled={busy} onClick={() => demoLogin(u.key)} className="flex-col !gap-0 py-3">
                <span>{u.name}</span><span className="text-sm font-normal opacity-80">{u.label}{u.key === "ada" ? " · sends" : u.key === "chidi" ? " · confirms" : ""}</span>
              </Button>
            ))}
          </div>
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
      {msg && <p role="alert" className={`rounded-xl p-3 ${msg.tone === "ok" ? "bg-oksoft text-ok" : "bg-dangersoft text-danger"}`}>{msg.text}</p>}
    </div>
  );
}
