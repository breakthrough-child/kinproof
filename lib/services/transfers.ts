import { z } from "zod";
import { config } from "@/lib/config";
import { getStore } from "@/lib/store";
import { getPayPal } from "@/lib/paypal";
import { analyze } from "@/lib/risk/analyze";
import { findInstitutionByEmail, normEmail, runRules } from "@/lib/risk/rules";
import { assertTransition, computeExpiry, confirmationExpired, decideAfterHeld } from "@/lib/flow/stateMachine";
import { notifyConfirmationSms } from "@/lib/notify";
import type { Institution, TransferRequest, VouchMethod } from "@/lib/types";
import type { MemberView } from "@/lib/store/types";
import { conflict, forbidden, notFound, ServiceError } from "./errors";

export const OVERRIDE_PHRASE = "I understand the risk and want to send this payment";

export const analyzeInputSchema = z.object({
  circleId: z.string().min(1),
  claimedMemberId: z.string().min(1).nullable(),
  claimedName: z.string().trim().max(80).optional(),
  channel: z.enum(["voice_note", "text", "call_summary"]),
  message: z.string().max(5000).default(""),
  transcript: z.string().max(10000).optional(),
  audioPath: z.string().max(300).optional(),
  amount: z.number().positive().max(10000),
  payeeEmail: z.string().trim().email().max(200),
});
export type AnalyzeRequestInput = z.infer<typeof analyzeInputSchema>;

// ---------- helpers ----------

async function memberForUser(userId: string, circleId: string): Promise<MemberView> {
  const ms = await getStore().membershipsForUser(userId);
  const m = ms.find((x) => x.circle_id === circleId);
  if (!m) throw forbidden("You are not in that circle.");
  return m;
}

async function loadRequestForMember(userId: string, requestId: string) {
  const store = getStore();
  const req = await store.getRequest(requestId);
  if (!req) throw notFound("Request not found.");
  const me = await memberForUser(userId, req.circle_id).catch(() => null);
  if (!me) throw notFound("Request not found."); // do not leak existence
  return { req, me };
}

async function loadAsSender(userId: string, requestId: string) {
  const { req, me } = await loadRequestForMember(userId, requestId);
  if (req.sender_member_id !== me.id) throw forbidden("Only the sender can do that.");
  return { req, me };
}

const INSTITUTION_KEYWORDS: [RegExp, Institution["kind"]][] = [
  [/hospital|clinic|surgery|ward|ambulance|doctor/i, "hospital"],
  [/school|college|university|tuition|fees/i, "school"],
  [/police|station|bail|officer|detained|arrest/i, "police"],
  [/lawyer|legal|barrister|court|attorney/i, "legal"],
];

export function suggestInstitutions(text: string, list: Institution[]): Institution[] {
  const t = text.toLowerCase();
  const out = new Map<string, Institution>();
  for (const i of list.filter((x) => x.verified)) {
    if ([i.name, ...i.aliases].some((a) => a && t.includes(a.toLowerCase()))) out.set(i.id, i);
  }
  for (const [re, kind] of INSTITUTION_KEYWORDS) {
    if (re.test(text)) for (const i of list.filter((x) => x.verified && x.kind === kind)) out.set(i.id, i);
  }
  // "police" kind has no demo entry; legal aid is the sensible alternative
  return [...out.values()].slice(0, 3);
}

async function event(requestId: string, type: string, actor: string | null, payload: Record<string, unknown> = {}) {
  await getStore().addEvent({ transfer_request_id: requestId, type, actor_member_id: actor, payload });
}

// ---------- 1. analyze ----------

export async function createAnalyzedRequest(userId: string, raw: unknown) {
  const input = analyzeInputSchema.parse(raw);
  const store = getStore();
  const cfg = config();
  const sender = await memberForUser(userId, input.circleId);

  let claimed: MemberView | null = null;
  if (input.claimedMemberId) {
    claimed = await store.getMember(input.claimedMemberId);
    if (!claimed || claimed.circle_id !== input.circleId) throw new ServiceError("That person is not in your circle.", 400);
    if (claimed.id === sender.id) throw new ServiceError("You can't be the person asking you.", 400);
  }
  const claimedName = claimed?.display_name ?? (input.claimedName || null);

  const institutions = await store.listInstitutions();
  const history = await store.releasedAmountsForSender(sender.id);
  const text = [input.message, input.transcript].filter(Boolean).join("\n");
  const profile = await store.getProfile(userId);

  const rules = runRules(
    { message: text, amount: input.amount, payeeEmail: input.payeeEmail, claimed, institutions, history },
    cfg.highAmountNoHistory,
  );
  const payeeInstitution = rules.payeeInstitution;
  const payeeKind: TransferRequest["payee_kind"] = payeeInstitution
    ? "institution"
    : claimed?.paypal_email && normEmail(claimed.paypal_email) === normEmail(input.payeeEmail)
      ? "claimed_member"
      : "other";

  const sorted = [...history].sort((a, b) => a - b);
  const result = await analyze({
    message: text,
    senderName: sender.display_name,
    claimedName,
    claimedRelationship: claimed?.relationship_label ?? null,
    amount: input.amount,
    currency: "USD",
    payeeEmail: input.payeeEmail,
    payeeDescription: payeeInstitution
      ? `verified institution: ${payeeInstitution.name}`
      : payeeKind === "claimed_member"
        ? "the verified PayPal account of the person asking"
        : "an unverified account that is NOT the verified account of the person asking",
    language: profile?.preferred_language ?? "en",
    rules,
    historyStats: { count: history.length, median: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null },
  });

  const draft = await store.createRequest({
    circle_id: input.circleId,
    sender_member_id: sender.id,
    claimed_requester_member_id: claimed?.id ?? null,
    claimed_requester_name: claimedName,
    channel: input.channel,
    raw_message: input.message,
    audio_path: input.audioPath ?? null,
    transcript: input.transcript ?? null,
    amount: input.amount,
    currency: "USD",
    payee_email: input.payeeEmail.trim(),
    payee_kind: payeeKind,
    institution_id: payeeInstitution?.id ?? null,
    rule_signals: rules.signals,
    ai_analysis: result.ai,
    risk_score: result.final.score,
    risk_level: result.final.level,
    status: "draft",
    paypal_order_id: null,
    paypal_authorization_id: null,
    paypal_capture_id: null,
    confirm_expires_at: null,
    override_available_at: null,
    redirected_from_id: null,
  });
  await event(draft.id, "request_created", sender.id);
  assertTransition("draft", "analyzed");
  const req = (await store.transition(draft.id, ["draft"], "analyzed"))!;
  await event(req.id, "analyzed", null, { risk_level: req.risk_level, risk_score: req.risk_score, ai_fallback: !!result.ai.fallback });

  const suggestions = req.risk_level === "low" ? [] : suggestInstitutions(text, institutions);
  return { request: req, institutionSuggestions: suggestions };
}

// ---------- 2. PayPal order + authorize ----------

export async function createPayPalOrder(userId: string, requestId: string) {
  const { req, me } = await loadAsSender(userId, requestId);
  const store = getStore();
  if (req.status === "awaiting_paypal_approval" && req.paypal_order_id) return { orderId: req.paypal_order_id, request: req };
  assertTransition(req.status, "awaiting_paypal_approval");
  const { orderId } = await getPayPal().createOrder({
    transferRequestId: req.id,
    amount: Number(req.amount),
    currency: req.currency,
    payeeEmail: req.payee_email,
    description: "Kinproof protected transfer",
  });
  const next = await store.transition(req.id, ["analyzed"], "awaiting_paypal_approval", { paypal_order_id: orderId });
  if (!next) throw conflict("This request changed. Please refresh.");
  await event(req.id, "order_created", me.id, { orderId });
  return { orderId, request: next };
}

/** Buyer approved in the PayPal popup -> authorize (hold) the funds. */
export async function authorizeOrder(userId: string, requestId: string) {
  const { req, me } = await loadAsSender(userId, requestId);
  const store = getStore();
  if (req.status !== "awaiting_paypal_approval" || !req.paypal_order_id) {
    if (["held", "awaiting_confirmation", "released"].includes(req.status)) return req; // idempotent
    throw conflict("This request is not waiting for PayPal approval.");
  }
  const auth = await getPayPal().authorizeOrder(req.paypal_order_id);
  const held = await store.transition(req.id, ["awaiting_paypal_approval"], "held", { paypal_authorization_id: auth.authorizationId });
  if (!held) return (await store.getRequest(req.id))!;
  await event(req.id, "authorized", me.id, { authorizationId: auth.authorizationId, note: "Funds are held, not captured." });
  return afterHeld(held);
}

async function afterHeld(req: TransferRequest): Promise<TransferRequest> {
  const store = getStore();
  const cfg = config();
  const claimed = req.claimed_requester_member_id ? await store.getMember(req.claimed_requester_member_id) : null;
  const decision = decideAfterHeld({
    riskLevel: req.risk_level,
    payeeIsClaimedMemberVerifiedEmail:
      req.payee_kind === "claimed_member" && !!claimed?.paypal_verified_at && normEmail(claimed.paypal_email ?? "") === normEmail(req.payee_email),
    amount: Number(req.amount),
    autoReleaseMax: cfg.autoReleaseMax,
    payeeIsVerifiedInstitution: req.payee_kind === "institution",
    claimedRequesterInCircle: !!claimed,
  });

  if (decision === "auto_release") {
    await event(req.id, "auto_release", null, { reason: req.payee_kind === "institution" ? "verified institution" : "low risk, verified payee" });
    return capture(req.id, null);
  }
  if (decision === "hold_no_confirmer") {
    const at = new Date(Date.now() + cfg.cooldownMinutes * 60_000).toISOString();
    await event(req.id, "held_no_confirmer", null, { override_available_at: at });
    return store.updateRequest(req.id, { override_available_at: at });
  }
  // ask the real person
  const expires = computeExpiry(new Date(), cfg.confirmWindowMinutes);
  assertTransition("held", "awaiting_confirmation");
  const next = await store.transition(req.id, ["held"], "awaiting_confirmation", { confirm_expires_at: expires });
  if (!next) return (await store.getRequest(req.id))!;
  await store.createConfirmation({ transfer_request_id: req.id, asked_member_id: claimed!.id });
  await event(req.id, "confirmation_requested", null, { asked_member_id: claimed!.id, expires_at: expires });
  const askedProfile = await store.getProfile(claimed!.user_id);
  void notifyConfirmationSms(askedProfile?.phone, req.id);
  return next;
}

// ---------- 3. capture / void ----------

async function capture(requestId: string, actor: string | null): Promise<TransferRequest> {
  const store = getStore();
  let req = (await store.getRequest(requestId))!;
  if (!req.paypal_authorization_id) throw conflict("No authorization to capture.");
  if (req.status === "released") return req;
  assertTransition(req.status, "released");
  // Step 1: capture the held funds into Kinproof's merchant account (skipped when a previous attempt already did).
  if (!req.paypal_capture_id) {
    try {
      const cap = await getPayPal().capture(req.paypal_authorization_id, `${req.id}:capture`);
      req = await store.updateRequest(req.id, { paypal_capture_id: cap.captureId });
      await event(req.id, "captured", actor, { captureId: cap.captureId });
    } catch (e) {
      await event(req.id, "capture_failed", actor, { error: (e as Error).message });
      throw new ServiceError("PayPal could not complete the payment. Nothing was lost; the money stays on hold.", 502, "paypal_error");
    }
  }
  // Step 2: forward to the final recipient. Idempotent per request, so a retry after a failure is safe.
  try {
    const out = await getPayPal().payout({ transferRequestId: req.id, receiverEmail: req.payee_email, amount: Number(req.amount), currency: req.currency });
    const next = await store.transition(req.id, [req.status], "released");
    await event(req.id, "paid_out", actor, { payoutBatchId: out.payoutBatchId, status: out.status });
    return next ?? (await store.getRequest(req.id))!;
  } catch (e) {
    await event(req.id, "payout_failed", actor, { error: (e as Error).message });
    throw new ServiceError("The payment was collected but could not be sent to the recipient yet. It will be retried; nothing is lost.", 502, "paypal_error");
  }
}

async function voidAuth(req: TransferRequest, to: "blocked" | "expired" | "redirected", actor: string | null, why: string, patch: Partial<TransferRequest> = {}) {
  const store = getStore();
  assertTransition(req.status, to);
  try {
    if (req.paypal_authorization_id) await getPayPal().void(req.paypal_authorization_id, `${req.id}:void`);
  } catch (e) {
    await event(req.id, "void_failed", actor, { error: (e as Error).message });
    throw new ServiceError("PayPal could not release the hold right now. Please try again.", 502, "paypal_error");
  }
  const next = await store.transition(req.id, [req.status], to, patch);
  await event(req.id, "voided", actor, { reason: why, to });
  return next ?? (await store.getRequest(req.id))!;
}

// ---------- 4. confirmation (core security property) ----------

export async function respondToConfirmation(userId: string, requestId: string, answer: "confirmed" | "denied") {
  const store = getStore();
  const req = await store.getRequest(requestId);
  if (!req) throw notFound("Request not found.");
  if (!(await memberForUser(userId, req.circle_id).catch(() => null))) throw notFound("Request not found.");
  const confs = await store.confirmationsForRequest(requestId);
  const mine = confs.find((c) => c.response === null);
  if (!mine) throw conflict("This request is not waiting for an answer.");
  const asked = await store.getMember(mine.asked_member_id);
  // CORE CHECK: the authenticated user must BE the asked member.
  if (!asked || asked.user_id !== userId) throw forbidden("Only the person being asked can answer this.");
  const sender = await store.getMember(req.sender_member_id);
  if (sender && sender.user_id === userId) throw forbidden("You can't confirm your own request.");
  if (req.status !== "awaiting_confirmation") throw conflict("This request is no longer waiting for an answer.");
  if (confirmationExpired(req.confirm_expires_at)) {
    await expireOne(req);
    throw conflict("Too late: this request expired and the money was returned.");
  }
  const won = await store.respondConfirmation(mine.id, { response: answer });
  if (!won) throw conflict("This request was already answered.");
  await event(requestId, answer === "confirmed" ? "confirmed" : "denied", asked.id);
  if (answer === "confirmed") return capture(requestId, asked.id);
  return voidAuth(req, "blocked", asked.id, "denied by the real person");
}

/** A different circle member vouches (e.g. called a known number / met in person). */
export async function vouch(userId: string, requestId: string, method: VouchMethod, note: string) {
  const store = getStore();
  const { req, me } = await loadRequestForMember(userId, requestId);
  if (req.status !== "awaiting_confirmation") throw conflict("This request is not waiting for an answer.");
  if (me.id === req.sender_member_id) throw forbidden("The sender can't vouch for their own request.");
  if (me.id === req.claimed_requester_member_id) throw forbidden("Use the confirm button instead.");
  if (confirmationExpired(req.confirm_expires_at)) {
    await expireOne(req);
    throw conflict("Too late: this request expired.");
  }
  const confs = await store.confirmationsForRequest(requestId);
  const pending = confs.find((c) => c.response === null);
  if (!pending) throw conflict("This request was already answered.");
  const won = await store.respondConfirmation(pending.id, {
    response: "vouched",
    vouching_member_id: me.id,
    vouch_method: method,
    vouch_note: note.slice(0, 500),
  });
  if (!won) throw conflict("This request was already answered.");
  await event(requestId, "vouched", me.id, { method, note: note.slice(0, 500) });
  return capture(requestId, me.id);
}

// ---------- 5. expiry ----------

async function expireOne(req: TransferRequest) {
  const store = getStore();
  const confs = await store.confirmationsForRequest(req.id);
  const pending = confs.find((c) => c.response === null);
  if (pending) await store.respondConfirmation(pending.id, { response: "expired" });
  return voidAuth(req, "expired", null, "no answer before the window closed");
}

export async function expireOverdue(now = new Date()) {
  const overdue = await getStore().expiredAwaiting(now.toISOString());
  let n = 0;
  for (const r of overdue) {
    try {
      // A confirmed request whose payout failed has already been captured: retry the payout, never void.
      if (r.paypal_capture_id) await capture(r.id, null);
      else await expireOne(r);
      n++;
    } catch (e) {
      console.error("[kinproof] expire failed", r.id, (e as Error).message);
    }
  }
  return n;
}

// ---------- 6. redirect to a verified institution ----------

export async function redirectToInstitution(userId: string, requestId: string, institutionId: string) {
  const store = getStore();
  const { req, me } = await loadAsSender(userId, requestId);
  if (!["analyzed", "held", "awaiting_confirmation"].includes(req.status)) throw conflict("This request can't be redirected now.");
  const inst = await store.getInstitution(institutionId);
  if (!inst || !inst.verified) throw new ServiceError("That institution is not in the verified directory.", 400);

  const closed = await voidAuth(req, "redirected", me.id, `redirected to ${inst.name}`);
  const confs = await store.confirmationsForRequest(req.id);
  const pending = confs.find((c) => c.response === null);
  if (pending) await store.respondConfirmation(pending.id, { response: "expired" });

  const institutions = await store.listInstitutions();
  const rules = runRules({ message: "", amount: Number(req.amount), payeeEmail: inst.paypal_email, claimed: null, institutions, history: [] });
  const fresh = await store.createRequest({
    circle_id: req.circle_id,
    sender_member_id: req.sender_member_id,
    claimed_requester_member_id: req.claimed_requester_member_id,
    claimed_requester_name: req.claimed_requester_name,
    channel: req.channel,
    raw_message: req.raw_message,
    audio_path: req.audio_path,
    transcript: req.transcript,
    amount: Number(req.amount),
    currency: req.currency,
    payee_email: inst.paypal_email,
    payee_kind: "institution",
    institution_id: inst.id,
    rule_signals: rules.signals,
    ai_analysis: req.ai_analysis,
    risk_score: 0,
    risk_level: "low",
    status: "draft",
    paypal_order_id: null,
    paypal_authorization_id: null,
    paypal_capture_id: null,
    confirm_expires_at: null,
    override_available_at: null,
    redirected_from_id: req.id,
  });
  await event(fresh.id, "request_created", me.id, { redirected_from: req.id, institution: inst.name });
  await store.transition(fresh.id, ["draft"], "analyzed");
  await event(fresh.id, "analyzed", null, { note: "Direct payment to a verified institution" });
  await event(req.id, "redirected", me.id, { to_request: fresh.id, institution: inst.name });
  return { closed, next: (await store.getRequest(fresh.id))! };
}

// ---------- 7. override (no one to confirm with) ----------

export async function overrideRelease(userId: string, requestId: string, phrase: string) {
  const { req, me } = await loadAsSender(userId, requestId);
  if (req.status !== "held" || !req.override_available_at) throw conflict("This request can't be released that way.");
  if (new Date(req.override_available_at).getTime() > Date.now()) {
    throw new ServiceError("Please wait for the cooling-off period to finish before sending.", 425, "cooling_off");
  }
  if (phrase.trim() !== OVERRIDE_PHRASE) throw new ServiceError("The confirmation phrase did not match.", 400, "bad_phrase");
  await event(req.id, "override", me.id, { note: "Sender released after cooling-off" });
  return capture(req.id, me.id);
}

/** Sender abandons a held request: money returns. */
export async function cancelHeld(userId: string, requestId: string) {
  const { req, me } = await loadAsSender(userId, requestId);
  if (!["held", "awaiting_confirmation"].includes(req.status)) throw conflict("This request can't be cancelled now.");
  const confs = await getStore().confirmationsForRequest(req.id);
  const pending = confs.find((c) => c.response === null);
  if (pending) await getStore().respondConfirmation(pending.id, { response: "expired" });
  return voidAuth(req, "blocked", me.id, "cancelled by sender");
}

// ---------- reads ----------

export async function getRequestView(userId: string, requestId: string) {
  const store = getStore();
  let { req } = await loadRequestForMember(userId, requestId);
  // lazy expiry
  if (req.status === "awaiting_confirmation" && !req.paypal_capture_id && confirmationExpired(req.confirm_expires_at)) {
    req = await expireOne(req).catch(() => req);
  }
  // reconcile a confirmed answer whose capture failed earlier
  if (req.status === "awaiting_confirmation" || req.status === "held") {
    const confs = await store.confirmationsForRequest(req.id);
    if (req.paypal_capture_id || confs.some((c) => c.response === "confirmed" || c.response === "vouched")) req = await capture(req.id, null).catch(() => req);
  }
  const [events, confs, members, institutions] = await Promise.all([
    store.listEvents(req.id),
    store.confirmationsForRequest(req.id),
    store.circleMembers(req.circle_id),
    store.listInstitutions(),
  ]);
  const me = members.find((m) => m.user_id === userId)!;
  const text = [req.raw_message, req.transcript].filter(Boolean).join("\n");
  return {
    request: req,
    events,
    confirmations: confs,
    members,
    me,
    institution: institutions.find((i) => i.id === req.institution_id) ?? null,
    institutionSuggestions: req.risk_level === "low" || req.status === "released" ? [] : suggestInstitutions(text, institutions),
    redirectOffer: ["analyzed", "held", "awaiting_confirmation"].includes(req.status),
    overrideRequired: req.status === "held" && !!req.override_available_at,
    overridePhrase: OVERRIDE_PHRASE,
    isSender: req.sender_member_id === me.id,
    isAsked: confs.some((c) => c.asked_member_id === me.id && c.response === null),
  };
}

export async function inboxFor(userId: string) {
  const store = getStore();
  const ms = await store.membershipsForUser(userId);
  const myIds = ms.map((m) => m.id);
  const pending = await store.pendingConfirmationsForMembers(myIds);
  const items = [];
  for (const c of pending) {
    const r = await store.getRequest(c.transfer_request_id);
    if (!r) continue;
    if (r.status === "awaiting_confirmation" && confirmationExpired(r.confirm_expires_at)) {
      await expireOne(r).catch(() => null);
      continue;
    }
    if (r.status !== "awaiting_confirmation") continue;
    const sender = await store.getMember(r.sender_member_id);
    items.push({ confirmation: c, request: r, senderName: sender?.display_name ?? "Someone" });
  }
  // vouch candidates: awaiting requests in my circles that are not about/for me
  const circleIds = [...new Set(ms.map((m) => m.circle_id))];
  const circleReqs = (await store.requestsForCircles(circleIds, 30)).filter((r) => r.status === "awaiting_confirmation");
  const vouchable = [];
  for (const r of circleReqs) {
    const me = ms.find((m) => m.circle_id === r.circle_id)!;
    if (me.id === r.sender_member_id || me.id === r.claimed_requester_member_id) continue;
    const sender = await store.getMember(r.sender_member_id);
    vouchable.push({ request: r, senderName: sender?.display_name ?? "Someone" });
  }
  return { items, vouchable, memberIds: myIds };
}

export async function listMyRequests(userId: string) {
  const store = getStore();
  const ms = await store.membershipsForUser(userId);
  const requests = await store.requestsForCircles([...new Set(ms.map((m) => m.circle_id))], 30);
  // Names and "is this me" so the list can be worded from the viewer's point of view.
  const senders: Record<string, { name: string; isMe: boolean }> = {};
  for (const id of new Set(requests.map((r) => r.sender_member_id))) {
    const m = await store.getMember(id);
    senders[id] = { name: m?.display_name ?? "Someone", isMe: ms.some((x) => x.id === id) };
  }
  return { requests, senders };
}

export { findInstitutionByEmail };
