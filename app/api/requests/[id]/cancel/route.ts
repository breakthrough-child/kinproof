import { authed, type IdCtx } from "@/lib/api";
import { cancelHeld } from "@/lib/services/transfers";

export const POST = authed<IdCtx>(async (_req, userId, ctx) => ({ request: await cancelHeld(userId, (await ctx.params).id) }));
