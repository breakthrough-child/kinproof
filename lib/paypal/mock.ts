import { randomUUID } from "node:crypto";
import type { Store } from "@/lib/store/types";
import {
  PayPalError,
  type AuthorizeResult,
  type CaptureResult,
  type CreateOrderInput,
  type PayPalClient,
} from "./types";

interface MockOrder {
  id: string;
  amount: number;
  currency: string;
  payeeEmail: string;
  customId: string;
  status: "CREATED" | "APPROVED" | "COMPLETED" | "VOIDED";
  authorizationId?: string;
}
interface MockAuth {
  id: string;
  orderId: string;
  status: "CREATED" | "CAPTURED" | "VOIDED";
  captureId?: string;
}

/**
 * Simulates orders / authorizations / captures / voids, persisted through the Store
 * (database) with the same semantics and idempotency as the real client.
 */
export class MockPayPalClient implements PayPalClient {
  readonly mode = "mock" as const;
  constructor(private store: Store) {}

  private async idem<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const hit = await this.store.kvGet<T>(`pp:idem:${key}`);
    if (hit) return hit;
    const v = await fn();
    await this.store.kvSet(`pp:idem:${key}`, v);
    return v;
  }

  async createOrder(i: CreateOrderInput) {
    return this.idem(`create:${i.transferRequestId}:${i.payeeEmail}:${i.amount}`, async () => {
      const id = `MOCK-ORDER-${randomUUID().slice(0, 8).toUpperCase()}`;
      const o: MockOrder = { id, amount: i.amount, currency: i.currency, payeeEmail: i.payeeEmail, customId: i.transferRequestId, status: "CREATED" };
      await this.store.kvSet(`pp:order:${id}`, o);
      return { orderId: id };
    });
  }

  async authorizeOrder(orderId: string): Promise<AuthorizeResult> {
    const o = await this.store.kvGet<MockOrder>(`pp:order:${orderId}`);
    if (!o) throw new PayPalError("ORDER_NOT_FOUND", 404);
    if (o.authorizationId) {
      return { authorizationId: o.authorizationId, status: "CREATED", payerEmail: "mock.buyer@personal.example.com" };
    }
    const authId = `MOCK-AUTH-${randomUUID().slice(0, 8).toUpperCase()}`;
    await this.store.kvSet(`pp:auth:${authId}`, { id: authId, orderId, status: "CREATED" } satisfies MockAuth);
    await this.store.kvSet(`pp:order:${orderId}`, { ...o, status: "APPROVED", authorizationId: authId });
    return { authorizationId: authId, status: "CREATED", payerEmail: "mock.buyer@personal.example.com" };
  }

  async capture(authorizationId: string, idempotencyKey: string): Promise<CaptureResult> {
    return this.idem(`capture:${idempotencyKey}`, async () => {
      const a = await this.store.kvGet<MockAuth>(`pp:auth:${authorizationId}`);
      if (!a) throw new PayPalError("AUTHORIZATION_NOT_FOUND", 404);
      if (a.status === "VOIDED") throw new PayPalError("AUTHORIZATION_VOIDED", 422);
      if (a.status === "CAPTURED") return { captureId: a.captureId!, status: "COMPLETED" };
      const captureId = `MOCK-CAP-${randomUUID().slice(0, 8).toUpperCase()}`;
      await this.store.kvSet(`pp:auth:${authorizationId}`, { ...a, status: "CAPTURED", captureId });
      const o = await this.store.kvGet<MockOrder>(`pp:order:${a.orderId}`);
      if (o) await this.store.kvSet(`pp:order:${a.orderId}`, { ...o, status: "COMPLETED" });
      return { captureId, status: "COMPLETED" };
    });
  }

  async void(authorizationId: string, idempotencyKey: string): Promise<void> {
    await this.idem(`void:${idempotencyKey}`, async () => {
      const a = await this.store.kvGet<MockAuth>(`pp:auth:${authorizationId}`);
      if (!a) throw new PayPalError("AUTHORIZATION_NOT_FOUND", 404);
      if (a.status === "CAPTURED") throw new PayPalError("AUTHORIZATION_ALREADY_CAPTURED", 422);
      if (a.status !== "VOIDED") {
        await this.store.kvSet(`pp:auth:${authorizationId}`, { ...a, status: "VOIDED" });
        const o = await this.store.kvGet<MockOrder>(`pp:order:${a.orderId}`);
        if (o) await this.store.kvSet(`pp:order:${a.orderId}`, { ...o, status: "VOIDED" });
      }
      return { ok: true };
    });
  }

  async verifyWebhook(): Promise<boolean> {
    return true;
  }

  /** Test/inspection helper. */
  async authStatus(authorizationId: string) {
    return (await this.store.kvGet<MockAuth>(`pp:auth:${authorizationId}`))?.status ?? null;
  }
}
