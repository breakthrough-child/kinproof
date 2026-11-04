import { config, type LlmProviderName } from "@/lib/config";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import type { LlmProvider } from "./types";

/**
 * Provider from LLM_PROVIDER (gemini | anthropic | mock). "mock" returns null: the caller runs the
 * deterministic rules engine only. Throws if the selected provider has no API key; the caller
 * treats that exactly like any other AI failure (rules-only, never auto-release).
 */
export function getLlmProvider(name: LlmProviderName = config().llmProvider): LlmProvider | null {
  switch (name) {
    case "mock":
      return null;
    case "anthropic":
      if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
      return new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY });
    case "gemini":
    default:
      return new GeminiProvider();
  }
}

export type { LlmProvider, LlmRequest } from "./types";
export { AnthropicProvider, type AiClient } from "./anthropic";
export { GeminiProvider, type GeminiClient } from "./gemini";
