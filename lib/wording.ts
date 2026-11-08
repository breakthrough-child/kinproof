import type { RequestStatus } from "@/lib/types";

/** Who is looking at a request. Copy is written from the viewer's point of view, never the sender's by default. */
export interface Viewer {
  isSender: boolean;
  senderName: string;
}

export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

/** "your" for the sender, "Ada's" for anyone else. */
export function their(v: Viewer): string {
  return v.isSender ? "your" : possessive(v.senderName);
}

/** "You" for the sender, "Ada" for anyone else. */
export function subject(v: Viewer): string {
  return v.isSender ? "You" : v.senderName;
}

export function statusLabel(status: RequestStatus | string, v: Viewer): string {
  switch (status) {
    case "draft": return "Draft";
    case "analyzed": return "Checked";
    case "awaiting_paypal_approval": return v.isSender ? "Waiting for your PayPal approval" : `Waiting for ${possessive(v.senderName)} PayPal approval`;
    case "held": return "Money on hold";
    case "awaiting_confirmation": return "Waiting for the real person";
    case "released": return "Sent";
    case "blocked": return v.isSender ? "Stopped, money returned" : `Stopped, ${possessive(v.senderName)} money returned`;
    case "expired": return v.isSender ? "Expired, money returned" : `Expired, ${possessive(v.senderName)} money returned`;
    case "redirected": return v.isSender ? "Paid someone safer instead" : `${v.senderName} paid someone safer instead`;
    default: return String(status).replace(/_/g, " ");
  }
}

export function eventLabel(type: string, v: Viewer): string | null {
  switch (type) {
    case "request_created": return "Request started";
    case "analyzed": return "Kinproof checked the message";
    case "order_created": return "PayPal payment prepared";
    case "authorized": return `${subject(v)} approved it in PayPal. The money is on hold, not sent`;
    case "auto_release": return "Low risk to a verified account: sending now";
    case "held_no_confirmer": return `Held: there is nobody in ${v.isSender ? "your" : possessive(v.senderName)} circle to confirm with`;
    case "confirmation_requested": return "Asked the real person to confirm";
    case "confirmed": return "The real person said: Yes, it was me";
    case "denied": return "The real person said: No, that wasn't me";
    case "vouched": return "Another family member vouched for it";
    case "captured": return "Payment collected by Kinproof";
    case "paid_out": return "Payment sent to the recipient";
    case "payout_failed": return "Couldn't send to the recipient yet, will retry (the money is safe)";
    case "voided": return v.isSender ? "Hold released, money returned to you" : `Hold released, money returned to ${v.senderName}`;
    case "redirected": return "Paying a verified organisation instead";
    case "override": return `${subject(v)} chose to send after the cooling-off period`;
    case "capture_failed": return "PayPal couldn't complete the payment, money stays on hold";
    case "void_failed": return "PayPal couldn't release the hold yet, will retry";
    default: return null;
  }
}
