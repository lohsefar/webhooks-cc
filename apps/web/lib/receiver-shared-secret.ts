import { timingSafeEqual } from "node:crypto";

function unauthorizedResponse() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

export function verifyReceiverSharedSecret(request: Request): Response | null {
  const expectedSecret = process.env.CAPTURE_SHARED_SECRET;
  if (!expectedSecret) {
    console.error("CAPTURE_SHARED_SECRET is not configured");
    return Response.json({ error: "internal_error" }, { status: 500 });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return unauthorizedResponse();
  }

  const providedSecret = authorization.slice(7);
  const expected = Buffer.from(expectedSecret);
  const provided = Buffer.from(providedSecret);

  if (expected.length !== provided.length) {
    return unauthorizedResponse();
  }

  if (!timingSafeEqual(expected, provided)) {
    return unauthorizedResponse();
  }

  return null;
}
