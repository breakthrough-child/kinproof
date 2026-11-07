import { getStore } from "@/lib/store";

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource?: { id?: string; custom_id?: string; supplementary_data?: { related_ids?: { authorization_id?: string; order_id?: string } } };
}

/**
 * Idempotent webhook handling. Server responses are the source of truth, so webhooks
 * are used to (a) audit and (b) recover if a server crashed between PayPal and our DB.
 */
export async function handleWebhookEvent(ev: PayPalWebhookEvent): Promise<{ handled: boolean; duplicate: boolean }> {
  const store = getStore();
  const first = await store.markWebhookSeen(ev.id);
  if (!first) return { handled: false, duplicate: true };

  const authId = ev.resource?.supplementary_data?.related_ids?.authorization_id ?? ev.resource?.id;
  const customId = ev.resource?.custom_id;
  // Find the request by custom_id (we set it to the transfer request id).
  const req = customId ? await store.getRequest(customId) : null;
  if (!req) return { handled: false, duplicate: false };

  switch (ev.event_type) {
    case "PAYMENT.AUTHORIZATION.CREATED":
      await store.addEvent({ transfer_request_id: req.id, type: "webhook_authorization_created", payload: { authId } });
      break;
    case "PAYMENT.AUTHORIZATION.VOIDED":
      await store.addEvent({ transfer_request_id: req.id, type: "webhook_authorization_voided", payload: { authId } });
      break;
    case "PAYMENT.CAPTURE.COMPLETED":
      await store.addEvent({ transfer_request_id: req.id, type: "webhook_capture_completed", payload: { captureId: ev.resource?.id } });
      // Recovery: capture happened at PayPal but we never recorded it. Only record the id; "released" means the
      // payout to the recipient was accepted, which the next read/cron retry (capture -> payout) takes care of.
      if (["held", "awaiting_confirmation"].includes(req.status) && !req.paypal_capture_id && ev.resource?.id) {
        await store.updateRequest(req.id, { paypal_capture_id: ev.resource.id });
      }
      break;
    case "PAYMENT.CAPTURE.DENIED":
      await store.addEvent({ transfer_request_id: req.id, type: "webhook_capture_denied", payload: { captureId: ev.resource?.id } });
      break;
    default:
      return { handled: false, duplicate: false };
  }
  return { handled: true, duplicate: false };
}
