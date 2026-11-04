import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/lib/config";
import { aiToolInputSchema } from "@/lib/risk/schema";
import type { LlmProvider, LlmRequest } from "./types";

/** Minimal surface of the SDK we use, so tests can inject a fake. */
export interface AiClient {
  messages: { create: (body: Record<string, unknown>) => Promise<unknown> };
}

/** The original Claude integration, moved here unchanged (same request, same checks). */
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic" as const;
  private client: AiClient;
  private model: string;

  constructor(opts: { client?: AiClient; apiKey?: string; model?: string; maxRetries?: number } = {}) {
    this.client =
      opts.client ??
      (new Anthropic({ apiKey: opts.apiKey, timeout: 25_000, maxRetries: opts.maxRetries ?? 1 }) as unknown as AiClient);
    this.model = opts.model ?? config().anthropicModel;
  }

  async generateAnalysis(req: LlmRequest): Promise<unknown> {
    const res = (await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      system: req.system,
      // Forced tool_choice is rejected by current models; use auto + explicit instruction.
      tool_choice: { type: "auto" },
      output_config: { effort: "low" },
      tools: [
        {
          name: "record_analysis",
          description: "Record the structured scam-pressure analysis of the payment request.",
          input_schema: aiToolInputSchema,
        },
      ],
      messages: [{ role: "user", content: req.user }],
    })) as { stop_reason?: string; content: Array<{ type: string; name?: string; input?: unknown }> };

    if (res.stop_reason === "refusal") throw new Error("model refused");
    const block = res.content.find((b) => b.type === "tool_use" && b.name === "record_analysis");
    if (!block) throw new Error("no tool_use block returned");
    return block.input;
  }
}
