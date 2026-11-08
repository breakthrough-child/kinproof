import { describe, expect, it } from "vitest";
import { eventLabel, possessive, statusLabel, type Viewer } from "@/lib/wording";
import type { RequestStatus } from "@/lib/types";

const sender: Viewer = { isSender: true, senderName: "Ada" };
const other: Viewer = { isSender: false, senderName: "Ada" };
const ALL: RequestStatus[] = ["draft", "analyzed", "awaiting_paypal_approval", "held", "awaiting_confirmation", "released", "blocked", "expired", "redirected"];

describe("viewer-aware wording", () => {
  it("names the sender for everyone else", () => {
    expect(statusLabel("awaiting_paypal_approval", sender)).toBe("Waiting for your PayPal approval");
    expect(statusLabel("awaiting_paypal_approval", other)).toBe("Waiting for Ada's PayPal approval");
    expect(statusLabel("blocked", other)).toBe("Stopped, Ada's money returned");
    expect(statusLabel("redirected", other)).toBe("Ada paid someone safer instead");
  });
  it("never says 'you/your' to a non-sender, for any status or event", () => {
    for (const s of ALL) expect(statusLabel(s, other)).not.toMatch(/\byou(r)?\b/i);
    for (const t of ["authorized", "held_no_confirmer", "voided", "override", "request_created", "analyzed", "paid_out", "captured"]) {
      expect(eventLabel(t, other) ?? "").not.toMatch(/\byou(r)?\b/i);
    }
  });
  it("keeps the sender's own wording for the sender", () => {
    expect(eventLabel("authorized", sender)).toMatch(/^You approved it in PayPal/);
    expect(eventLabel("voided", sender)).toBe("Hold released, money returned to you");
    expect(eventLabel("voided", other)).toBe("Hold released, money returned to Ada");
  });
  it("handles names ending in s", () => {
    expect(possessive("Chris")).toBe("Chris'");
  });
});
