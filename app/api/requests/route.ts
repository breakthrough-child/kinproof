import { authed, jsonBody } from "@/lib/api";
import { createAnalyzedRequest, listMyRequests } from "@/lib/services/transfers";

export const POST = authed(async (req, userId) => createAnalyzedRequest(userId, await jsonBody(req)));
export const GET = authed(async (_req, userId) => listMyRequests(userId));
