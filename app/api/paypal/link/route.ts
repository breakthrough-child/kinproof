import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { authed, jsonBody } from "@/lib/api";
import { config } from "@/lib/config";
import { getStore } from "@/lib/store";
import { buildAuthorizeUrl } from "@/lib/paypal/identity";
import { DEMO, demoEmail } from "@/lib/store/seed";
import { forbidden, ServiceError } from "@/lib/services/errors";
import { LINK_COOKIE } from "@/lib/auth/constants";

const schema = z.object({ memberId: z.string().min(1) });

/** Start linking PayPal for one of MY circle memberships. */
export const POST = authed(async (req, userId) => {
  const { memberId } = schema.parse(await jsonBody(req));
  const store = getStore();
  const member = await store.getMember(memberId);
  if (!member || member.user_id !== userId) throw forbidden("You can only link your own PayPal.");

  if (config().paypalMode === "mock") {
    // Simulated "Log in with PayPal": demo users get their configured sandbox emails.
    const demo = DEMO.users.find((u) => member.display_name.toLowerCase() === u.name.toLowerCase());
    const email = demo ? demoEmail(demo) : `${member.display_name.toLowerCase().replace(/\W+/g, ".")}@personal.example.com`;
    await store.setMemberPaypal(memberId, { payer_id: `MOCKPAYER_${memberId.slice(-6).toUpperCase()}`, email });
    return { linked: true };
  }
  if (!process.env.PAYPAL_CLIENT_ID) throw new ServiceError("PayPal is not configured.", 500);
  const nonce = randomBytes(16).toString("hex");
  (await cookies()).set(LINK_COOKIE, `${nonce}.${memberId}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/paypal/link", maxAge: 600 });
  return NextResponse.json({ url: buildAuthorizeUrl(nonce) });
});
