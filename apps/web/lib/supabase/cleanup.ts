import { createAdminClient } from "./admin";

interface ExpiredEphemeralCleanupRow {
  deleted_endpoints: number;
  deleted_expired_requests: number;
  deleted_orphaned_requests: number;
}

async function callUntypedRpc<T>(
  fn: string,
  params?: Record<string, unknown>
): Promise<{ data: T | null; error: { message: string } | null }> {
  const admin = createAdminClient();
  const rpc = admin.rpc.bind(admin) as unknown as (
    functionName: string,
    functionParams?: Record<string, unknown>
  ) => Promise<{ data: T | null; error: { message: string } | null }>;

  return rpc(fn, params);
}

export async function cleanupExpiredEphemeralEndpoints(): Promise<ExpiredEphemeralCleanupRow> {
  const { data, error } = await callUntypedRpc<ExpiredEphemeralCleanupRow[]>(
    "cleanup_expired_ephemeral_endpoints"
  );

  if (error) {
    throw new Error(error.message);
  }

  return (
    data?.[0] ?? {
      deleted_endpoints: 0,
      deleted_expired_requests: 0,
      deleted_orphaned_requests: 0,
    }
  );
}
