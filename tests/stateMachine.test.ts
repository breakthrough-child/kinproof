import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  computeExpiry,
  confirmationExpired,
  decideAfterHeld,
  InvalidTransitionError,
} from "@/lib/flow/stateMachine";
import type { RequestStatus } from "@/lib/types";

describe("state machine", () => {
  it("allows the happy path", () => {
    const path: RequestStatus[] = ["draft", "analyzed", "awaiting_paypal_approval", "held", "awaiting_confirmation", "released"];
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });
  it("allows auto-release straight from held", () => expect(canTransition("held", "released")).toBe(true));
  it("allows block / expire / redirect from awaiting_confirmation", () => {
    for (const t of ["blocked", "expired", "redirected"] as const) expect(canTransition("awaiting_confirmation", t)).toBe(true);
  });
  it("terminal states have no exits", () => {
    for (const s of ["released", "blocked", "expired", "redirected"] as const)
      for (const t of ["draft", "analyzed", "held", "released", "blocked"] as const) expect(canTransition(s, t)).toBe(false);
  });
  it("rejects invalid transitions with an error", () => {
    expect(() => assertTransition("draft", "released")).toThrow(InvalidTransitionError);
    expect(() => assertTransition("analyzed", "held")).toThrow();
    expect(() => assertTransition("blocked", "released")).toThrow();
  });
  it("decideAfterHeld: low risk verified payee under cap auto-releases", () => {
    expect(
      decideAfterHeld({ riskLevel: "low", payeeIsClaimedMemberVerifiedEmail: true, amount: 50, autoReleaseMax: 200, payeeIsVerifiedInstitution: false, claimedRequesterInCircle: true }),
    ).toBe("auto_release");
  });
  it("decideAfterHeld: amount at/over cap asks the member", () => {
    expect(
      decideAfterHeld({ riskLevel: "low", payeeIsClaimedMemberVerifiedEmail: true, amount: 200, autoReleaseMax: 200, payeeIsVerifiedInstitution: false, claimedRequesterInCircle: true }),
    ).toBe("ask_member");
  });
  it("decideAfterHeld: medium risk asks the member", () => {
    expect(
      decideAfterHeld({ riskLevel: "medium", payeeIsClaimedMemberVerifiedEmail: true, amount: 10, autoReleaseMax: 200, payeeIsVerifiedInstitution: false, claimedRequesterInCircle: true }),
    ).toBe("ask_member");
  });
  it("decideAfterHeld: outside circle holds unless verified institution", () => {
    const base = { riskLevel: "high" as const, payeeIsClaimedMemberVerifiedEmail: false, amount: 100, autoReleaseMax: 200, claimedRequesterInCircle: false };
    expect(decideAfterHeld({ ...base, payeeIsVerifiedInstitution: false })).toBe("hold_no_confirmer");
    expect(decideAfterHeld({ ...base, payeeIsVerifiedInstitution: true })).toBe("auto_release");
  });
  it("expiry logic", () => {
    const now = new Date("2026-11-02T10:00:00Z");
    const exp = computeExpiry(now, 15);
    expect(exp).toBe("2026-11-02T10:15:00.000Z");
    expect(confirmationExpired(exp, new Date("2026-11-02T10:14:59Z"))).toBe(false);
    expect(confirmationExpired(exp, new Date("2026-11-02T10:15:00Z"))).toBe(true);
    expect(confirmationExpired(null, now)).toBe(false);
  });
});
