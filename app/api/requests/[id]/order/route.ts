import { authed, type IdCtx } from "@/lib/api";
import { createPayPalOrder } from "@/lib/services/transfers";

export const POST = authed<IdCtx>(async (_req, userId, ctx) => {
  const { orderId } = await createPayPalOrder(userId, (await ctx.params).id);
  return { orderId };
});
