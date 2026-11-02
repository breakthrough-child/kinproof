import { z } from "zod";
import { authed, jsonBody } from "@/lib/api";
import { getStore } from "@/lib/store";
import { ServiceError } from "@/lib/services/errors";

const schema = z.object({ code: z.string().trim().min(3).max(20), label: z.string().trim().min(1).max(30).default("Family") });

export const POST = authed(async (req, userId) => {
  const b = schema.parse(await jsonBody(req));
  const r = await getStore().joinCircle(userId, b.code, b.label);
  if (!r) throw new ServiceError("That invite code didn't match a circle.", 404, "not_found");
  return { circle: r.circle };
});
