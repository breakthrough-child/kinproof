import type { RequestStatus } from "@/lib/types";

export const TERMINAL: RequestStatus[] = ["released", "blocked", "expired", "redirected"];

/**
 * Allowed transitions. `held` -> `released` is the auto-release (low risk) path;
 * `held` -> `held` is not allowed. `awaiting_confirmation` may go to `redirected`
 * (pay institution instead) and `held` is the resting state for requests whose
 * claimed requester is outside the circle (no one to confirm with).
 */
const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  draft: ["analyzed"],
  analyzed: ["awaiting_paypal_approval", "redirected"],
  awaiting_paypal_approval: ["held", "analyzed", "expired"],
  held: ["awaiting_confirmation", "released", "blocked", "redirected", "expired"],
  awaiting_confirmation: ["released", "blocked", "expired", "redirected"],
  released: [],
  blocked: [],
  expired: [],
  redirected: [],
};

export class InvalidTransitionError extends Error {
  constructor(
    public from: RequestStatus,
    public to: RequestStatus,
  ) {
    super(`Invalid transition ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: RequestStatus, to: RequestStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

export function isTerminal(s: RequestStatus): boolean {
  return TERMINAL.includes(s);
}

export interface HeldDecisionInput {
  riskLevel: "low" | "medium" | "high";
  payeeIsClaimedMemberVerifiedEmail: boolean;
  amount: number;
  autoReleaseMax: number;
  payeeIsVerifiedInstitution: boolean;
  claimedRequesterInCircle: boolean;
}

export type HeldDecision = "auto_release" | "ask_member" | "hold_no_confirmer";

/** What to do right after the authorization succeeds. */
export function decideAfterHeld(i: HeldDecisionInput): HeldDecision {
  // A verified institution cannot be a scammer's account: safe fast path.
  if (i.payeeIsVerifiedInstitution) return "auto_release";
  // Nobody to confirm with: keep held, require cooling-off + explicit override.
  if (!i.claimedRequesterInCircle) return "hold_no_confirmer";
  if (
    i.riskLevel === "low" &&
    i.payeeIsClaimedMemberVerifiedEmail &&
    i.amount < i.autoReleaseMax
  ) {
    return "auto_release";
  }
  return "ask_member";
}

export function confirmationExpired(expiresAt: string | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= now.getTime();
}

export function computeExpiry(now: Date, windowMinutes: number): string {
  return new Date(now.getTime() + windowMinutes * 60_000).toISOString();
}
