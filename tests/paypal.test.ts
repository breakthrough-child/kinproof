import { beforeEach, describe, expect, it } from "vitest";
import { freshWorld } from "./helpers";
import { handleWebhookEvent } from "@/lib/paypal/webhook";
import type { MemoryStore } from "@/lib/store/memory";
import type { MockPayPalClient } from "@/lib/paypal/mock";

let store: MemoryStore;
let pp: MockPayPalClient;
beforeEach(() => ({ store, paypal: pp } = freshWorld()));

describe("mock PayPal: authorize / capture / void cycle", () => {
  const order = { transferRequestId: "r1", amount: 10, currency: "USD", payeeEmail: "a@b.example" };
  it("authorize then capture; capture is idempotent", async () => {
    const { orderId } = await pp.createOrder(order);
    const a = await pp.authorizeOrder(orderId);
    expect(await pp.authStatus(a.authorizationId)).toBe("CREATED");
    const c1 = await pp.capture(a.authorizationId, "k1");
    const c2 = await pp.capture(a.authorizationId, "k1");
    const c3 = await pp.capture(a.authorizationId, "other-key");
    expect(c1.captureId).toBe(c2.captureId);
    expect(c3.captureId).toBe(c1.captureId);
    expect(await pp.authStatus(a.authorizationId)).toBe("CAPTURED");
  });
  it("authorize then void; void is idempotent; cannot capture afterwards", async () => {
    const { orderId } = await pp.createOrder(order);
    const a = await pp.authorizeOrder(orderId);
    await pp.void(a.authorizationId, "v1");
    await pp.void(a.authorizationId, "v1");
    await pp.void(a.authorizationId, "v2");
    expect(await pp.authStatus(a.authorizationId)).toBe("VOIDED");
    await expect(pp.capture(a.authorizationId, "c")).rejects.toThrow();
  });
  it("cannot void after capture", async () => {
    const { orderId } = await pp.createOrder(order);
    const a = await pp.authorizeOrder(orderId);
    await pp.capture(a.authorizationId, "c");
    await expect(pp.void(a.authorizationId, "v")).rejects.toThrow();
  });
  it("authorizing the same order twice returns the same authorization", async () => {
    const { orderId } = await pp.createOrder(order);
    expect((await pp.authorizeOrder(orderId)).authorizationId).toBe((await pp.authorizeOrder(orderId)).authorizationId);
  });
  it("createOrder is idempotent per request", async () => {
    expect((await pp.createOrder(order)).orderId).toBe((await pp.createOrder(order)).orderId);
  });
});

describe("webhooks", () => {
  it("is idempotent by event id", async () => {
    const req = (await store.requestsForCircles(["circle-okafors"]))[0] ?? (await store.createRequest({
      circle_id: "circle-okafors", sender_member_id: "member-ada", claimed_requester_member_id: null, claimed_requester_name: null,
      channel: "text", raw_message: "", audio_path: null, transcript: null, amount: 5, currency: "USD", payee_email: "a@b.example",
      payee_kind: "other", institution_id: null, rule_signals: [], ai_analysis: null, risk_score: 0, risk_level: "low", status: "held",
      paypal_order_id: "O", paypal_authorization_id: "A", paypal_capture_id: null, confirm_expires_at: null, override_available_at: null, redirected_from_id: null,
    }));
    const ev = { id: "WH-1", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "CAP-1", custom_id: req.id } };
    expect(await handleWebhookEvent(ev)).toEqual({ handled: true, duplicate: false });
    expect(await handleWebhookEvent(ev)).toEqual({ handled: false, duplicate: true });
    const events = (await store.listEvents(req.id)).filter((e) => e.type === "webhook_capture_completed");
    expect(events).toHaveLength(1);
    expect((await store.getRequest(req.id))!.status).toBe("released");
  });
  it("ignores unknown requests and event types", async () => {
    expect((await handleWebhookEvent({ id: "WH-2", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { custom_id: "nope" } })).handled).toBe(false);
  });
});
