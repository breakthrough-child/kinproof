import { z } from "zod";
import { authed, jsonBody, type IdCtx } from "@/lib/api";
import { overrideRelease } from "@/lib/services/transfers";

const schema = z.object({ phrase: z.string().max(200) });

export const POST = authed<IdCtx>(async (req, userId, ctx) => {
  const { phrase } = schema.parse(await jsonBody(req));
  return { request: await overrideRelease(userId, (await ctx.params).id, phrase) };
});
