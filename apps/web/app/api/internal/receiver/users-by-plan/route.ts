import { verifyReceiverSharedSecret } from "@/lib/receiver-shared-secret";
import { listUsersByPlanForReceiver } from "@/lib/supabase/receiver";

export async function GET(request: Request) {
  const authError = verifyReceiverSharedSecret(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const plan = url.searchParams.get("plan");
  if (plan !== "free" && plan !== "pro") {
    return Response.json({ error: "invalid_plan" }, { status: 400 });
  }

  const limitRaw = Number(url.searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 200;
  const cursor = url.searchParams.get("cursor") ?? undefined;

  try {
    const page = await listUsersByPlanForReceiver({
      plan,
      cursor,
      limit,
    });
    return Response.json(page);
  } catch (error) {
    console.error("Failed to list users by plan for receiver:", error);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
