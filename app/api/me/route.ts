import { z } from "zod";
import { authed, jsonBody } from "@/lib/api";
import { getStore } from "@/lib/store";

export const GET = authed(async (_req, userId) => {
  const store = getStore();
  return { profile: await store.getProfile(userId), memberships: await store.membershipsForUser(userId) };
});

const patch = z.object({
  preferred_language: z.enum(["en", "pcm"]).optional(),
  large_text: z.boolean().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  display_name: z.string().trim().min(1).max(60).optional(),
});

export const PATCH = authed(async (req, userId) => {
  const b = patch.parse(await jsonBody(req));
  return { profile: await getStore().upsertProfile({ id: userId, ...b }) };
});
