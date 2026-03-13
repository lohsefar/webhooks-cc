import { verifyReceiverSharedSecret } from "@/lib/receiver-shared-secret";
import { getEndpointInfoForReceiver, isValidReceiverSlug } from "@/lib/supabase/receiver";

export async function GET(request: Request) {
  const authError = verifyReceiverSharedSecret(request);
  if (authError) return authError;

  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug || !isValidReceiverSlug(slug)) {
    return Response.json({ error: "invalid_slug" }, { status: 400 });
  }

  try {
    const endpoint = await getEndpointInfoForReceiver(slug);
    return Response.json(endpoint);
  } catch (error) {
    console.error("Failed to fetch receiver endpoint info:", error);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
