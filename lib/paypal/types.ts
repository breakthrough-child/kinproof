export interface CreateOrderInput {
  transferRequestId: string;
  amount: number;
  currency: string;
  /**
   * The final recipient. NOT set as the order payee: the hold is placed on Kinproof's own merchant
   * account (PayPal only lets the owning merchant capture/void), and the money is forwarded with
   * `payout` after confirmation. Used for the idempotency key and the order description only.
   */
  payeeEmail: string;
  description?: string;
}

export interface AuthorizeResult {
  authorizationId: string;
  status: string;
  payerEmail?: string | null;
}

export interface CaptureResult {
  captureId: string;
  status: string;
}

export interface PayoutInput {
  transferRequestId: string;
  receiverEmail: string;
  amount: number;
  currency: string;
}

export interface PayoutResult {
  payoutBatchId: string;
  status: string;
}

/** Same interface for the mock and sandbox implementations. */
export interface PayPalClient {
  readonly mode: "mock" | "sandbox";
  createOrder(i: CreateOrderInput): Promise<{ orderId: string }>;
  /** Called after the buyer approved the order in PayPal. */
  authorizeOrder(orderId: string): Promise<AuthorizeResult>;
  capture(authorizationId: string, idempotencyKey: string): Promise<CaptureResult>;
  void(authorizationId: string, idempotencyKey: string): Promise<void>;
  /** Forward captured funds to the final recipient (PayPal Payouts). Idempotent per transfer request. */
  payout(i: PayoutInput): Promise<PayoutResult>;
  verifyWebhook(headers: Record<string, string | undefined>, rawBody: string): Promise<boolean>;
}

export class PayPalError extends Error {
  constructor(
    message: string,
    public status: number,
    public debugId?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "PayPalError";
  }
}

export interface PayPalIdentity {
  payerId: string;
  email: string;
  emailVerified: boolean;
}
