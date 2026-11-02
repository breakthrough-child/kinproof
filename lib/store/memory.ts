import { randomUUID } from "node:crypto";
import type {
  Circle,
  CircleMember,
  Confirmation,
  EventRow,
  Institution,
  Profile,
  RequestStatus,
  TransferRequest,
} from "@/lib/types";
import type { MemberView, NewRequest, Store } from "./types";
import { DEMO, demoEmail } from "./seed";

const now = () => new Date().toISOString();

export class MemoryStore implements Store {
  profiles = new Map<string, Profile>();
  circles = new Map<string, Circle>();
  members = new Map<string, CircleMember>();
  institutions = new Map<string, Institution>();
  requests = new Map<string, TransferRequest>();
  confirmations = new Map<string, Confirmation>();
  events: EventRow[] = [];
  webhooks = new Set<string>();
  kv = new Map<string, unknown>();

  /** Stable ids so demo sign-in works across restarts. */
  static userId(key: string) {
    return `user-${key}`;
  }

  constructor(seed = true) {
    if (seed) this.seed();
  }

  seed() {
    const circleId = "circle-okafors";
    this.circles.set(circleId, {
      id: circleId, name: DEMO.circleName, created_by: MemoryStore.userId("ada"), invite_code: DEMO.inviteCode, created_at: now(),
    });
    for (const u of DEMO.users) {
      const uid = MemoryStore.userId(u.key);
      this.profiles.set(uid, { id: uid, display_name: u.name, preferred_language: u.key === "ada" ? "en" : "en", large_text: u.key === "ada", phone: null, created_at: now() });
      this.members.set(`member-${u.key}`, {
        id: `member-${u.key}`, circle_id: circleId, user_id: uid, relationship_label: u.label, role: u.role,
        paypal_payer_id: `PAYER_${u.key.toUpperCase()}`, paypal_email: demoEmail(u), paypal_verified_at: now(), joined_at: now(),
      });
    }
    DEMO.institutions.forEach((i, idx) => {
      const id = `inst-${idx + 1}`;
      this.institutions.set(id, { id, name: i.name, kind: i.kind, city: i.city, country: "NG", paypal_email: demoEmail(i), aliases: i.aliases, verified: true, notes: "Demo sandbox business account" });
    });
    DEMO.historyAmounts.forEach((amount, idx) => {
      const id = `hist-${idx + 1}`;
      const t = new Date(Date.now() - (idx + 2) * 86400_000).toISOString();
      this.requests.set(id, {
        id, circle_id: circleId, sender_member_id: "member-ada", claimed_requester_member_id: "member-chidi", claimed_requester_name: "Chidi",
        channel: "text", raw_message: "Mum, small help for textbooks please.", audio_path: null, transcript: null, amount, currency: "USD",
        payee_email: demoEmail(DEMO.users[1]), payee_kind: "claimed_member", institution_id: null, rule_signals: [], ai_analysis: null,
        risk_score: 0, risk_level: "low", status: "released", paypal_order_id: null, paypal_authorization_id: null, paypal_capture_id: null,
        confirm_expires_at: null, override_available_at: null, redirected_from_id: null, created_at: t, updated_at: t,
      });
    });
  }

  private view(m: CircleMember): MemberView {
    return { ...m, display_name: this.profiles.get(m.user_id)?.display_name ?? "Member" };
  }

  async getProfile(id: string) { return this.profiles.get(id) ?? null; }
  async upsertProfile(p: Partial<Profile> & { id: string }) {
    const cur = this.profiles.get(p.id) ?? { id: p.id, display_name: "Member", preferred_language: "en" as const, large_text: false, phone: null, created_at: now() };
    const next = { ...cur, ...p };
    this.profiles.set(p.id, next);
    return next;
  }

  async membershipsForUser(userId: string) {
    return [...this.members.values()].filter((m) => m.user_id === userId).map((m) => ({ ...this.view(m), circle: this.circles.get(m.circle_id)! }));
  }
  async circleMembers(circleId: string) {
    return [...this.members.values()].filter((m) => m.circle_id === circleId).map((m) => this.view(m));
  }
  async getMember(id: string) {
    const m = this.members.get(id);
    return m ? this.view(m) : null;
  }
  async createCircle(userId: string, name: string, label: string) {
    const circle: Circle = { id: randomUUID(), name, created_by: userId, invite_code: randomUUID().slice(0, 6).toUpperCase(), created_at: now() };
    this.circles.set(circle.id, circle);
    const member = this.addMember(circle.id, userId, label, "owner");
    return { circle, member };
  }
  private addMember(circleId: string, userId: string, label: string, role: "owner" | "member"): CircleMember {
    const member: CircleMember = {
      id: randomUUID(), circle_id: circleId, user_id: userId, relationship_label: label, role,
      paypal_payer_id: null, paypal_email: null, paypal_verified_at: null, joined_at: now(),
    };
    this.members.set(member.id, member);
    return member;
  }
  async joinCircle(userId: string, code: string, label: string) {
    const circle = [...this.circles.values()].find((c) => c.invite_code.toLowerCase() === code.trim().toLowerCase());
    if (!circle) return null;
    const existing = [...this.members.values()].find((m) => m.circle_id === circle.id && m.user_id === userId);
    return { circle, member: existing ?? this.addMember(circle.id, userId, label, "member") };
  }
  async setMemberPaypal(id: string, v: { payer_id: string; email: string }) {
    const m = this.members.get(id);
    if (!m) throw new Error("member not found");
    const next = { ...m, paypal_payer_id: v.payer_id, paypal_email: v.email, paypal_verified_at: now() };
    this.members.set(id, next);
    return next;
  }

  async listInstitutions() { return [...this.institutions.values()]; }
  async getInstitution(id: string) { return this.institutions.get(id) ?? null; }

  async createRequest(r: NewRequest) {
    const row: TransferRequest = { ...r, id: randomUUID(), created_at: now(), updated_at: now() };
    this.requests.set(row.id, row);
    return row;
  }
  async getRequest(id: string) { return this.requests.get(id) ?? null; }
  async updateRequest(id: string, patch: Partial<TransferRequest>) {
    const cur = this.requests.get(id);
    if (!cur) throw new Error("request not found");
    const next = { ...cur, ...patch, id, updated_at: now() };
    this.requests.set(id, next);
    return next;
  }
  async transition(id: string, from: RequestStatus[], to: RequestStatus, patch: Partial<TransferRequest> = {}) {
    const cur = this.requests.get(id);
    if (!cur || !from.includes(cur.status)) return null;
    return this.updateRequest(id, { ...patch, status: to });
  }
  async requestsForCircles(circleIds: string[], limit = 50) {
    return [...this.requests.values()]
      .filter((r) => circleIds.includes(r.circle_id) && !r.id.startsWith("hist-"))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  async expiredAwaiting(nowIso: string) {
    return [...this.requests.values()].filter(
      (r) => (r.status === "awaiting_confirmation") && r.confirm_expires_at && r.confirm_expires_at <= nowIso,
    );
  }
  async releasedAmountsForSender(memberId: string) {
    return [...this.requests.values()].filter((r) => r.sender_member_id === memberId && r.status === "released").map((r) => Number(r.amount));
  }

  async createConfirmation(c: Pick<Confirmation, "transfer_request_id" | "asked_member_id">) {
    const row: Confirmation = { id: randomUUID(), ...c, response: null, vouching_member_id: null, vouch_method: null, vouch_note: null, responded_at: null };
    this.confirmations.set(row.id, row);
    return row;
  }
  async confirmationsForRequest(requestId: string) {
    return [...this.confirmations.values()].filter((c) => c.transfer_request_id === requestId);
  }
  async pendingConfirmationsForMembers(memberIds: string[]) {
    return [...this.confirmations.values()].filter((c) => memberIds.includes(c.asked_member_id) && c.response === null);
  }
  async respondConfirmation(id: string, patch: Partial<Confirmation>) {
    const cur = this.confirmations.get(id);
    if (!cur || cur.response !== null) return null;
    const next = { ...cur, ...patch, id, responded_at: now() };
    this.confirmations.set(id, next);
    return next;
  }
  async addVouchRow(c: Omit<Confirmation, "id">) {
    const row = { id: randomUUID(), ...c };
    this.confirmations.set(row.id, row);
    return row;
  }

  async addEvent(e: { transfer_request_id: string; type: string; actor_member_id?: string | null; payload?: Record<string, unknown> }) {
    const row: EventRow = { id: randomUUID(), transfer_request_id: e.transfer_request_id, type: e.type, actor_member_id: e.actor_member_id ?? null, payload: e.payload ?? {}, created_at: now() };
    this.events.push(row);
    return row;
  }
  async listEvents(requestId: string) { return this.events.filter((e) => e.transfer_request_id === requestId); }

  async markWebhookSeen(id: string) {
    if (this.webhooks.has(id)) return false;
    this.webhooks.add(id);
    return true;
  }
  async kvGet<T>(key: string) { return (this.kv.get(key) as T) ?? null; }
  async kvSet(key: string, value: unknown) { this.kv.set(key, value); }
}
