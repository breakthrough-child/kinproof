import { config } from "@/lib/config";
import type { AiAnalysis, Language, RiskLevel, RuleSignal } from "@/lib/types";
import { aiAnalysisSchema } from "./schema";
import { AnthropicProvider, type AiClient } from "@/lib/ai/anthropic";
import { getLlmProvider } from "@/lib/ai";
import type { LlmProvider } from "@/lib/ai/types";
import { buildUserPromptFor, CLOSING_LINE, OUTPUT_INSTRUCTION, SYSTEM_CORE } from "@/lib/ai/prompt";
import { applyFloor, levelFor, type RulesResult } from "./rules";

export interface AnalyzeInput {
  /** Untrusted text: pasted message and/or transcript. */
  message: string;
  senderName?: string;
  claimedName: string | null;
  claimedRelationship: string | null;
  amount: number;
  currency: string;
  payeeEmail: string;
  payeeDescription: string; // e.g. "verified PayPal of the claimed person" | "a verified institution: X" | "unknown account"
  language: Language;
  rules: RulesResult;
  historyStats: { count: number; median: number | null };
}

export type { AiClient };

/** Anthropic-flavoured user prompt (kept for compatibility); providers use buildUserPromptFor. */
export function buildUserPrompt(i: AnalyzeInput): string {
  return buildUserPromptFor(i, CLOSING_LINE.anthropic);
}

function money(i: { amount: number; currency: string }) {
  return `${i.currency === "USD" ? "$" : ""}${i.amount}${i.currency === "USD" ? "" : " " + i.currency}`;
}

/** Deterministic, templated output used in mock mode and when the AI fails. */
export function rulesOnlyAnalysis(i: AnalyzeInput, reason: "mock" | "error"): AiAnalysis {
  const level: RiskLevel = i.rules.level;
  const name = i.claimedName ?? "that person";
  const pcm = i.language === "pcm";
  let explanation: string;
  if (level === "low") {
    explanation = pcm
      ? "Nothing here dey worry us. Una go still confirm with am small before the money land."
      : "Nothing here looks unusual. We will still make a quick check before the money is released.";
  } else {
    explanation = pcm
      ? `Dis message get some things wey scammers dey use: ${i.rules.signals.map((s) => s.evidence).slice(0, 2).join(" ")} Make you no worry, we don hold the money. We go ask ${name} sharp sharp if na dem send am.`
      : `This request has some things scammers often use. ${i.rules.signals
          .map((s) => s.evidence)
          .slice(0, 2)
          .join(" ")} Please don't worry: your money is only on hold, and we are asking ${name} directly whether they really sent it.`;
  }
  const mentionedInstitution = /hospital|clinic/i.test(i.message)
    ? { name: "hospital", kind: "hospital" }
    : /school|college|university/i.test(i.message)
      ? { name: "school", kind: "school" }
      : /lawyer|legal|barrister/i.test(i.message)
        ? { name: "legal", kind: "legal" }
        : /police|station/i.test(i.message)
          ? { name: "police", kind: "police" }
          : null;
  return {
    risk_score: i.rules.score,
    risk_level: level,
    signals: i.rules.signals.map((s) => ({ type: s.id, quote: "", explanation: s.evidence })),
    claimed_identity: i.claimedName,
    claims_public_figure: i.rules.claimsPublicFigure,
    requested_amount: i.amount,
    requested_method: null,
    mentioned_institution: mentionedInstitution,
    confirmation_question: `Did you just ask ${i.senderName ?? "your family member"} for ${money(i)}?`,
    sender_explanation: explanation,
    recommended_action: level === "low" ? "confirm" : mentionedInstitution ? "redirect_to_institution" : "confirm",
    fallback: reason === "error" ? true : undefined,
  };
}

export interface AnalysisResult {
  ai: AiAnalysis;
  final: { score: number; level: RiskLevel };
  rulesSignals: RuleSignal[];
}

function isProvider(x: unknown): x is LlmProvider {
  return !!x && typeof (x as LlmProvider).generateAnalysis === "function";
}

/**
 * Provider-agnostic analysis. `override` lets tests inject a provider or an Anthropic-style client.
 * Safety is identical for every provider: delimited untrusted message, zod validation, the rules
 * floor, and a rules-only fallback (never auto-release) on error / refusal / invalid output.
 */
export async function analyze(i: AnalyzeInput, override?: AiClient | LlmProvider): Promise<AnalysisResult> {
  const cfg = config();
  let ai: AiAnalysis;
  let provider: LlmProvider | null = null;
  let providerError: Error | null = null;

  if (override) provider = isProvider(override) ? override : new AnthropicProvider({ client: override });
  else {
    try {
      provider = getLlmProvider(cfg.llmProvider); // null for "mock"
    } catch (e) {
      providerError = e as Error; // e.g. missing API key
    }
  }

  if (!provider && !providerError) {
    ai = rulesOnlyAnalysis(i, "mock");
  } else {
    try {
      if (!provider) throw providerError!;
      ai = await runProvider(i, provider);
    } catch (err) {
      console.error(`[kinproof] AI analysis failed (${provider?.name ?? cfg.llmProvider}), using rules only:`, (err as Error).message);
      ai = rulesOnlyAnalysis(i, "error");
    }
  }
  // The AI can raise risk but never lower it below the rules floor.
  const final = applyFloor(i.rules, ai);
  ai = { ...ai, risk_score: final.score, risk_level: final.level };
  // Never auto-release when the AI was unavailable.
  if (ai.fallback && ai.recommended_action === "release") ai.recommended_action = "confirm";
  return { ai, final, rulesSignals: i.rules.signals };
}

async function runProvider(i: AnalyzeInput, provider: LlmProvider): Promise<AiAnalysis> {
  const raw = await provider.generateAnalysis({
    system: SYSTEM_CORE + OUTPUT_INSTRUCTION[provider.name],
    user: buildUserPromptFor(i, CLOSING_LINE[provider.name]),
  });
  const parsed = aiAnalysisSchema.parse(raw);
  // Keep the level consistent with the score.
  return { ...parsed, risk_level: levelFor(parsed.risk_score) };
}
