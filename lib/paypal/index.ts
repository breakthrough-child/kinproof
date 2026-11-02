import { config } from "@/lib/config";
import { getStore } from "@/lib/store";
import { MockPayPalClient } from "./mock";
import { SandboxPayPalClient } from "./sandbox";
import type { PayPalClient } from "./types";

const g = globalThis as unknown as { __kinproofPaypal?: PayPalClient };

export function getPayPal(): PayPalClient {
  if (!g.__kinproofPaypal) {
    g.__kinproofPaypal = config().paypalMode === "sandbox" ? new SandboxPayPalClient() : new MockPayPalClient(getStore());
  }
  return g.__kinproofPaypal;
}

export function setPayPal(c: PayPalClient | undefined) {
  g.__kinproofPaypal = c;
}

export type { PayPalClient } from "./types";
