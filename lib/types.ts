export type Language = "en" | "pcm";
export type RiskLevel = "low" | "medium" | "high";
export type Channel = "voice_note" | "text" | "call_summary";
export type PayeeKind = "claimed_member" | "institution" | "other";

export type RequestStatus =
  | "draft"
  | "analyzed"
  | "awaiting_paypal_approval"
  | "held"
  | "awaiting_confirmation"
  | "released"
  | "blocked"
  | "expired"
  | "redirected";

export type InstitutionKind =
  | "hospital"
  | "school"
  | "police"
  | "legal"
  | "utility"
  | "public_figure"
  | "brand"
  | "charity";

export interface Profile {
  id: string;
  display_name: string;
  preferred_language: Language;
  large_text: boolean;
  phone: string | null;
  created_at: string;
}

export interface Circle {
  id: string;
  name: string;
  created_by: string;
  invite_code: string;
  created_at: string;
}

export interface CircleMember {
  id: string;
  circle_id: string;
  user_id: string;
  relationship_label: string;
  role: "owner" | "member";
  paypal_payer_id: string | null;
  paypal_email: string | null;
  paypal_verified_at: string | null;
  joined_at: string;
}

export interface Institution {
  id: string;
  name: string;
  kind: InstitutionKind;
  city: string | null;
  country: string | null;
  paypal_email: string;
  aliases: string[];
  verified: boolean;
  notes: string | null;
}

export interface RuleSignal {
  id: string;
  weight: number;
  evidence: string;
}

export interface AiSignal {
  type: string;
  quote: string;
  explanation: string;
}

export type RecommendedAction = "release" | "confirm" | "redirect_to_institution" | "hold";

export interface AiAnalysis {
  risk_score: number;
  risk_level: RiskLevel;
  signals: AiSignal[];
  claimed_identity: string | null;
  claims_public_figure: boolean;
  requested_amount: number | null;
  requested_method: string | null;
  mentioned_institution: { name: string; kind: string | null } | null;
  confirmation_question: string;
  sender_explanation: string;
  recommended_action: RecommendedAction;
  /** true when produced by the rules-only fallback */
  fallback?: boolean;
}

export interface TransferRequest {
  id: string;
  circle_id: string;
  sender_member_id: string;
  claimed_requester_member_id: string | null;
  claimed_requester_name: string | null;
  channel: Channel;
  raw_message: string;
  audio_path: string | null;
  transcript: string | null;
  amount: number;
  currency: string;
  payee_email: string;
  payee_kind: PayeeKind;
  institution_id: string | null;
  rule_signals: RuleSignal[];
  ai_analysis: AiAnalysis | null;
  risk_score: number;
  risk_level: RiskLevel;
  status: RequestStatus;
  paypal_order_id: string | null;
  paypal_authorization_id: string | null;
  paypal_capture_id: string | null;
  confirm_expires_at: string | null;
  override_available_at: string | null;
  redirected_from_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ConfirmationResponse = "confirmed" | "denied" | "vouched" | "expired";
export type VouchMethod = "called_known_number" | "in_person" | "other";

export interface Confirmation {
  id: string;
  transfer_request_id: string;
  asked_member_id: string;
  response: ConfirmationResponse | null;
  vouching_member_id: string | null;
  vouch_method: VouchMethod | null;
  vouch_note: string | null;
  responded_at: string | null;
}

export interface EventRow {
  id: string;
  transfer_request_id: string;
  actor_member_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}
