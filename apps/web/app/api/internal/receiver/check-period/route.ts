import { verifyReceiverSharedSecret } from "@/lib/receiver-shared-secret";
import { parseJsonBody } from "@/lib/request-validation";
import { checkAndStartPeriodForReceiver } from "@/lib/supabase/receiver";

export async function POST(request: Request) {
  const authError = verifyReceiverSharedSecret(request);
  if (authError) return authError;

  const parsed = await parseJsonBody(request);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data as Record<string, unknown>;
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) {
    return Response.json({ error: "invalid_user_id" }, { status: 400 });
  }

  try {
    const result = await checkAndStartPeriodForReceiver(userId);
    if (result.error === "quota_exceeded") {
      return Response.json(result, {
        status: 429,
        headers: result.retryAfter
          ? {
              "Retry-After": String(Math.ceil(result.retryAfter / 1000)),
            }
          : undefined,
      });
    }
    if (result.error === "not_found") {
      return Response.json(result, { status: 404 });
    }

    return Response.json(result);
  } catch (error) {
    console.error("Failed to check or start period:", error);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
