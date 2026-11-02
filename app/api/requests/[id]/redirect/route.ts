import { z } from "zod";
import { authed, jsonBody, type IdCtx } from "@/lib/api";
import { redirectToInstitution } from "@/lib/services/transfers";

const schema = z.object({ institutionId: z.string().min(1) });

export const POST = authed<IdCtx>(async (req, userId, ctx) => {
  const { institutionId } = schema.parse(await jsonBody(req));
  const r = await redirectToInstitution(userId, (await ctx.params).id, institutionId);
  return { nextRequestId: r.next.id };
});
