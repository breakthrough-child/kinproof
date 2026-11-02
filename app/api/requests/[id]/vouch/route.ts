import { z } from "zod";
import { authed, jsonBody, type IdCtx } from "@/lib/api";
import { vouch } from "@/lib/services/transfers";

const schema = z.object({ method: z.enum(["called_known_number", "in_person", "other"]), note: z.string().trim().max(500).default("") });

export const POST = authed<IdCtx>(async (req, userId, ctx) => {
  const b = schema.parse(await jsonBody(req));
  return { request: await vouch(userId, (await ctx.params).id, b.method, b.note) };
});
