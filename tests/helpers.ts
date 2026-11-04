import { MemoryStore } from "@/lib/store/memory";
import { setStore } from "@/lib/store";
import { MockPayPalClient } from "@/lib/paypal/mock";
import { setPayPal } from "@/lib/paypal";

export const ADA = "user-ada";
export const CHIDI = "user-chidi";
export const NGOZI = "user-ngozi";
export const OUTSIDER = "user-outsider";
export const CIRCLE = "circle-okafors";

export function freshWorld() {
  process.env.LLM_PROVIDER = "mock";
  process.env.PAYPAL_MODE = "mock";
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  const store = new MemoryStore();
  setStore(store);
  const paypal = new MockPayPalClient(store);
  setPayPal(paypal);
  return { store, paypal };
}

export const SCAM =
  "Mum it's me, my phone fell so this is my new number. I'm in an accident, don't tell Dad. The lawyer will call you, send $800 right now to this account.";

export const baseInput = (over: Record<string, unknown> = {}) => ({
  circleId: CIRCLE,
  claimedMemberId: "member-chidi",
  channel: "text" as const,
  message: "Hi Mum, small help please.",
  amount: 50,
  payeeEmail: process.env.DEMO_CHIDI_PAYPAL_EMAIL || "chidi@personal.example.com",
  ...over,
});
