import { z } from "zod";
import { authed, jsonBody, type IdCtx } from "@/lib/api";
import { respondToConfirmation } from "@/lib/services/transfers";

const schema = z.object({ answer: z.enum(["confirmed", "denied"]) });

export const POST = authed<IdCtx>(async (req, userId, ctx) => {
  const { answer } = schema.parse(await jsonBody(req));
  return { request: await respondToConfirmation(userId, (await ctx.params).id, answer) };
});
