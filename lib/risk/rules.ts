import { PHRASES, type PhraseGroup } from "./phrases";
import type { Institution, RiskLevel, RuleSignal } from "@/lib/types";

export const MEDIUM_AT = 30;
export const HIGH_AT = 65;

export interface RulesInput {
  message: string;
  amount: number;
  payeeEmail: string;
  /** The circle member the message claims to be from (null = outside the circle). */
  claimed: { paypal_email: string | null; paypal_verified_at: string | null } | null;
  institutions: Institution[];
  /** Past released amounts for this sender (USD). */
  history: number[];
}

export interface RulesResult {
  signals: RuleSignal[];
  score: number;
  level: RiskLevel;
  payeeInstitution: Institution | null;
  claimsPublicFigure: boolean;
}

const compiled = new Map<PhraseGroup, RegExp[]>();
function patterns(group: PhraseGroup): RegExp[] {
  let p = compiled.get(group);
  if (!p) {
    p = PHRASES[group].map((s) => new RegExp(s, "i"));
    compiled.set(group, p);
  }
  return p;
}

export function matchGroup(text: string, group: PhraseGroup): string | null {
  for (const re of patterns(group)) {
    const m = re.exec(text);
    if (m) return m[0];
  }
  return null;
}

export function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function levelFor(score: number): RiskLevel {
  return score >= HIGH_AT ? "high" : score >= MEDIUM_AT ? "medium" : "low";
}

export function normEmail(e: string): string {
  return e.trim().toLowerCase();
}

export function findInstitutionByEmail(list: Institution[], email: string): Institution | null {
  const n = normEmail(email);
  return list.find((i) => i.verified && normEmail(i.paypal_email) === n) ?? null;
}

export function runRules(input: RulesInput, highAmountNoHistory = 300): RulesResult {
  const text = input.message;
  const signals: RuleSignal[] = [];
  const add = (id: string, weight: number, evidence: string) => signals.push({ id, weight, evidence });

  const payeeInstitution = findInstitutionByEmail(input.institutions, input.payeeEmail);

  // Identity / payee
  if (input.claimed) {
    if (!input.claimed.paypal_verified_at) {
      add("claimed_unverified", 20, "The person this message claims to be has not linked a verified PayPal yet.");
    } else if (
      !payeeInstitution &&
      input.claimed.paypal_email &&
      normEmail(input.claimed.paypal_email) !== normEmail(input.payeeEmail)
    ) {
      add(
        "payee_mismatch",
        45,
        "The PayPal email you are paying is not the verified PayPal account of the person asking.",
      );
    }
  } else if (!payeeInstitution) {
    add("unverifiable_requester", 20, "The person asking is not in your circle, so they cannot be checked.");
  }

  // Amount
  const med = median(input.history);
  if (med !== null && med > 0) {
    if (input.amount > 3 * med) {
      add("amount_anomaly", 25, `Amount is more than 3x your usual transfer (median $${med.toFixed(0)}).`);
    }
  } else if (input.amount > highAmountNoHistory) {
    add("amount_anomaly", 25, `Large amount with no transfer history (over $${highAmountNoHistory}).`);
  }

  // Language
  const groups: [PhraseGroup, string, number, string][] = [
    ["urgency", "urgency", 20, "Pressure to act immediately."],
    ["secrecy", "secrecy", 25, "Asks you to keep this secret."],
    ["newNumber", "new_number", 25, "Claims a new number or a lost phone."],
    ["thirdParty", "third_party", 25, "A third party (lawyer, officer, agent) is involved."],
    ["giftOrCrypto", "gift_or_crypto", 40, "Gift cards, crypto or a wire service was mentioned."],
    ["codes", "code_request", 40, "Asks for a code, OTP or password."],
    ["injection", "instruction_injection", 50, "The message contains instructions aimed at an AI checker."],
  ];
  for (const [group, id, weight, why] of groups) {
    const hit = matchGroup(text, group);
    if (hit) add(id, weight, `${why} ("${hit}")`);
  }

  // Public figure / brand
  const pfHit = matchGroup(text, "publicFigure");
  const claimsPublicFigure = !!pfHit;
  if (pfHit && !(payeeInstitution && ["public_figure", "brand"].includes(payeeInstitution.kind))) {
    add(
      "public_figure_unverified",
      55,
      `Claims a celebrity, prize or brand link ("${pfHit}") but the payee is not in the verified directory.`,
    );
  }

  const score = Math.min(100, signals.reduce((a, s) => a + s.weight, 0));
  return { signals, score, level: levelFor(score), payeeInstitution, claimsPublicFigure };
}

/** The AI can raise risk but never lower it below the rules floor. */
export function applyFloor(
  rules: { score: number; level: RiskLevel },
  ai: { risk_score: number } | null,
): { score: number; level: RiskLevel } {
  const score = Math.max(rules.score, ai?.risk_score ?? 0);
  const level = levelFor(score);
  return { score, level };
}
