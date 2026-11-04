export type LlmProviderName = "gemini" | "anthropic" | "mock";
export type TranscribeProviderName = "gemini" | "openai" | "groq";

function llmProvider(e: NodeJS.ProcessEnv): LlmProviderName {
  const p = (e.LLM_PROVIDER || "").trim().toLowerCase();
  if (p === "gemini" || p === "anthropic" || p === "mock") return p;
  if (e.AI_MODE === "mock") return "mock"; // legacy alias from before LLM_PROVIDER existed
  return "gemini";
}

function transcribeProvider(e: NodeJS.ProcessEnv): TranscribeProviderName {
  const p = (e.TRANSCRIBE_PROVIDER || "").trim().toLowerCase();
  return p === "openai" || p === "groq" || p === "gemini" ? p : "gemini";
}

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
    llmProvider: llmProvider(e),
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
    // "gemini-flash-latest" is the alias the @google/genai docs/README use for the current Flash model.
    // Pin an exact model id via GEMINI_MODEL for reproducible behaviour.
    geminiModel: e.GEMINI_MODEL || "gemini-flash-latest",
    transcribeProvider: transcribeProvider(e),
  };
}

export function mockBannerLabels(): string[] {
  const c = config();
  const out: string[] = [];
  if (c.paypalMode === "mock") out.push("PayPal mock");
  if (c.llmProvider === "mock") out.push("AI mock");
  else if (c.llmProvider === "gemini" && !process.env.GEMINI_API_KEY) out.push("no GEMINI_API_KEY: rules-only AI");
  else if (c.llmProvider === "anthropic" && !process.env.ANTHROPIC_API_KEY) out.push("no ANTHROPIC_API_KEY: rules-only AI");
  if (c.storeMode === "memory") out.push("in-memory data");
  return out;
}

export function formatNgn(usd: number): string {
  const n = Math.round(usd * config().ngnRate);
  return `≈ ₦${n.toLocaleString("en-NG")}`;
}
