import { timingSafeEqual } from "node:crypto";

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

export function verifyBlogSecret(request: Request): Response | null {
  const authHeader = request.headers.get("Authorization");
  const expectedSecret = process.env.BLOG_API_SECRET;

  if (!expectedSecret) {
    console.error("[blog-api] BLOG_API_SECRET is not configured");
    return jsonError("internal_error", 500);
  }

  const providedSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const expected = Buffer.from(expectedSecret, "utf8");
  const provided = Buffer.from(providedSecret, "utf8");

  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return jsonError("unauthorized", 401);
  }

  return null;
}
