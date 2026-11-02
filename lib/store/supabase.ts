import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
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

type PgErr = { message: string; code?: string } | null;
function must<T>(r: { data: T; error: PgErr }): T {
  if (r.error) throw new Error(`supabase: ${r.error.message}`);
  return r.data;
}

export function adminClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export class SupabaseStore implements Store {
  constructor(private db: SupabaseClient = adminClient()) {}

  private async names(userIds: string[]): Promise<Map<string, string>> {
    if (!userIds.length) return new Map();
    const rows = must(await this.db.from("profiles").select("id, display_name").in("id", userIds)) as { id: string; display_name: string }[];
    return new Map(rows.map((r) => [r.id, r.display_name]));
  }
  private async views(members: CircleMember[]): Promise<MemberView[]> {
    const n = await this.names([...new Set(members.map((m) => m.user_id))]);
    return members.map((m) => ({ ...m, display_name: n.get(m.user_id) ?? "Member" }));
  }

  async getProfile(id: string) {
    return (must(await this.db.from("profiles").select("*").eq("id", id).maybeSingle()) as Profile | null) ?? null;
  }
  async upsertProfile(p: Partial<Profile> & { id: string }) {
    return must(await this.db.from("profiles").upsert(p).select().single()) as Profile;
  }

  async membershipsForUser(userId: string) {
    const ms = must(await this.db.from("circle_members").select("*, circle:circles(*)").eq("user_id", userId)) as (CircleMember & { circle: Circle })[];
    const v = await this.views(ms);
    return v.map((m, i) => ({ ...m, circle: ms[i].circle }));
  }
  async circleMembers(circleId: string) {
    return this.views(must(await this.db.from("circle_members").select("*").eq("circle_id", circleId).order("joined_at")) as CircleMember[]);
  }
  async getMember(id: string) {
    const m = must(await this.db.from("circle_members").select("*").eq("id", id).maybeSingle()) as CircleMember | null;
    return m ? (await this.views([m]))[0] : null;
  }
  async createCircle(userId: string, name: string, label: string) {
    const circle = must(
      await this.db.from("circles").insert({ name, created_by: userId, invite_code: randomBytes(3).toString("hex").toUpperCase() }).select().single(),
    ) as Circle;
    const member = must(
      await this.db.from("circle_members").insert({ circle_id: circle.id, user_id: userId, relationship_label: label, role: "owner" }).select().single(),
    ) as CircleMember;
    return { circle, member };
  }
  async joinCircle(userId: string, code: string, label: string) {
    const circle = must(await this.db.from("circles").select("*").ilike("invite_code", code.trim()).maybeSingle()) as Circle | null;
    if (!circle) return null;
    const existing = must(await this.db.from("circle_members").select("*").eq("circle_id", circle.id).eq("user_id", userId).maybeSingle()) as CircleMember | null;
    if (existing) return { circle, member: existing };
    const member = must(
      await this.db.from("circle_members").insert({ circle_id: circle.id, user_id: userId, relationship_label: label, role: "member" }).select().single(),
    ) as CircleMember;
    return { circle, member };
  }
  async setMemberPaypal(id: string, v: { payer_id: string; email: string }) {
    return must(
      await this.db.from("circle_members").update({ paypal_payer_id: v.payer_id, paypal_email: v.email, paypal_verified_at: new Date().toISOString() }).eq("id", id).select().single(),
    ) as CircleMember;
  }

  async listInstitutions() {
    return must(await this.db.from("institutions").select("*").order("name")) as Institution[];
  }
  async getInstitution(id: string) {
    return (must(await this.db.from("institutions").select("*").eq("id", id).maybeSingle()) as Institution | null) ?? null;
  }

  async createRequest(r: NewRequest) {
    return must(await this.db.from("transfer_requests").insert(r).select().single()) as TransferRequest;
  }
  async getRequest(id: string) {
    return (must(await this.db.from("transfer_requests").select("*").eq("id", id).maybeSingle()) as TransferRequest | null) ?? null;
  }
  async updateRequest(id: string, patch: Partial<TransferRequest>) {
    const { id: _ignore, ...rest } = patch;
    void _ignore;
    return must(await this.db.from("transfer_requests").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", id).select().single()) as TransferRequest;
  }
  async transition(id: string, from: RequestStatus[], to: RequestStatus, patch: Partial<TransferRequest> = {}) {
    const { id: _ignore, ...rest } = patch;
    void _ignore;
    const r = await this.db
      .from("transfer_requests")
      .update({ ...rest, status: to, updated_at: new Date().toISOString() })
      .eq("id", id)
      .in("status", from)
      .select()
      .maybeSingle();
    return (must(r) as TransferRequest | null) ?? null;
  }
  async requestsForCircles(circleIds: string[], limit = 50) {
    if (!circleIds.length) return [];
    return must(await this.db.from("transfer_requests").select("*").in("circle_id", circleIds).order("created_at", { ascending: false }).limit(limit)) as TransferRequest[];
  }
  async expiredAwaiting(nowIso: string) {
    return must(await this.db.from("transfer_requests").select("*").eq("status", "awaiting_confirmation").lte("confirm_expires_at", nowIso)) as TransferRequest[];
  }
  async releasedAmountsForSender(memberId: string) {
    const rows = must(await this.db.from("transfer_requests").select("amount").eq("sender_member_id", memberId).eq("status", "released").limit(100)) as { amount: number | string }[];
    return rows.map((r) => Number(r.amount));
  }

  async createConfirmation(c: Pick<Confirmation, "transfer_request_id" | "asked_member_id">) {
    return must(await this.db.from("confirmations").insert(c).select().single()) as Confirmation;
  }
  async confirmationsForRequest(requestId: string) {
    return must(await this.db.from("confirmations").select("*").eq("transfer_request_id", requestId)) as Confirmation[];
  }
  async pendingConfirmationsForMembers(memberIds: string[]) {
    if (!memberIds.length) return [];
    return must(await this.db.from("confirmations").select("*").in("asked_member_id", memberIds).is("response", null)) as Confirmation[];
  }
  async respondConfirmation(id: string, patch: Partial<Confirmation>) {
    const { id: _ignore, ...rest } = patch;
    void _ignore;
    const r = await this.db.from("confirmations").update({ ...rest, responded_at: new Date().toISOString() }).eq("id", id).is("response", null).select().maybeSingle();
    return (must(r) as Confirmation | null) ?? null;
  }
  async addVouchRow(c: Omit<Confirmation, "id">) {
    return must(await this.db.from("confirmations").insert(c).select().single()) as Confirmation;
  }

  async addEvent(e: { transfer_request_id: string; type: string; actor_member_id?: string | null; payload?: Record<string, unknown> }) {
    return must(
      await this.db.from("events").insert({ transfer_request_id: e.transfer_request_id, type: e.type, actor_member_id: e.actor_member_id ?? null, payload: e.payload ?? {} }).select().single(),
    ) as EventRow;
  }
  async listEvents(requestId: string) {
    return must(await this.db.from("events").select("*").eq("transfer_request_id", requestId).order("created_at")) as EventRow[];
  }

  async markWebhookSeen(id: string) {
    const r = await this.db.from("webhook_events").insert({ id });
    if (r.error) {
      if (r.error.code === "23505") return false;
      throw new Error(`supabase: ${r.error.message}`);
    }
    return true;
  }
  async kvGet<T>(key: string) {
    const row = must(await this.db.from("mock_kv").select("value").eq("key", key).maybeSingle()) as { value: T } | null;
    return row?.value ?? null;
  }
  async kvSet(key: string, value: unknown) {
    must(await this.db.from("mock_kv").upsert({ key, value }));
  }
}
