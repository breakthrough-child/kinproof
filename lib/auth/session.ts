import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { getStore } from "@/lib/store";
import { ServiceError } from "@/lib/services/errors";
import { supabaseServer } from "@/lib/supabase/server";

export const DEMO_COOKIE = "kp_demo_user";

/** The authenticated user id, or null. Supabase Auth in production; demo cookie only with the in-memory store. */
export async function getUserId(): Promise<string | null> {
  if (config().storeMode === "supabase") {
    const sb = await supabaseServer();
    const { data } = await sb.auth.getUser();
    return data.user?.id ?? null;
  }
  const c = (await cookies()).get(DEMO_COOKIE)?.value;
  if (!c) return null;
  return (await getStore().getProfile(c)) ? c : null;
}

export async function requireUserId(): Promise<string> {
  const id = await getUserId();
  if (!id) throw new ServiceError("Please sign in.", 401, "unauthenticated");
  return id;
}

/** For server components/pages. */
export async function requireUserOrRedirect(): Promise<string> {
  const id = await getUserId();
  if (!id) redirect("/login");
  return id;
}
