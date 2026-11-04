/**
 * One interface for every LLM provider. A provider turns the (already delimited) prompts into a
 * raw structured-output object. Everything safety-critical (prompt text, zod validation, the
 * rules floor, the rules-only fallback) lives in lib/risk/analyze.ts and is shared by all providers.
 */
export interface LlmRequest {
  system: string;
  user: string;
}

export interface LlmProvider {
  readonly name: "anthropic" | "gemini";
  /**
   * Returns the model's structured output, unvalidated.
   * MUST throw on any error, timeout, refusal/block, truncation or missing output;
   * the caller then falls back to rules-only and never auto-releases.
   */
  generateAnalysis(req: LlmRequest): Promise<unknown>;
}
