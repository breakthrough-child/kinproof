import { NextResponse } from "next/server";
import { getPayPal } from "@/lib/paypal";
import { handleWebhookEvent } from "@/lib/paypal/webhook";

export const dynamic = "force-dynamic";

/** PayPal webhooks: signature verified via PayPal's verify-webhook-signature API. Optional; server responses remain the source of truth. */
export async function POST(req: Request) {
  const raw = await req.text();
  const headers: Record<string, string | undefined> = {};
  req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  const ok = await getPayPal().verifyWebhook(headers, raw);
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  try {
    const result = await handleWebhookEvent(JSON.parse(raw));
    return NextResponse.json(result);
  } catch (e) {
    console.error("[kinproof] webhook error", (e as Error).message);
    return NextResponse.json({ error: "handler failed" }, { status: 500 }); // PayPal will retry
  }
}
