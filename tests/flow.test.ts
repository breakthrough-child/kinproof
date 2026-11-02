import { beforeEach, describe, expect, it } from "vitest";
import {
  authorizeOrder, cancelHeld, createAnalyzedRequest, createPayPalOrder, expireOverdue, getRequestView,
  OVERRIDE_PHRASE, overrideRelease, redirectToInstitution, respondToConfirmation, vouch, inboxFor,
} from "@/lib/services/transfers";
import { ADA, baseInput, CHIDI, freshWorld, NGOZI, OUTSIDER, SCAM } from "./helpers";
import type { MemoryStore } from "@/lib/store/memory";
import type { MockPayPalClient } from "@/lib/paypal/mock";

let store: MemoryStore;
let paypal: MockPayPalClient;
beforeEach(() => ({ store, paypal } = freshWorld()));

async function startHeld(input: Record<string, unknown>) {
  const { request } = await createAnalyzedRequest(ADA, baseInput(input));
  await createPayPalOrder(ADA, request.id);
  const held = await authorizeOrder(ADA, request.id);
  return held;
}

describe("scam path", () => {
  it("holds, Chidi denies, authorization voided", async () => {
    const held = await startHeld({ message: SCAM, amount: 800, payeeEmail: "scammer@evil.example" });
    expect(held.risk_level).toBe("high");
    expect(held.status).toBe("awaiting_confirmation");
    expect(await paypal.authStatus(held.paypal_authorization_id!)).toBe("CREATED"); // held, not captured
    const out = await respondToConfirmation(CHIDI, held.id, "denied");
    expect(out.status).toBe("blocked");
    expect(await paypal.authStatus(held.paypal_authorization_id!)).toBe("VOIDED");
    const events = (await store.listEvents(held.id)).map((e) => e.type);
    expect(events).toEqual(expect.arrayContaining(["request_created", "analyzed", "order_created", "authorized", "confirmation_requested", "denied", "voided"]));
  });
});

describe("genuine path", () => {
  it("high amount to verified payee: Chidi confirms, captured", async () => {
    const held = await startHeld({ message: "Mum I'm at St Luke's, they need a deposit.", amount: 350 });
    expect(held.status).toBe("awaiting_confirmation");
    const out = await respondToConfirmation(CHIDI, held.id, "confirmed");
    expect(out.status).toBe("released");
    expect(out.paypal_capture_id).toBeTruthy();
    expect(await paypal.authStatus(held.paypal_authorization_id!)).toBe("CAPTURED");
  });
  it("low risk, verified payee, under cap auto-releases", async () => {
    const held = await startHeld({ amount: 50 });
    expect(held.status).toBe("released");
  });
});

describe("authorization of the confirmation (core security property)", () => {
  it("sender, other member and outsider cannot confirm", async () => {
    const held = await startHeld({ message: SCAM, amount: 800, payeeEmail: "x@evil.example" });
    await expect(respondToConfirmation(ADA, held.id, "confirmed")).rejects.toMatchObject({ status: 403 });
    await expect(respondToConfirmation(NGOZI, held.id, "confirmed")).rejects.toMatchObject({ status: 403 });
    await expect(respondToConfirmation(OUTSIDER, held.id, "confirmed")).rejects.toMatchObject({ status: 404 });
    expect((await store.getRequest(held.id))!.status).toBe("awaiting_confirmation");
    expect(await paypal.authStatus(held.paypal_authorization_id!)).toBe("CREATED");
  });
  it("confirmation after expiry is rejected and the hold is voided", async () => {
    const held = await startHeld({ message: SCAM, amount: 800, payeeEmail: "x@evil.example" });
    await store.updateRequest(held.id, { confirm_expires_at: new Date(Date.now() - 1000).toISOString() });
    await expect(respondToConfirmation(CHIDI, held.id, "confirmed")).rejects.toMatchObject({ status: 409 });
    expect((await store.getRequest(held.id))!.status).toBe("expired");
    expect(await paypal.authStatus(held.paypal_authorization_id!)).toBe("VOIDED");
  });
  it("only the first answer wins under concurrency", async () => {
    const held = await startHeld({ message: SCAM, amount: 800, payeeEmail: "x@evil.example" });
    const res = await Promise.allSettled([respondToConfirmation(CHIDI, held.id, "confirmed"), respondToConfirmation(CHIDI, held.id, "denied")]);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const status = (await store.getRequest(held.id))!.status;
    const auth = await paypal.authStatus(held.paypal_authorization_id!);
    expect((status === "released" && auth === "CAPTURED") || (status === "blocked" && auth === "VOIDED")).toBe(true);
  });
  it("answering twice is a conflict", async () => {
    const held = await startHeld({ message: SCAM, amount: 800, payeeEmail: "x@evil.example" });
    await respondToConfirmation(CHIDI, held.id, "denied");
    await expect(respondToConfirmation(CHIDI, held.id, "confirmed")).rejects.toMatchObject({ status: 409 });
  });
  it("only the sender can start PayPal for a request; others cannot see it", async () => {
    const { request } = await createAnalyzedRequest(ADA, baseInput());
    await expect(createPayPalOrder(CHIDI, request.id)).rejects.toMatchObject({ status: 403 });
    await expect(getRequestView(OUTSIDER, request.id)).rejects.toMatchObject({ status: 404 });
  });
  it("cannot create a request in a circle you are not in", async () => {
    await expect(createAnalyzedRequest(OUTSIDER, baseInput())).rejects.toMatchObject({ status: 403 });
  });
  it("cannot claim to be yourself or someone outside the circle id space", async () => {
    await expect(createAnalyzedRequest(ADA, baseInput({ claimedMemberId: "member-ada" }))).rejects.toMatchObject({ status: 400 });
  });
});

describe("vouching", () => {
  it("another member vouches -> captured; sender and claimed cannot", async () => {
    const held = await startHeld({ message: "lost my phone, new number, send $400 urgent", amount: 400 });
    expect(held.status).toBe("awaiting_confirmation");
    await expect(vouch(ADA, held.id, "in_person", "x")).rejects.toMatchObject({ status: 403 });
    await expect(vouch(CHIDI, held.id, "in_person", "x")).rejects.toMatchObject({ status: 403 });
    await expect(vouch(OUTSIDER, held.id, "in_person", "x")).rejects.toMatchObject({ status: 404 });
    const out = await vouch(NGOZI, held.id, "called_known_number", "Called his old number, he is fine");
    expect(out.status).toBe("released");
    const conf = (await store.confirmationsForRequest(held.id))[0];
    expect(conf.response).toBe("vouched");
    expect(conf.vouching_member_id).toBe("member-ngozi");
  });
});

describe("expiry cron", () => {
  it("voids overdue authorizations", async () => {
    const held = await startHeld({ message: SCAM, amount: 800, payeeEmail: "x@evil.example" });
    expect(await expireOverdue()).toBe(0);
    await store.updateRequest(held.id, { confirm_expires_at: new Date(Date.now() - 5000).toISOString() });
    expect(await expireOverdue()).toBe(1);
    expect((await store.getRequest(held.id))!.status).toBe("expired");
    expect(await paypal.authStatus(held.paypal_authorization_id!)).toBe("VOIDED");
    expect(await expireOverdue()).toBe(0);
  });
  it("lazy expiry on read", async () => {
    const held = await startHeld({ message: SCAM, amount: 800, payeeEmail: "x@evil.example" });
    await store.updateRequest(held.id, { confirm_expires_at: new Date(Date.now() - 5000).toISOString() });
    const v = await getRequestView(ADA, held.id);
    expect(v.request.status).toBe("expired");
  });
});

describe("institution redirect", () => {
  it("voids the original and pays the verified hospital directly", async () => {
    const msg = "Mum I'm at the hospital, new number, don't tell Dad. They need $600 now.";
    const { request, institutionSuggestions } = await createAnalyzedRequest(ADA, baseInput({ message: msg, amount: 600, payeeEmail: "x@evil.example" }));
    expect(institutionSuggestions.map((i) => i.kind)).toContain("hospital");
    await createPayPalOrder(ADA, request.id);
    const held = await authorizeOrder(ADA, request.id);
    expect(held.status).toBe("awaiting_confirmation");
    const hospital = institutionSuggestions.find((i) => i.kind === "hospital")!;
    const { closed, next } = await redirectToInstitution(ADA, held.id, hospital.id);
    expect(closed.status).toBe("redirected");
    expect(await paypal.authStatus(held.paypal_authorization_id!)).toBe("VOIDED");
    await createPayPalOrder(ADA, next.id);
    const done = await authorizeOrder(ADA, next.id);
    expect(done.status).toBe("released");
    expect(done.payee_email).toBe(hospital.paypal_email);
    expect(done.redirected_from_id).toBe(held.id);
  });
  it("redirect only to verified directory entries, only by the sender", async () => {
    const { request } = await createAnalyzedRequest(ADA, baseInput({ message: SCAM, amount: 800, payeeEmail: "x@evil.example" }));
    await expect(redirectToInstitution(CHIDI, request.id, "inst-1")).rejects.toMatchObject({ status: 403 });
    await expect(redirectToInstitution(ADA, request.id, "nope")).rejects.toMatchObject({ status: 400 });
  });
});

describe("requester outside the circle", () => {
  const input = { claimedMemberId: null, claimedName: "Burna Boy", message: "This is Burna Boy, you won my giveaway, pay the $300 fee", amount: 300, payeeEmail: "fan@scam.example" };
  it("is held with cooling-off + explicit phrase", async () => {
    const { request } = await createAnalyzedRequest(ADA, baseInput(input));
    expect(request.risk_level).toBe("high");
    await createPayPalOrder(ADA, request.id);
    const held = await authorizeOrder(ADA, request.id);
    expect(held.status).toBe("held");
    expect(held.override_available_at).toBeTruthy();
    await expect(overrideRelease(ADA, held.id, OVERRIDE_PHRASE)).rejects.toMatchObject({ status: 425 });
    await store.updateRequest(held.id, { override_available_at: new Date(Date.now() - 1000).toISOString() });
    await expect(overrideRelease(ADA, held.id, "yes")).rejects.toMatchObject({ code: "bad_phrase" });
    await expect(overrideRelease(CHIDI, held.id, OVERRIDE_PHRASE)).rejects.toMatchObject({ status: 403 });
    expect((await overrideRelease(ADA, held.id, OVERRIDE_PHRASE)).status).toBe("released");
  });
  it("can be cancelled and the hold is voided", async () => {
    const { request } = await createAnalyzedRequest(ADA, baseInput(input));
    await createPayPalOrder(ADA, request.id);
    const held = await authorizeOrder(ADA, request.id);
    const out = await cancelHeld(ADA, held.id);
    expect(out.status).toBe("blocked");
    expect(await paypal.authStatus(held.paypal_authorization_id!)).toBe("VOIDED");
  });
  it("verified institution payee releases without confirmation", async () => {
    const inst = (await store.listInstitutions()).find((i) => i.kind === "hospital")!;
    const { request } = await createAnalyzedRequest(ADA, baseInput({ ...input, message: "hospital bill", payeeEmail: inst.paypal_email }));
    await createPayPalOrder(ADA, request.id);
    expect((await authorizeOrder(ADA, request.id)).status).toBe("released");
  });
});

describe("inbox", () => {
  it("shows pending confirmations only to the asked member", async () => {
    const held = await startHeld({ message: SCAM, amount: 800, payeeEmail: "x@evil.example" });
    expect((await inboxFor(CHIDI)).items.map((i) => i.request.id)).toEqual([held.id]);
    expect((await inboxFor(ADA)).items).toHaveLength(0);
    expect((await inboxFor(NGOZI)).items).toHaveLength(0);
    expect((await inboxFor(NGOZI)).vouchable.map((v) => v.request.id)).toEqual([held.id]);
  });
});
