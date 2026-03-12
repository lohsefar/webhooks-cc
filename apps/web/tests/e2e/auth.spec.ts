import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  signInViaApi,
  type TestUser,
} from "./helpers/auth";

let testUser: TestUser;

test.beforeAll(async () => {
  testUser = await createTestUser();
});

test.afterAll(async () => {
  if (testUser) {
    await deleteTestUser(testUser.id);
  }
});

/**
 * Helper: inject Supabase auth session into the browser via localStorage.
 * After setting localStorage, navigates to the target page so the
 * SupabaseAuthProvider picks up the session.
 */
async function signInBrowser(page: import("@playwright/test").Page, targetPath = "/account") {
  const { accessToken, refreshToken } = await signInViaApi(testUser);

  // Navigate to any page first to set localStorage on the correct origin
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");

  // Supabase stores the session in localStorage under a key derived from the project URL
  await page.evaluate(
    ({ accessToken, refreshToken }) => {
      // The storage key Supabase uses is: sb-<host>-auth-token
      // For self-hosted at 192.168.0.247:8000, the key is sb-192.168.0.247-auth-token
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://192.168.0.247:8000";
      const host = new URL(supabaseUrl).hostname;
      const storageKey = `sb-${host}-auth-token`;

      const session = {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      localStorage.setItem(storageKey, JSON.stringify(session));
    },
    { accessToken, refreshToken }
  );

  // Navigate to the target page — SupabaseAuthProvider will pick up the session
  await page.goto(targetPath);
  await page.waitForLoadState("networkidle");
}

test.describe("Authentication", () => {
  test("login page renders OAuth buttons", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Sign in to webhooks.cc")).toBeVisible();
    await expect(page.getByText("Continue with GitHub")).toBeVisible();
    await expect(page.getByText("Continue with Google")).toBeVisible();
  });

  test("unauthenticated user is redirected from dashboard to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login**", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated user is redirected from account to login", async ({ page }) => {
    await page.goto("/account");
    await page.waitForURL("**/login**", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("authenticated user can access account page and see their info", async ({ page }) => {
    await signInBrowser(page, "/account");

    // Should see user info from Supabase
    await expect(page.getByText("E2E Test User")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(testUser.email)).toBeVisible();
    await expect(page.getByText("Free")).toBeVisible();
  });

  test("sign out redirects to home page", async ({ page }) => {
    await signInBrowser(page, "/account");
    await expect(page.getByText("E2E Test User")).toBeVisible({ timeout: 15000 });

    // Click sign out
    await page.getByRole("button", { name: "Sign Out" }).click();
    await page.waitForURL("**/", { timeout: 10000 });

    // Verify we can't access protected routes anymore
    await page.goto("/dashboard");
    await page.waitForURL("**/login**", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("session persists across page reload", async ({ page }) => {
    await signInBrowser(page, "/account");
    await expect(page.getByText("E2E Test User")).toBeVisible({ timeout: 15000 });

    // Reload the page
    await page.reload();

    // User should still be visible (session persisted)
    await expect(page.getByText("E2E Test User")).toBeVisible({ timeout: 15000 });
  });
});
