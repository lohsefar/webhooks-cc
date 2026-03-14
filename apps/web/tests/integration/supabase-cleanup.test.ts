import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";
import { cleanupExpiredEphemeralEndpoints } from "@/lib/supabase/cleanup";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://192.168.0.247:8000";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY env var required for integration tests");
}

const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe("Supabase Cleanup Integration", () => {
  const expiredEndpointId = randomUUID();
  const activeEndpointId = randomUUID();
  const persistentEndpointId = randomUUID();
  const expiredRequestId = randomUUID();
  const activeRequestId = randomUUID();
  const persistentRequestId = randomUUID();
  const orphanRequestId = randomUUID();

  beforeAll(async () => {
    const expiredAt = new Date(Date.now() - 5 * 60_000).toISOString();
    const activeExpiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

    const { error: endpointInsertError } = await admin.from("endpoints").insert([
      {
        id: expiredEndpointId,
        slug: `cleanup-expired-${Date.now()}`,
        is_ephemeral: true,
        expires_at: expiredAt,
        request_count: 1,
      },
      {
        id: activeEndpointId,
        slug: `cleanup-active-${Date.now()}`,
        is_ephemeral: true,
        expires_at: activeExpiresAt,
        request_count: 1,
      },
      {
        id: persistentEndpointId,
        slug: `cleanup-persistent-${Date.now()}`,
        is_ephemeral: false,
        expires_at: expiredAt,
        request_count: 1,
      },
    ]);

    expect(endpointInsertError).toBeNull();

    const { error: requestInsertError } = await admin.from("requests").insert([
      {
        id: expiredRequestId,
        endpoint_id: expiredEndpointId,
        method: "POST",
        path: "/cleanup-expired",
        headers: { "content-type": "application/json" },
        body: "{\"expired\":true}",
        query_params: {},
        content_type: "application/json",
        ip: "127.0.0.1",
        size: 16,
      },
      {
        id: activeRequestId,
        endpoint_id: activeEndpointId,
        method: "POST",
        path: "/cleanup-active",
        headers: { "content-type": "application/json" },
        body: "{\"active\":true}",
        query_params: {},
        content_type: "application/json",
        ip: "127.0.0.1",
        size: 15,
      },
      {
        id: persistentRequestId,
        endpoint_id: persistentEndpointId,
        method: "POST",
        path: "/cleanup-persistent",
        headers: { "content-type": "application/json" },
        body: "{\"persistent\":true}",
        query_params: {},
        content_type: "application/json",
        ip: "127.0.0.1",
        size: 19,
      },
      {
        id: orphanRequestId,
        endpoint_id: randomUUID(),
        method: "POST",
        path: "/cleanup-orphan",
        headers: { "content-type": "application/json" },
        body: "{\"orphan\":true}",
        query_params: {},
        content_type: "application/json",
        ip: "127.0.0.1",
        size: 15,
      },
    ]);

    expect(requestInsertError).toBeNull();
  });

  afterAll(async () => {
    await admin
      .from("requests")
      .delete()
      .in("endpoint_id", [expiredEndpointId, activeEndpointId, persistentEndpointId]);
    await admin.from("requests").delete().eq("id", orphanRequestId);
    await admin
      .from("endpoints")
      .delete()
      .in("id", [expiredEndpointId, activeEndpointId, persistentEndpointId]);
  });

  it("deletes expired guest endpoints, their requests, and orphaned request rows", async () => {
    const result = await cleanupExpiredEphemeralEndpoints();

    expect(result.deleted_endpoints).toBeGreaterThanOrEqual(1);
    expect(result.deleted_expired_requests).toBeGreaterThanOrEqual(1);
    expect(result.deleted_orphaned_requests).toBeGreaterThanOrEqual(1);

    const { data: endpoints, error: endpointsError } = await admin
      .from("endpoints")
      .select("id, is_ephemeral")
      .in("id", [expiredEndpointId, activeEndpointId, persistentEndpointId]);

    expect(endpointsError).toBeNull();
    expect(endpoints).toEqual(
      expect.arrayContaining([
        { id: activeEndpointId, is_ephemeral: true },
        { id: persistentEndpointId, is_ephemeral: false },
      ])
    );
    expect(endpoints?.some((endpoint) => endpoint.id === expiredEndpointId)).toBe(false);

    const { data: requestRows, error: requestsError } = await admin
      .from("requests")
      .select("id, endpoint_id, path")
      .in("endpoint_id", [expiredEndpointId, activeEndpointId, persistentEndpointId]);

    expect(requestsError).toBeNull();
    expect(requestRows).toEqual(
      expect.arrayContaining([
        {
          endpoint_id: activeEndpointId,
          path: "/cleanup-active",
          id: expect.any(String),
        },
        {
          endpoint_id: persistentEndpointId,
          path: "/cleanup-persistent",
          id: expect.any(String),
        },
      ])
    );
    expect(requestRows?.some((request) => request.endpoint_id === expiredEndpointId)).toBe(false);

    const { data: orphanRequest, error: orphanRequestError } = await admin
      .from("requests")
      .select("id")
      .eq("id", orphanRequestId)
      .maybeSingle();

    expect(orphanRequestError).toBeNull();
    expect(orphanRequest).toBeNull();
  });
});
