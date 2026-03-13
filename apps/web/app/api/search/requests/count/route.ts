import { extractBearerToken, validateBearerTokenWithPlan } from "@/lib/api-auth";
import { serverEnv, publicEnv } from "@/lib/env";
import { checkRateLimitByKey } from "@/lib/rate-limit";
import * as Sentry from "@sentry/nextjs";

/**
 * GET /api/search/requests/count — Proxy retained request counts to the Rust receiver's
 * ClickHouse-backed /search/count endpoint.
 *
 * Auth: accepts either a Supabase session token (browser) or API key (CLI/SDK).
 * Injects user_id and forwards query params to the receiver.
 */
export async function GET(request: Request) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return Response.json({ error: "Missing authorization header" }, { status: 401 });
    }

    const validated = await validateBearerTokenWithPlan(token);
    if (!validated) {
      return Response.json({ error: "Invalid token" }, { status: 401 });
    }

    const userId = validated.userId;
    const plan = validated.plan;

    const rateLimited = checkRateLimitByKey(`search-count:${userId}`, 120, 10 * 60_000);
    if (rateLimited) {
      return rateLimited;
    }

    const url = new URL(request.url);
    const receiverBase = publicEnv().NEXT_PUBLIC_WEBHOOK_URL;
    const secret = serverEnv().CAPTURE_SHARED_SECRET;

    const countUrl = new URL(`${receiverBase}/search/count`);
    countUrl.searchParams.set("user_id", userId);
    if (plan) {
      countUrl.searchParams.set("plan", plan);
    }

    for (const key of ["slug", "method", "q", "from", "to"]) {
      const value = url.searchParams.get(key);
      if (value) {
        countUrl.searchParams.set(key, value);
      }
    }

    const resp = await fetch(countUrl.toString(), {
      headers: {
        Authorization: `Bearer ${secret}`,
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Search count proxy error:", resp.status, text);
      return Response.json(
        { error: "Search count request failed" },
        { status: resp.status >= 500 ? 502 : resp.status }
      );
    }

    const data: unknown = await resp.json();
    if (
      typeof data !== "object" ||
      data === null ||
      !("count" in data) ||
      typeof (data as { count: unknown }).count !== "number"
    ) {
      return Response.json({ error: "Unexpected response format" }, { status: 502 });
    }

    return Response.json({ count: (data as { count: number }).count });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Search count API route error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
