import { verifyReceiverSharedSecret } from "@/lib/receiver-shared-secret";
import { parseJsonBody } from "@/lib/request-validation";
import {
  ALLOWED_RECEIVER_METHODS,
  MAX_RECEIVER_BATCH_SIZE,
  MAX_RECEIVER_BODY_SIZE,
  MAX_RECEIVER_HEADERS,
  MAX_RECEIVER_IP_LENGTH,
  MAX_RECEIVER_PATH_LENGTH,
  MAX_RECEIVER_QUERY_PARAMS,
  captureBatchForReceiver,
  isValidReceiverSlug,
  isValidStringRecord,
  type ReceiverBufferedRequest,
} from "@/lib/supabase/receiver";

const MAX_CAPTURE_BATCH_BODY_SIZE = 8 * 1024 * 1024;

function isValidBufferedRequest(request: unknown, now: number, fiveMinutesAgo: number): boolean {
  if (typeof request !== "object" || request === null || Array.isArray(request)) {
    return false;
  }

  const value = request as Record<string, unknown>;
  if (
    typeof value.method !== "string" ||
    !ALLOWED_RECEIVER_METHODS.has(value.method.toUpperCase()) ||
    typeof value.path !== "string" ||
    value.path.length > MAX_RECEIVER_PATH_LENGTH ||
    typeof value.ip !== "string" ||
    value.ip.length > MAX_RECEIVER_IP_LENGTH ||
    (typeof value.body === "string" && value.body.length > MAX_RECEIVER_BODY_SIZE) ||
    !isValidStringRecord(value.headers) ||
    Object.keys(value.headers).length > MAX_RECEIVER_HEADERS ||
    !isValidStringRecord(value.queryParams) ||
    Object.keys(value.queryParams).length > MAX_RECEIVER_QUERY_PARAMS ||
    typeof value.receivedAt !== "number" ||
    value.receivedAt < fiveMinutesAgo ||
    value.receivedAt > now + 5000
  ) {
    return false;
  }

  return true;
}

export async function POST(request: Request) {
  const authError = verifyReceiverSharedSecret(request);
  if (authError) return authError;

  const parsed = await parseJsonBody(request, MAX_CAPTURE_BATCH_BODY_SIZE);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data as Record<string, unknown>;
  if (typeof body.slug !== "string" || !isValidReceiverSlug(body.slug)) {
    return Response.json({ error: "invalid_slug" }, { status: 400 });
  }

  if (!Array.isArray(body.requests) || body.requests.length === 0) {
    return Response.json({ error: "invalid_requests" }, { status: 400 });
  }

  if (body.requests.length > MAX_RECEIVER_BATCH_SIZE) {
    return Response.json({ error: "batch_too_large" }, { status: 400 });
  }

  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  if (!body.requests.every((item) => isValidBufferedRequest(item, now, fiveMinutesAgo))) {
    return Response.json({ error: "invalid_requests" }, { status: 400 });
  }

  try {
    const result = await captureBatchForReceiver({
      slug: body.slug,
      requests: body.requests as ReceiverBufferedRequest[],
    });

    if (result.error === "not_found") {
      return Response.json(result, { status: 404 });
    }
    if (result.error === "expired") {
      return Response.json(result, { status: 410 });
    }

    return Response.json(result);
  } catch (error) {
    console.error("Failed to capture receiver batch:", error);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
