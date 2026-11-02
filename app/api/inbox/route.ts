import { authed } from "@/lib/api";
import { inboxFor } from "@/lib/services/transfers";

export const GET = authed(async (_req, userId) => inboxFor(userId));
