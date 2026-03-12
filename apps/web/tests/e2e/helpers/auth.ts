import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://192.168.0.247:8000";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;

export const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

export async function createTestUser(): Promise<TestUser> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@webhooks-test.local`;
  const password = "E2eTestPassword123!";

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "E2E Test User",
      avatar_url: "https://example.com/e2e-avatar.png",
    },
  });

  if (error) throw new Error(`Failed to create test user: ${error.message}`);

  return { id: data.user!.id, email, password };
}

export async function deleteTestUser(userId: string): Promise<void> {
  await admin.auth.admin.deleteUser(userId);
}

/**
 * Sign in a test user by getting session tokens via admin API and injecting
 * them as cookies in the Playwright browser context.
 */
export async function signInViaApi(testUser: TestUser): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await client.auth.signInWithPassword({
    email: testUser.email,
    password: testUser.password,
  });

  if (error || !data.session) {
    throw new Error(`Failed to sign in test user: ${error?.message}`);
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}
