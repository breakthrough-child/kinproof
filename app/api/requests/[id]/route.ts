import { authed, type IdCtx } from "@/lib/api";
import { getRequestView } from "@/lib/services/transfers";

export const GET = authed<IdCtx>(async (_req, userId, ctx) => getRequestView(userId, (await ctx.params).id));
