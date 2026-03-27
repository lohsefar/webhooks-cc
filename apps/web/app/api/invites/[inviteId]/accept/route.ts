import { authenticateRequest } from "@/lib/api-auth";
import { acceptInvite } from "@/lib/supabase/teams";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  const auth = await authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { inviteId } = await params;

  try {
    const accepted = await acceptInvite(auth.userId, inviteId);
    if (!accepted) {
      return Response.json({ error: "Invite not found" }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to accept invite:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
