function num(v: string | undefined, d: number): number {
  const n = v === undefined || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
}

/** Read lazily so tests can mutate process.env. */
export function config() {
  const e = process.env;
  return {
    appUrl: e.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    paypalMode: (e.PAYPAL_MODE === "sandbox" ? "sandbox" : "mock") as "sandbox" | "mock",
    aiMode: (e.AI_MODE === "live" ? "live" : "mock") as "live" | "mock",
    /** "supabase" when keys exist, otherwise the in-memory store (dev/tests only). */
    storeMode: (e.NEXT_PUBLIC_SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "memory") as
      | "supabase"
      | "memory",
    confirmWindowMinutes: num(e.CONFIRM_WINDOW_MINUTES, 15),
    autoReleaseMax: num(e.AUTO_RELEASE_MAX, 200),
    ngnRate: num(e.NGN_DISPLAY_RATE, 1550),
    cooldownMinutes: num(e.OVERRIDE_COOLDOWN_MINUTES, 10),
    highAmountNoHistory: num(e.HIGH_AMOUNT_NO_HISTORY, 300),
    demoMode: e.DEMO_MODE === "true",
    cronSecret: e.CRON_SECRET || "",
    anthropicModel: e.ANTHROPIC_MODEL || "claude-sonnet-5-5",
    transcribeProvider: (e.TRANSCRIBE_PROVIDER === "openai" ? "openai" : "groq") as "groq" | "openai",
  };
}

export function mockBannerLabels(): string[] {
  const c = config();
  const out: string[] = [];
  if (c.paypalMode === "mock") out.push("PayPal mock");
  if (c.aiMode === "mock") out.push("AI mock");
  if (c.storeMode === "memory") out.push("in-memory data");
  return out;
}

export function formatNgn(usd: number): string {
  const n = Math.round(usd * config().ngnRate);
  return `≈ ₦${n.toLocaleString("en-NG")}`;
}
