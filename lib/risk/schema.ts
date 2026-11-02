import { z } from "zod";

export const aiAnalysisSchema = z.object({
  risk_score: z.number().int().min(0).max(100),
  risk_level: z.enum(["low", "medium", "high"]),
  signals: z
    .array(
      z.object({
        type: z.string().max(60),
        quote: z.string().max(200),
        explanation: z.string().max(400),
      }),
    )
    .max(12),
  claimed_identity: z.string().max(120).nullable(),
  claims_public_figure: z.boolean(),
  requested_amount: z.number().nullable(),
  requested_method: z.string().max(80).nullable(),
  mentioned_institution: z.object({ name: z.string().max(160), kind: z.string().max(40).nullable() }).nullable(),
  confirmation_question: z.string().min(5).max(240),
  sender_explanation: z.string().min(5).max(900),
  recommended_action: z.enum(["release", "confirm", "redirect_to_institution", "hold"]),
});

export type AiAnalysisParsed = z.infer<typeof aiAnalysisSchema>;

/** JSON schema handed to Claude as the tool input schema. */
export const aiToolInputSchema = {
  type: "object" as const,
  properties: {
    risk_score: { type: "integer", minimum: 0, maximum: 100 },
    risk_level: { type: "string", enum: ["low", "medium", "high"] },
    signals: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          quote: { type: "string", description: "Short quote from the message, max 15 words" },
          explanation: { type: "string" },
        },
        required: ["type", "quote", "explanation"],
      },
    },
    claimed_identity: { type: ["string", "null"] },
    claims_public_figure: { type: "boolean" },
    requested_amount: { type: ["number", "null"] },
    requested_method: { type: ["string", "null"] },
    mentioned_institution: {
      type: ["object", "null"],
      properties: { name: { type: "string" }, kind: { type: ["string", "null"] } },
      required: ["name", "kind"],
    },
    confirmation_question: { type: "string", description: "One short plain sentence for the real person" },
    sender_explanation: { type: "string", description: "Calm 2-4 sentences for the sender, in their language" },
    recommended_action: { type: "string", enum: ["release", "confirm", "redirect_to_institution", "hold"] },
  },
  required: [
    "risk_score",
    "risk_level",
    "signals",
    "claimed_identity",
    "claims_public_figure",
    "requested_amount",
    "requested_method",
    "mentioned_institution",
    "confirmation_question",
    "sender_explanation",
    "recommended_action",
  ],
};
