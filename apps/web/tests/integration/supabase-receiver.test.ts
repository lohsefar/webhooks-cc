import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createEndpointForUser } from "@/lib/supabase/endpoints";
import {
  captureBatchForReceiver,
  checkAndStartPeriodForReceiver,
  getEndpointInfoForReceiver,
  getQuotaForReceiver,
  listUsersByPlanForReceiver,
} from "@/lib/supabase/receiver";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://192.168.0.247:8000";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY env var required for integration tests");
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EMAIL = `test-receiver-${Date.now()}@webhooks-test.local`;
const TEST_PRO_EMAIL = `test-receiver-pro-${Date.now()}@webhooks-test.local`;
const TEST_PASSWORD = "TestPassword123!";
const GUEST_SLUG = `guestreceiver${Date.now()}`;

let freeUserId: string;
let proUserId: string;
let endpointId: string;
let endpointSlug: string;
let guestEndpointId: string;

describe("Supabase Receiver Integration", () => {
  beforeAll(async () => {
    const { data: freeUser, error: freeUserError } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: "Receiver Test User",
      },
    });

    if (freeUserError) {
      throw freeUserError;
    }

    const { data: proUser, error: proUserError } = await admin.auth.admin.createUser({
      email: TEST_PRO_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: "Receiver Pro User",
      },
    });

    if (proUserError) {
      throw proUserError;
    }

    freeUserId = freeUser.user!.id;
    proUserId = proUser.user!.id;

    const { error: proPlanError } = await admin
      .from("users")
      .update({ plan: "pro", request_limit: 1000 })
      .eq("id", proUserId);

    if (proPlanError) {
      throw proPlanError;
    }

    const endpoint = await createEndpointForUser({
      userId: freeUserId,
      name: "Receiver Endpoint",
    });

    endpointId = endpoint.id;
    endpointSlug = endpoint.slug;

    const { data: guestEndpoint, error: guestEndpointError } = await admin
      .from("endpoints")
      .insert({
        slug: GUEST_SLUG,
        is_ephemeral: true,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        request_count: 3,
      })
      .select("id")
      .single();

    if (guestEndpointError) {
      throw guestEndpointError;
    }

    guestEndpointId = guestEndpoint.id;
  });

  afterAll(async () => {
    if (endpointId) {
      await admin.from("requests").delete().eq("endpoint_id", endpointId);
    }
    if (guestEndpointId) {
      await admin.from("requests").delete().eq("endpoint_id", guestEndpointId);
      await admin.from("endpoints").delete().eq("id", guestEndpointId);
    }
    if (freeUserId) {
      await admin.auth.admin.deleteUser(freeUserId);
    }
    if (proUserId) {
      await admin.auth.admin.deleteUser(proUserId);
    }
  });

  it("returns endpoint info and quota for receiver lookups", async () => {
    const endpointInfo = await getEndpointInfoForReceiver(endpointSlug);
    expect(endpointInfo).toMatchObject({
      endpointId,
      userId: freeUserId,
      isEphemeral: false,
      error: "",
    });

    const guestQuota = await getQuotaForReceiver(GUEST_SLUG);
    expect(guestQuota).toEqual({
      error: "",
      userId: null,
      remaining: 22,
      limit: 25,
      periodEnd: expect.any(Number),
      plan: "ephemeral",
      needsPeriodStart: false,
    });
  });

  it("starts a free period, captures a request batch, and updates counters", async () => {
    const { error: resetError } = await admin
      .from("users")
      .update({
        requests_used: 50,
        request_limit: 50,
        period_end: new Date(Date.now() - 60_000).toISOString(),
      })
      .eq("id", freeUserId);

    expect(resetError).toBeNull();

    const period = await checkAndStartPeriodForReceiver(freeUserId);
    expect(period).toEqual({
      error: "",
      remaining: 50,
      limit: 50,
      periodEnd: expect.any(Number),
    });

    const capture = await captureBatchForReceiver({
      slug: endpointSlug,
      requests: [
        {
          method: "POST",
          path: "/one",
          headers: { "content-type": "application/json" },
          body: "{\"ok\":true}",
          queryParams: { page: "1" },
          ip: "127.0.0.1",
          receivedAt: Date.now() - 2_000,
        },
        {
          method: "PUT",
          path: "/two",
          headers: { "content-type": "text/plain" },
          body: "payload",
          queryParams: {},
          ip: "127.0.0.1",
          receivedAt: Date.now() - 1_000,
        },
      ],
    });

    expect(capture).toEqual({
      success: true,
      error: "",
      inserted: 2,
    });

    const { data: requestRows, error: requestError } = await admin
      .from("requests")
      .select("path, content_type, user_id")
      .eq("endpoint_id", endpointId)
      .order("path", { ascending: true });

    expect(requestError).toBeNull();
    expect(requestRows).toEqual([
      {
        path: "/one",
        content_type: "application/json",
        user_id: freeUserId,
      },
      {
        path: "/two",
        content_type: "text/plain",
        user_id: freeUserId,
      },
    ]);

    const { data: endpointRow, error: endpointError } = await admin
      .from("endpoints")
      .select("request_count")
      .eq("id", endpointId)
      .single();

    expect(endpointError).toBeNull();
    expect(endpointRow?.request_count).toBe(2);

    const { data: userRow, error: userError } = await admin
      .from("users")
      .select("requests_used")
      .eq("id", freeUserId)
      .single();

    expect(userError).toBeNull();
    expect(userRow?.requests_used).toBe(2);
  });

  it("lists users by plan for the receiver retention worker", async () => {
    const page = await listUsersByPlanForReceiver({
      plan: "pro",
      limit: 200,
    });

    expect(page.error).toBe("");
    expect(page.userIds).toContain(proUserId);
    expect(page.done).toBeTypeOf("boolean");
  });
});
