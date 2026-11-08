export const normEmail = (e: string | null | undefined): string => (e ?? "").trim().toLowerCase();

/** True when a circle member is claimed, they have a verified PayPal email, and the typed payee is something else. */
export function payeeMismatch(claimedVerifiedEmail: string | null | undefined, payee: string): boolean {
  return !!claimedVerifiedEmail && !!payee.trim() && normEmail(claimedVerifiedEmail) !== normEmail(payee);
}

/**
 * When the person asking changes, move the prefill with them, but never overwrite an address Ada typed herself:
 * only replace the payee if it is empty or still equals the previous member's prefilled email.
 */
export function nextPayee(current: string, prevEmail: string | null, nextEmail: string | null): string {
  if (!current.trim() || (prevEmail && normEmail(current) === normEmail(prevEmail))) return nextEmail ?? "";
  return current;
}
