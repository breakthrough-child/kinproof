import {
  PayPalError,
  type AuthorizeResult,
  type CaptureResult,
  type CreateOrderInput,
  type PayPalClient,
} from "./types";

/**
 * Sandbox-only PayPal REST client (Orders v2 + Payments v2).
 * NOTE: endpoints below were written from memory of the PayPal REST docs because
 * developer.paypal.com was unreachable from the build environment. Verify them
 * against the live docs and a sandbox run (docs/SANDBOX_VERIFICATION.md).
 */
export const PAYPAL_API = "https://api-m.sandbox.paypal.com";

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new PayPalError("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not set", 500);
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !json.access_token) throw new PayPalError("PayPal token request failed", res.status, undefined, json);
  tokenCache = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 300) * 1000 };
  return tokenCache.token;
}

export function resetTokenCache() {
  tokenCache = null;
}

async function pp<T>(method: string, path: string, body?: unknown, requestId?: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    throw new PayPalError(
      (json.message as string) || (json.name as string) || `PayPal ${method} ${path} failed`,
      res.status,
      res.headers.get("paypal-debug-id") ?? (json.debug_id as string | undefined),
      json,
    );
  }
  return json as T;
}

interface OrderResp {
  id: string;
  status: string;
  purchase_units?: { payments?: { authorizations?: { id: string; status: string }[] } }[];
  payer?: { email_address?: string };
}

export class SandboxPayPalClient implements PayPalClient {
  readonly mode = "sandbox" as const;

  async createOrder(i: CreateOrderInput) {
    const o = await pp<OrderResp>(
      "POST",
      "/v2/checkout/orders",
      {
        intent: "AUTHORIZE",
        purchase_units: [
          {
            reference_id: i.transferRequestId,
            custom_id: i.transferRequestId,
            description: i.description ?? "Kinproof protected transfer",
            amount: { currency_code: i.currency, value: i.amount.toFixed(2) },
            payee: { email_address: i.payeeEmail },
          },
        ],
      },
      `kinproof-create-${i.transferRequestId}-${i.payeeEmail}-${i.amount.toFixed(2)}`,
    );
    return { orderId: o.id };
  }

  async authorizeOrder(orderId: string): Promise<AuthorizeResult> {
    const o = await pp<OrderResp>("POST", `/v2/checkout/orders/${orderId}/authorize`, {}, `kinproof-authorize-${orderId}`);
    const a = o.purchase_units?.[0]?.payments?.authorizations?.[0];
    if (!a) throw new PayPalError("Authorization missing from PayPal response", 502, undefined, o);
    return { authorizationId: a.id, status: a.status, payerEmail: o.payer?.email_address ?? null };
  }

  async capture(authorizationId: string, idempotencyKey: string): Promise<CaptureResult> {
    const c = await pp<{ id: string; status: string }>(
      "POST",
      `/v2/payments/authorizations/${authorizationId}/capture`,
      { final_capture: true },
      `kinproof-capture-${idempotencyKey}`,
    );
    return { captureId: c.id, status: c.status };
  }

  async void(authorizationId: string, idempotencyKey: string): Promise<void> {
    try {
      await pp("POST", `/v2/payments/authorizations/${authorizationId}/void`, undefined, `kinproof-void-${idempotencyKey}`);
    } catch (e) {
      // Voiding an already-voided authorization is fine (idempotent for us).
      const details = (e as PayPalError).details as { details?: { issue?: string }[] } | undefined;
      if (details?.details?.some((d) => d.issue === "AUTHORIZATION_VOIDED")) return;
      throw e;
    }
  }

  async verifyWebhook(headers: Record<string, string | undefined>, rawBody: string): Promise<boolean> {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) return false;
    try {
      const r = await pp<{ verification_status: string }>("POST", "/v1/notifications/verify-webhook-signature", {
        auth_algo: headers["paypal-auth-algo"],
        cert_url: headers["paypal-cert-url"],
        transmission_id: headers["paypal-transmission-id"],
        transmission_sig: headers["paypal-transmission-sig"],
        transmission_time: headers["paypal-transmission-time"],
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody),
      });
      return r.verification_status === "SUCCESS";
    } catch {
      return false;
    }
  }
}
