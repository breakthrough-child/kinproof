import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getStore } from "@/lib/store";
import { config } from "@/lib/config";

/** Magic-link landing: exchange the code for a session, make sure a profile exists. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const base = config().appUrl;
  if (code && config().storeMode === "supabase") {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const store = getStore();
      if (!(await store.getProfile(data.user.id))) {
        await store.upsertProfile({ id: data.user.id, display_name: (data.user.email ?? "Member").split("@")[0] });
      }
      return NextResponse.redirect(`${base}/circle`);
    }
  }
  return NextResponse.redirect(`${base}/login`);
}
