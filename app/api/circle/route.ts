import { z } from "zod";
import { authed, jsonBody } from "@/lib/api";
import { getStore } from "@/lib/store";

const schema = z.object({ name: z.string().trim().min(1).max(60), label: z.string().trim().min(1).max(30).default("Family") });

export const POST = authed(async (req, userId) => {
  const b = schema.parse(await jsonBody(req));
  const { circle, member } = await getStore().createCircle(userId, b.name, b.label);
  return { circle, member };
});
