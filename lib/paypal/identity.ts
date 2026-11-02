import { config } from "@/lib/config";
import { PAYPAL_API } from "./sandbox";
import { PayPalError, type PayPalIdentity } from "./types";

/**
 * Log in with PayPal (sandbox). Proves a circle member controls a specific PayPal account.
 * Endpoints written from memory (docs unreachable at build time); verify in sandbox.
 */
const SANDBOX_CONNECT = "https://www.sandbox.paypal.com/connect";
const SCOPES = "openid email https://uri.paypal.com/services/paypalattributes";

export function redirectUri() {
  return `${config().appUrl}/api/paypal/link/callback`;
}

export function buildAuthorizeUrl(state: string): string {
  const u = new URL(SANDBOX_CONNECT);
  u.searchParams.set("flowEntry", "static");
  u.searchParams.set("client_id", process.env.PAYPAL_CLIENT_ID ?? "");
  u.searchParams.set("scope", SCOPES);
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeCodeForIdentity(code: string): Promise<PayPalIdentity> {
  const id = process.env.PAYPAL_CLIENT_ID!;
  const secret = process.env.PAYPAL_CLIENT_SECRET!;
  const tokRes = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code }).toString(),
  });
  const tok = (await tokRes.json().catch(() => ({}))) as { access_token?: string };
  if (!tokRes.ok || !tok.access_token) throw new PayPalError("Log in with PayPal token exchange failed", tokRes.status, undefined, tok);

  const uiRes = await fetch(`${PAYPAL_API}/v1/identity/oauth2/userinfo?schema=paypalv1.1`, {
    headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" },
  });
  const ui = (await uiRes.json().catch(() => ({}))) as {
    payer_id?: string;
    user_id?: string;
    emails?: { value: string; primary?: boolean; confirmed?: boolean }[];
  };
  if (!uiRes.ok) throw new PayPalError("Log in with PayPal userinfo failed", uiRes.status, undefined, ui);
  const email = ui.emails?.find((e) => e.primary) ?? ui.emails?.[0];
  const payerId = ui.payer_id ?? ui.user_id;
  if (!payerId || !email) throw new PayPalError("userinfo missing payer id or email", 502, undefined, ui);
  return { payerId, email: email.value, emailVerified: email.confirmed !== false };
}
