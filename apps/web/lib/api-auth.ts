/**
 * @fileoverview API authentication helpers for bearer-authenticated API routes.
 *
 * Validates API keys and Supabase session tokens against Supabase.
 */
import { createAdminClient } from "./supabase/admin";
import { validateApiKeyWithMetadata } from "./supabase/api-keys";

export type UserPlan = "free" | "pro";

export interface ApiKeyValidation {
  userId: string;
  plan?: UserPlan;
}

async function validateSupabaseSessionWithPlan(
  accessToken: string
): Promise<ApiKeyValidation | null> {
  const admin = createAdminClient();
  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(accessToken);

  if (authError || !user) {
    return null;
  }

  const { data: userRow, error: userError } = await admin
    .from("users")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle<{ plan: UserPlan }>();

  if (userError) {
    throw userError;
  }

  return {
    userId: user.id,
    plan: userRow?.plan,
  };
}

/** Extract Bearer token from Authorization header */
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

/** Validate an API key. Returns userId or null. */
export async function validateApiKey(apiKey: string): Promise<string | null> {
  const result = await validateBearerTokenWithPlan(apiKey);
  return result?.userId ?? null;
}

/** Validate a bearer token (API key or Supabase session) and return userId plus plan. */
export async function validateBearerTokenWithPlan(token: string): Promise<ApiKeyValidation | null> {
  try {
    if (token.startsWith("whcc_")) {
      return await validateApiKeyWithMetadata(token);
    }

    return await validateSupabaseSessionWithPlan(token);
  } catch {
    console.error("Failed to validate bearer token against Supabase");
    return null;
  }
}

/** Backwards-compatible alias for API-key consumers. */
export async function validateApiKeyWithPlan(apiKey: string): Promise<ApiKeyValidation | null> {
  return validateBearerTokenWithPlan(apiKey);
}

/**
 * Authenticate a request using a Bearer API key or Supabase session token.
 * Returns { success: true, userId } on success, or { success: false, response } on failure.
 */
export type AuthResult = { success: true; userId: string } | { success: false; response: Response };

export async function authenticateRequest(request: Request): Promise<AuthResult> {
  const token = extractBearerToken(request);
  if (!token) {
    return {
      success: false,
      response: new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  const userId = await validateApiKey(token);
  if (!userId) {
    return {
      success: false,
      response: new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  return { success: true, userId };
}

/**
 * Authenticate a request using only a Supabase session token.
 * Rejects API keys — use this for sensitive routes (account deletion, billing mutations)
 * where long-lived API keys should not have access.
 */
export async function authenticateSessionRequest(request: Request): Promise<AuthResult> {
  const token = extractBearerToken(request);
  if (!token) {
    return {
      success: false,
      response: new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  if (token.startsWith("whcc_")) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({
          error: "API keys are not allowed for this operation. Use a session token.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  const result = await validateSupabaseSessionWithPlan(token);
  if (!result) {
    return {
      success: false,
      response: new Response(JSON.stringify({ error: "Invalid session token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  return { success: true, userId: result.userId };
}
