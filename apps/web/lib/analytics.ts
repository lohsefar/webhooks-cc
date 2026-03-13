/**
 * Track custom analytics events via PostHog.
 * Uses dynamic import so posthog-js is only loaded when an event fires,
 * not eagerly bundled into every page that imports analytics helpers.
 */

let cached: typeof import("posthog-js").default | null = null;

async function getPostHog() {
  if (typeof window === "undefined") return null;
  if (cached) return cached;
  try {
    const { default: posthog } = await import("posthog-js");
    cached = posthog;
    return posthog;
  } catch {
    return null;
  }
}

async function capture(event: string, properties?: Record<string, unknown>) {
  const posthog = await getPostHog();
  posthog?.capture(event, properties);
}

// ── Landing page ────────────────────────────────────────────────
export function trackCTAClick(cta: "register" | "try_live" | "docs" | "faq") {
  void capture("landing_cta_clicked", { cta });
}

// ── Auth ────────────────────────────────────────────────────────
export function trackSignInStarted(provider: "github" | "google") {
  void capture("sign_in_started", { provider });
}

// ── Dashboard ───────────────────────────────────────────────────
export function trackEndpointCreated() {
  void capture("endpoint_created");
}

// ── Billing / Upgrade ───────────────────────────────────────────
export function trackUpgradeClicked() {
  void capture("upgrade_clicked");
}

export function trackUpgradeCompleted() {
  void capture("upgrade_completed");
}

export function trackSubscriptionCancelled() {
  void capture("subscription_cancelled");
}

export function trackSubscriptionReactivated() {
  void capture("subscription_reactivated");
}

// ── Quota ───────────────────────────────────────────────────────
export function trackQuotaWarningShown(plan: string, usagePercent: number) {
  void capture("quota_warning_shown", { plan, usage_percent: Math.round(usagePercent) });
}

// ── Account ─────────────────────────────────────────────────────
export function trackApiKeyCreated() {
  void capture("api_key_created");
}

export function trackAccountDeleted() {
  void capture("account_deleted");
}

// ── Identify (after login) ──────────────────────────────────────
export async function identifyUser(userId: string, properties?: Record<string, unknown>) {
  const posthog = await getPostHog();
  posthog?.identify(userId, properties);
}

export async function resetUser() {
  const posthog = await getPostHog();
  posthog?.reset();
}
