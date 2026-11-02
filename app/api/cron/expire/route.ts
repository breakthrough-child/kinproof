import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { expireOverdue } from "@/lib/services/transfers";

export const dynamic = "force-dynamic";

/** Vercel Cron (every minute). Protected by CRON_SECRET (sent as `Authorization: Bearer ...`). */
export async function GET(req: Request) {
  const secret = config().cronSecret;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const expired = await expireOverdue();
  return NextResponse.json({ expired });
}
