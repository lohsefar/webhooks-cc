import { Buffer } from "node:buffer";
import { createAdminClient } from "./admin";
import type { Database, Json } from "./database";

const EPHEMERAL_REQUEST_LIMIT = 25;
const FREE_PERIOD_MS = 24 * 60 * 60 * 1000;
const DEFAULT_USERS_BY_PLAN_LIMIT = 200;
const MAX_USERS_BY_PLAN_LIMIT = 500;

export const MAX_RECEIVER_BATCH_SIZE = 100;
export const MAX_RECEIVER_PATH_LENGTH = 2048;
export const MAX_RECEIVER_IP_LENGTH = 45;
export const MAX_RECEIVER_HEADERS = 100;
export const MAX_RECEIVER_QUERY_PARAMS = 100;
export const MAX_RECEIVER_BODY_SIZE = 1024 * 1024;
export const ALLOWED_RECEIVER_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

type EndpointRow = Database["public"]["Tables"]["endpoints"]["Row"];
type RequestInsert = Database["public"]["Tables"]["requests"]["Insert"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];
type EndpointSelectRow = Pick<
  EndpointRow,
  "id" | "user_id" | "is_ephemeral" | "expires_at" | "mock_response" | "request_count"
>;
type UserQuotaRow = Pick<UserRow, "id" | "plan" | "request_limit" | "requests_used" | "period_end">;

interface StartFreePeriodRow {
  remaining: number;
  quota_limit: number;
  period_end_ts: string | null;
}

interface RpcResult<T> {
  data: T | null;
  error: { message: string } | null;
}

export interface ReceiverMockResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
}

export interface ReceiverEndpointInfo {
  endpointId: string;
  userId: string | null;
  isEphemeral: boolean;
  expiresAt: number | null;
  mockResponse?: ReceiverMockResponse;
  error: string;
}

export interface ReceiverQuotaResponse {
  error: string;
  userId: string | null;
  remaining: number;
  limit: number;
  periodEnd: number | null;
  plan: "free" | "pro" | "ephemeral" | null;
  needsPeriodStart: boolean;
}

export interface ReceiverCheckPeriodResponse {
  error: string;
  remaining: number;
  limit: number;
  periodEnd: number | null;
  retryAfter?: number;
}

export interface ReceiverBufferedRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
  queryParams: Record<string, string>;
  ip: string;
  receivedAt: number;
}

export interface ReceiverCaptureResponse {
  success: boolean;
  error: string;
  inserted: number;
}

export interface ReceiverUsersByPlanResponse {
  error: string;
  userIds: string[];
  nextCursor?: string;
  done: boolean;
}

function toMillis(timestamp: string | null): number | null {
  if (!timestamp) return null;
  const value = Date.parse(timestamp);
  return Number.isFinite(value) ? value : null;
}

function normalizeStringRecord(value: Json | null): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => typeof item === "string")
  ) as Record<string, string>;
}

function normalizeMockResponse(value: Json | null): ReceiverMockResponse | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const status = value.status;
  if (typeof status !== "number" || !Number.isInteger(status)) {
    return undefined;
  }

  return {
    status,
    body: typeof value.body === "string" ? value.body : "",
    headers: normalizeStringRecord((value.headers as Json | null) ?? null),
  };
}

function buildCurrentUserQuota(
  user: UserQuotaRow,
  now: number
): ReceiverQuotaResponse | ReceiverCheckPeriodResponse {
  const periodEnd = toMillis(user.period_end);

  if (user.plan === "free" && (!periodEnd || periodEnd <= now)) {
    return {
      error: "",
      userId: user.id,
      remaining: user.request_limit,
      limit: user.request_limit,
      periodEnd: null,
      plan: "free",
      needsPeriodStart: true,
    } satisfies ReceiverQuotaResponse;
  }

  return {
    error: "",
    remaining: Math.max(0, user.request_limit - user.requests_used),
    limit: user.request_limit,
    periodEnd,
  };
}

function isQuotaResponse(
  value: ReceiverQuotaResponse | ReceiverCheckPeriodResponse
): value is ReceiverQuotaResponse {
  return "needsPeriodStart" in value;
}

function buildRequestsInsertRows(
  endpoint: EndpointSelectRow,
  requests: ReceiverBufferedRequest[]
): RequestInsert[] {
  return requests.map((request) => {
    const contentType = request.headers["content-type"] ?? request.headers["Content-Type"] ?? null;
    const body = request.body ?? null;

    return {
      endpoint_id: endpoint.id,
      user_id: endpoint.user_id,
      method: request.method,
      path: request.path,
      headers: request.headers,
      body,
      query_params: request.queryParams,
      content_type: contentType,
      ip: request.ip,
      size: body ? Buffer.byteLength(body, "utf8") : 0,
      received_at: new Date(request.receivedAt).toISOString(),
    };
  });
}

async function getEndpointRowBySlug(slug: string): Promise<EndpointSelectRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("endpoints")
    .select("id, user_id, is_ephemeral, expires_at, mock_response, request_count")
    .eq("slug", slug)
    .returns<EndpointSelectRow>()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getUserQuotaRow(userId: string): Promise<UserQuotaRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, plan, request_limit, requests_used, period_end")
    .eq("id", userId)
    .returns<UserQuotaRow>()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function callUntypedRpc<T>(
  fn: string,
  params?: Record<string, unknown>
): Promise<RpcResult<T>> {
  const admin = createAdminClient();
  const rpc = admin.rpc.bind(admin) as unknown as (
    functionName: string,
    functionParams?: Record<string, unknown>
  ) => Promise<RpcResult<T>>;

  return rpc(fn, params);
}

export function isValidReceiverSlug(slug: string): boolean {
  return /^[A-Za-z0-9_-]{1,50}$/.test(slug);
}

export function isValidStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === "string");
}

export async function getEndpointInfoForReceiver(slug: string): Promise<ReceiverEndpointInfo> {
  const endpoint = await getEndpointRowBySlug(slug);
  if (!endpoint) {
    return {
      endpointId: "",
      userId: null,
      isEphemeral: false,
      expiresAt: null,
      error: "not_found",
    };
  }

  return {
    endpointId: endpoint.id,
    userId: endpoint.user_id,
    isEphemeral: endpoint.is_ephemeral,
    expiresAt: toMillis(endpoint.expires_at),
    mockResponse: normalizeMockResponse(endpoint.mock_response),
    error: "",
  };
}

export async function getQuotaForReceiver(slug: string): Promise<ReceiverQuotaResponse> {
  const endpoint = await getEndpointRowBySlug(slug);
  if (!endpoint) {
    return {
      error: "not_found",
      userId: null,
      remaining: 0,
      limit: 0,
      periodEnd: null,
      plan: null,
      needsPeriodStart: false,
    };
  }

  if (endpoint.is_ephemeral && !endpoint.user_id) {
    return {
      error: "",
      userId: null,
      remaining: Math.max(0, EPHEMERAL_REQUEST_LIMIT - endpoint.request_count),
      limit: EPHEMERAL_REQUEST_LIMIT,
      periodEnd: toMillis(endpoint.expires_at),
      plan: "ephemeral",
      needsPeriodStart: false,
    };
  }

  if (!endpoint.user_id) {
    return {
      error: "",
      userId: null,
      remaining: -1,
      limit: -1,
      periodEnd: null,
      plan: null,
      needsPeriodStart: false,
    };
  }

  const user = await getUserQuotaRow(endpoint.user_id);
  if (!user) {
    return {
      error: "",
      userId: null,
      remaining: -1,
      limit: -1,
      periodEnd: null,
      plan: null,
      needsPeriodStart: false,
    };
  }

  const current = buildCurrentUserQuota(user, Date.now());
  if (!isQuotaResponse(current)) {
    return {
      error: current.error,
      userId: user.id,
      remaining: current.remaining,
      limit: current.limit,
      periodEnd: current.periodEnd,
      plan: user.plan,
      needsPeriodStart: false,
    };
  }

  return current;
}

export async function checkAndStartPeriodForReceiver(
  userId: string
): Promise<ReceiverCheckPeriodResponse> {
  const user = await getUserQuotaRow(userId);
  if (!user) {
    return {
      error: "not_found",
      remaining: 0,
      limit: 0,
      periodEnd: null,
    };
  }

  const now = Date.now();
  const current = buildCurrentUserQuota(user, now);
  if (!isQuotaResponse(current)) {
    if (user.plan === "free" && user.requests_used >= user.request_limit) {
      const periodEnd = current.periodEnd;
      return {
        error: "quota_exceeded",
        remaining: 0,
        limit: current.limit,
        periodEnd,
        retryAfter: periodEnd ? Math.max(0, periodEnd - now) : undefined,
      };
    }

    return current;
  }

  if (user.plan !== "free") {
    return {
      error: "",
      remaining: current.remaining,
      limit: current.limit,
      periodEnd: current.periodEnd,
    };
  }

  const { data, error } = await callUntypedRpc<StartFreePeriodRow[]>("start_free_period", {
    p_user_id: userId,
  });

  if (error) {
    throw error;
  }

  const started = Array.isArray(data) ? (data[0] as StartFreePeriodRow | undefined) : undefined;
  if (started) {
    return {
      error: "",
      remaining: started.remaining,
      limit: started.quota_limit,
      periodEnd: toMillis(started.period_end_ts),
    };
  }

  const refreshed = await getUserQuotaRow(userId);
  if (!refreshed) {
    return {
      error: "not_found",
      remaining: 0,
      limit: 0,
      periodEnd: null,
    };
  }

  const refreshedPeriodEnd = toMillis(refreshed.period_end);
  if (refreshedPeriodEnd && refreshedPeriodEnd > now) {
    if (refreshed.requests_used >= refreshed.request_limit) {
      return {
        error: "quota_exceeded",
        remaining: 0,
        limit: refreshed.request_limit,
        periodEnd: refreshedPeriodEnd,
        retryAfter: refreshedPeriodEnd - now,
      };
    }

    return {
      error: "",
      remaining: Math.max(0, refreshed.request_limit - refreshed.requests_used),
      limit: refreshed.request_limit,
      periodEnd: refreshedPeriodEnd,
    };
  }

  return {
    error: "",
    remaining: refreshed.request_limit,
    limit: refreshed.request_limit,
    periodEnd: now + FREE_PERIOD_MS,
  };
}

export async function captureBatchForReceiver(input: {
  slug: string;
  requests: ReceiverBufferedRequest[];
}): Promise<ReceiverCaptureResponse> {
  const endpoint = await getEndpointRowBySlug(input.slug);
  if (!endpoint) {
    return {
      success: false,
      error: "not_found",
      inserted: 0,
    };
  }

  const expiresAt = toMillis(endpoint.expires_at);
  if (expiresAt !== null && expiresAt <= Date.now()) {
    return {
      success: false,
      error: "expired",
      inserted: 0,
    };
  }

  const rows = buildRequestsInsertRows(endpoint, input.requests);
  const inserted = rows.length;
  const admin = createAdminClient();

  const { error: insertError } = await admin.from("requests").insert(rows);
  if (insertError) {
    throw insertError;
  }

  const { error: endpointCountError } = await callUntypedRpc<number>(
    "increment_endpoint_request_count",
    {
      p_endpoint_id: endpoint.id,
      p_count: inserted,
    }
  );
  if (endpointCountError) {
    throw endpointCountError;
  }

  if (endpoint.user_id) {
    const { error: usageError } = await callUntypedRpc<number>("increment_user_requests_used", {
      p_user_id: endpoint.user_id,
      p_count: inserted,
    });
    if (usageError) {
      throw usageError;
    }
  }

  return {
    success: true,
    error: "",
    inserted,
  };
}

export async function listUsersByPlanForReceiver(input: {
  plan: "free" | "pro";
  cursor?: string;
  limit?: number;
}): Promise<ReceiverUsersByPlanResponse> {
  const admin = createAdminClient();
  const limit = Math.min(
    Math.max(1, Math.floor(input.limit ?? DEFAULT_USERS_BY_PLAN_LIMIT)),
    MAX_USERS_BY_PLAN_LIMIT
  );

  let query = admin.from("users").select("id").eq("plan", input.plan).order("id", {
    ascending: true,
  });

  if (input.cursor) {
    query = query.gt("id", input.cursor);
  }

  const { data, error } = await query.limit(limit + 1).returns<Array<{ id: string }>>();
  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const userIds = rows.slice(0, limit).map((row) => row.id);
  const hasMore = rows.length > limit;

  return {
    error: "",
    userIds,
    nextCursor: hasMore ? rows[limit]?.id : undefined,
    done: !hasMore,
  };
}
