import { describe, expect, it } from "vitest";
import { nextPayee, payeeMismatch } from "@/lib/payee";

describe("payee prefill and warning", () => {
  it("warns only for a verified member and a different address", () => {
    expect(payeeMismatch("chidi@x.test", "scam@evil.test")).toBe(true);
    expect(payeeMismatch("chidi@x.test", " Chidi@X.test ")).toBe(false);
    expect(payeeMismatch("chidi@x.test", "")).toBe(false);
    expect(payeeMismatch(null, "scam@evil.test")).toBe(false);
  });
  it("moves the prefill when the asker changes, but keeps a typed address", () => {
    expect(nextPayee("", null, "ngozi@x.test")).toBe("ngozi@x.test");
    expect(nextPayee("chidi@x.test", "chidi@x.test", "ngozi@x.test")).toBe("ngozi@x.test");
    expect(nextPayee("scam@evil.test", "chidi@x.test", "ngozi@x.test")).toBe("scam@evil.test");
    expect(nextPayee("chidi@x.test", "chidi@x.test", null)).toBe("");
  });
});
