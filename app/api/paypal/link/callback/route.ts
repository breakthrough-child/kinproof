import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { getUserId } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { exchangeCodeForIdentity } from "@/lib/paypal/identity";
import { LINK_COOKIE } from "@/lib/auth/constants";

/** Log in with PayPal redirect target: stores the verified payer id + email on the member. */
export async function GET(req: Request) {
  const base = config().appUrl;
  const back = (q: string) => NextResponse.redirect(`${base}/circle?${q}`);
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const jar = await cookies();
    const cookie = jar.get(LINK_COOKIE)?.value;
    jar.delete(LINK_COOKIE);
    const userId = await getUserId();
    if (!userId) return NextResponse.redirect(`${base}/login`);
    if (!code || !state || !cookie) return back("link=failed");
    const [nonce, memberId] = cookie.split(".");
    if (nonce !== state) return back("link=failed"); // CSRF check
    const store = getStore();
    const member = await store.getMember(memberId);
    if (!member || member.user_id !== userId) return back("link=failed");
    const id = await exchangeCodeForIdentity(code);
    if (!id.emailVerified) return back("link=unverified");
    await store.setMemberPaypal(memberId, { payer_id: id.payerId, email: id.email });
    return back("link=ok");
  } catch (e) {
    console.error("[kinproof] paypal link failed", (e as Error).message);
    return back("link=failed");
  }
}
