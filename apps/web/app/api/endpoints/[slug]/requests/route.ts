import { authenticateRequest, convexCliRequest } from "@/lib/api-auth";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { slug } = await params;
  const url = new URL(request.url);

  const queryParams: Record<string, string> = {
    slug,
    userId: auth.userId,
  };

  const limit = url.searchParams.get("limit");
  if (limit) queryParams.limit = limit;

  const since = url.searchParams.get("since");
  if (since) queryParams.since = since;

  return convexCliRequest("/cli/requests-list", {
    params: queryParams,
  });
}
