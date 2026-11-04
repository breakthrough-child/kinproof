import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { config } from "@/lib/config";
import { aiAnalysisSchema } from "@/lib/risk/schema";
import type { LlmProvider, LlmRequest } from "./types";

/** JSON-Schema keywords the Gemini API documents as supported for `responseJsonSchema`. */
const ALLOWED = new Set([
  "$id", "$defs", "$ref", "$anchor", "type", "format", "title", "description", "enum", "items", "prefixItems",
  "minItems", "maxItems", "minimum", "maximum", "anyOf", "oneOf", "properties", "additionalProperties", "required", "propertyOrdering",
]);

type Json = Record<string, unknown>;

/** Keep only supported keywords (drops $schema, minLength, maxLength, ...). Field names under `properties` are preserved. */
export function sanitizeForGemini(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeForGemini);
  if (!node || typeof node !== "object") return node;
  const out: Json = {};
  for (const [k, v] of Object.entries(node as Json)) {
    if (!ALLOWED.has(k)) continue;
    if (k === "properties" && v && typeof v === "object") {
      out[k] = Object.fromEntries(Object.entries(v as Json).map(([name, sub]) => [name, sanitizeForGemini(sub)]));
    } else if (k === "enum" || k === "required" || k === "type") {
      out[k] = v;
    } else {
      out[k] = sanitizeForGemini(v);
    }
  }
  return out;
}

/** One source of truth: the same zod schema that validates the output defines the response schema. */
export function geminiResponseSchema(): unknown {
  return sanitizeForGemini(z.toJSONSchema(aiAnalysisSchema));
}

/** Minimal surface of the SDK we use, so tests can inject a fake. */
export interface GeminiClient {
  models: { generateContent: (params: Record<string, unknown>) => Promise<GeminiResponse> };
}
export interface GeminiResponse {
  text?: string;
  promptFeedback?: { blockReason?: string };
  candidates?: { finishReason?: string }[];
}

const BAD_FINISH = new Set(["SAFETY", "RECITATION", "LANGUAGE", "OTHER", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "MALFORMED_FUNCTION_CALL", "MAX_TOKENS"]);

export function newGeminiClient(apiKey?: string, timeoutMs = 25_000): GeminiClient {
  return new GoogleGenAI({ apiKey: apiKey ?? process.env.GEMINI_API_KEY, httpOptions: { timeout: timeoutMs } }) as unknown as GeminiClient;
}

function parseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(t);
}

export class GeminiProvider implements LlmProvider {
  readonly name = "gemini" as const;
  private client: GeminiClient;
  private model: string;

  constructor(opts: { client?: GeminiClient; apiKey?: string; model?: string } = {}) {
    const key = opts.apiKey ?? process.env.GEMINI_API_KEY;
    if (!opts.client && !key) throw new Error("GEMINI_API_KEY is not set");
    this.client = opts.client ?? newGeminiClient(key);
    this.model = opts.model ?? config().geminiModel;
  }

  async generateAnalysis(req: LlmRequest): Promise<unknown> {
    const res = await this.client.models.generateContent({
      model: this.model,
      contents: req.user,
      config: {
        systemInstruction: req.system,
        responseMimeType: "application/json",
        responseJsonSchema: geminiResponseSchema(),
        maxOutputTokens: 8192,
      },
    });
    // Blocked prompt / safety stop / truncation are all treated like a refusal.
    if (res.promptFeedback?.blockReason) throw new Error(`prompt blocked: ${res.promptFeedback.blockReason}`);
    const finish = res.candidates?.[0]?.finishReason;
    if (finish && BAD_FINISH.has(finish)) throw new Error(`model stopped: ${finish}`);
    const text = res.text;
    if (!text || !text.trim()) throw new Error("empty model output");
    return parseJson(text);
  }
}
