import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ServiceError } from "@/lib/services/errors";
import { PayPalError } from "@/lib/paypal/types";
import { InvalidTransitionError } from "@/lib/flow/stateMachine";
import { requireUserId } from "@/lib/auth/session";

export function fail(e: unknown) {
  if (e instanceof ServiceError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ error: "Please check the form and try again.", code: "invalid", issues: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  if (e instanceof InvalidTransitionError) return NextResponse.json({ error: "That step isn't available right now.", code: "invalid_transition" }, { status: 409 });
  if (e instanceof PayPalError) {
    console.error("[kinproof] PayPal error", e.status, e.debugId, e.message);
    return NextResponse.json({ error: "PayPal had a problem. Nothing was lost. Please try again.", code: "paypal_error" }, { status: 502 });
  }
  console.error("[kinproof] unexpected", e);
  return NextResponse.json({ error: "Something went wrong on our side.", code: "internal" }, { status: 500 });
}

/** Authenticated JSON handler wrapper. */
export function authed<C = unknown>(fn: (req: Request, userId: string, ctx: C) => Promise<unknown>) {
  return async (req: Request, ctx: C) => {
    try {
      const userId = await requireUserId();
      const out = await fn(req, userId, ctx);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return fail(e);
    }
  };
}

export async function jsonBody<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export type IdCtx = { params: Promise<{ id: string }> };
