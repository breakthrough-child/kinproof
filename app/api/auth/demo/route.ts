import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { DEMO } from "@/lib/store/seed";
import { MemoryStore } from "@/lib/store/memory";
import { DEMO_COOKIE } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";
import { fail, jsonBody } from "@/lib/api";
import { ServiceError } from "@/lib/services/errors";

/** One-click demo sign-in for the seeded users. Only available in DEMO_MODE (or with the in-memory dev store). */
export async function POST(req: Request) {
  try {
    const cfg = config();
    if (!cfg.demoMode && cfg.storeMode !== "memory") throw new ServiceError("Demo sign-in is disabled.", 403, "forbidden");
    const { key } = await jsonBody<{ key?: string }>(req);
    const u = DEMO.users.find((x) => x.key === key);
    if (!u) throw new ServiceError("Unknown demo user.", 400);
    if (cfg.storeMode === "memory") {
      (await cookies()).set(DEMO_COOKIE, MemoryStore.userId(u.key), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
      return NextResponse.json({ ok: true });
    }
    const password = process.env.DEMO_PASSWORD;
    if (!password) throw new ServiceError("DEMO_PASSWORD is not configured.", 500);
    const sb = await supabaseServer();
    const { error } = await sb.auth.signInWithPassword({ email: u.login, password });
    if (error) throw new ServiceError("Demo sign-in failed. Has `pnpm seed:demo` been run?", 500);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
