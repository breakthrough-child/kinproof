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

export type MemberView = CircleMember & { display_name: string };
export type NewRequest = Omit<TransferRequest, "id" | "created_at" | "updated_at">;

/**
 * Data access used by server code. The Supabase implementation uses the service role
 * (RLS is bypassed), so every caller MUST authorize in the service layer first.
 */
export interface Store {
  // profiles
  getProfile(userId: string): Promise<Profile | null>;
  upsertProfile(p: Partial<Profile> & { id: string }): Promise<Profile>;

  // circles & members
  membershipsForUser(userId: string): Promise<(MemberView & { circle: Circle })[]>;
  circleMembers(circleId: string): Promise<MemberView[]>;
  getMember(memberId: string): Promise<MemberView | null>;
  createCircle(userId: string, name: string, relationshipLabel: string): Promise<{ circle: Circle; member: CircleMember }>;
  joinCircle(userId: string, inviteCode: string, relationshipLabel: string): Promise<{ circle: Circle; member: CircleMember } | null>;
  setMemberPaypal(memberId: string, v: { payer_id: string; email: string }): Promise<CircleMember>;

  // institutions
  listInstitutions(): Promise<Institution[]>;
  getInstitution(id: string): Promise<Institution | null>;

  // transfer requests
  createRequest(r: NewRequest): Promise<TransferRequest>;
  getRequest(id: string): Promise<TransferRequest | null>;
  /** Unconditional patch (use `transition` for status changes). */
  updateRequest(id: string, patch: Partial<TransferRequest>): Promise<TransferRequest>;
  /** Atomic compare-and-set on status. Returns null if the current status is not in `from`. */
  transition(id: string, from: RequestStatus[], to: RequestStatus, patch?: Partial<TransferRequest>): Promise<TransferRequest | null>;
  requestsForCircles(circleIds: string[], limit?: number): Promise<TransferRequest[]>;
  expiredAwaiting(nowIso: string): Promise<TransferRequest[]>;
  releasedAmountsForSender(memberId: string): Promise<number[]>;

  // confirmations
  createConfirmation(c: Pick<Confirmation, "transfer_request_id" | "asked_member_id">): Promise<Confirmation>;
  confirmationsForRequest(requestId: string): Promise<Confirmation[]>;
  pendingConfirmationsForMembers(memberIds: string[]): Promise<Confirmation[]>;
  /** Only writes if response is currently null (first answer wins). */
  respondConfirmation(id: string, patch: Partial<Confirmation>): Promise<Confirmation | null>;
  addVouchRow(c: Omit<Confirmation, "id">): Promise<Confirmation>;

  // events (append-only)
  addEvent(e: Pick<EventRow, "transfer_request_id" | "type"> & { actor_member_id?: string | null; payload?: Record<string, unknown> }): Promise<EventRow>;
  listEvents(requestId: string): Promise<EventRow[]>;

  // webhook idempotency: returns true the first time an id is seen
  markWebhookSeen(id: string): Promise<boolean>;

  // kv for the mock PayPal client
  kvGet<T>(key: string): Promise<T | null>;
  kvSet(key: string, value: unknown): Promise<void>;
}
