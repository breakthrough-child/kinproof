export interface CreateOrderInput {
  transferRequestId: string;
  amount: number;
  currency: string;
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

/** Same interface for the mock and sandbox implementations. */
export interface PayPalClient {
  readonly mode: "mock" | "sandbox";
  createOrder(i: CreateOrderInput): Promise<{ orderId: string }>;
  /** Called after the buyer approved the order in PayPal. */
  authorizeOrder(orderId: string): Promise<AuthorizeResult>;
  capture(authorizationId: string, idempotencyKey: string): Promise<CaptureResult>;
  void(authorizationId: string, idempotencyKey: string): Promise<void>;
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
