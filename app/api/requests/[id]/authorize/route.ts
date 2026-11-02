import { authed, type IdCtx } from "@/lib/api";
import { authorizeOrder } from "@/lib/services/transfers";

export const POST = authed<IdCtx>(async (_req, userId, ctx) => ({ request: await authorizeOrder(userId, (await ctx.params).id) }));
