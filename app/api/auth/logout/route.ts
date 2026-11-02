import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { DEMO_COOKIE } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST() {
  if (config().storeMode === "supabase") await (await supabaseServer()).auth.signOut();
  (await cookies()).delete(DEMO_COOKIE);
  return NextResponse.json({ ok: true });
}
