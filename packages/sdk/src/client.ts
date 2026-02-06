/**
 * @fileoverview webhooks.cc SDK client for programmatic webhook management.
 *
 * @example
 * ```typescript
 * const client = new WebhooksCC({ apiKey: 'whcc_...' });
 * const endpoint = await client.endpoints.create({ name: 'My Webhook' });
 * const request = await client.requests.waitFor(endpoint.slug, {
 *   timeout: 10000,
 *   match: (r) => r.method === 'POST'
 * });
 * ```
 */
import type {
  ClientOptions,
  ClientHooks,
  Endpoint,
  Request,
  CreateEndpointOptions,
  ListRequestsOptions,
  WaitForOptions,
} from "./types";
import {
  WebhooksCCError,
  UnauthorizedError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
} from "./errors";

const DEFAULT_BASE_URL = "https://webhooks.cc";
const DEFAULT_TIMEOUT = 30000;

// Poll interval bounds: 10ms minimum prevents busy loops, 60s maximum prevents stale connections
const MIN_POLL_INTERVAL = 10;
const MAX_POLL_INTERVAL = 60000;

/**
 * @deprecated Use {@link WebhooksCCError} instead. Kept for backward compatibility.
 */
export const ApiError = WebhooksCCError;

/** Map HTTP status codes to typed errors. */
function mapStatusToError(status: number, message: string, response: Response): WebhooksCCError {
  switch (status) {
    case 401:
      return new UnauthorizedError(message);
    case 404:
      return new NotFoundError(message);
    case 429: {
      const retryAfterHeader = response.headers.get("retry-after");
      let retryAfter: number | undefined;
      if (retryAfterHeader) {
        const parsed = parseInt(retryAfterHeader, 10);
        retryAfter = Number.isNaN(parsed) ? undefined : parsed;
      }
      return new RateLimitError(retryAfter);
    }
    default:
      return new WebhooksCCError(status, message);
  }
}

// Validates path segments to prevent traversal attacks (e.g., "../admin")
const SAFE_PATH_SEGMENT_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Validates that a URL path segment contains only safe characters.
 * Prevents path traversal attacks by rejecting "..", "/", and special characters.
 */
function validatePathSegment(segment: string, name: string): void {
  if (!SAFE_PATH_SEGMENT_REGEX.test(segment)) {
    throw new Error(
      `Invalid ${name}: must contain only alphanumeric characters, hyphens, and underscores`
    );
  }
}

/**
 * Client for the webhooks.cc API.
 *
 * Provides methods to create endpoints, list captured requests, and wait
 * for incoming webhooks. Handles authentication, request signing, and
 * response validation.
 */
export class WebhooksCC {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly hooks: ClientHooks;

  constructor(options: ClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.hooks = options.hooks ?? {};
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}/api${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    const start = Date.now();

    try {
      this.hooks.onRequest?.({ method, url });
    } catch {
      // Hooks must not break the request flow
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const durationMs = Date.now() - start;

      if (!response.ok) {
        const errorText = await response.text();
        const sanitizedError = errorText.length > 200 ? errorText.slice(0, 200) + "..." : errorText;
        const error = mapStatusToError(response.status, sanitizedError, response);
        try {
          this.hooks.onError?.({ method, url, error, durationMs });
        } catch {
          // Hooks must not break the request flow
        }
        throw error;
      }

      try {
        this.hooks.onResponse?.({ method, url, status: response.status, durationMs });
      } catch {
        // Hooks must not break the request flow
      }

      // Handle empty responses (204 No Content)
      if (response.status === 204 || response.headers.get("content-length") === "0") {
        return undefined as T;
      }

      // Validate Content-Type before parsing JSON
      const contentType = response.headers.get("content-type");
      if (contentType && !contentType.includes("application/json")) {
        throw new Error(`Unexpected content type: ${contentType}`);
      }
      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        const timeoutError = new TimeoutError(this.timeout);
        try {
          this.hooks.onError?.({
            method,
            url,
            error: timeoutError,
            durationMs: Date.now() - start,
          });
        } catch {
          // Hooks must not break the request flow
        }
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  endpoints = {
    create: async (options: CreateEndpointOptions = {}): Promise<Endpoint> => {
      return this.request<Endpoint>("POST", "/endpoints", options);
    },

    list: async (): Promise<Endpoint[]> => {
      return this.request<Endpoint[]>("GET", "/endpoints");
    },

    get: async (slug: string): Promise<Endpoint> => {
      validatePathSegment(slug, "slug");
      return this.request<Endpoint>("GET", `/endpoints/${slug}`);
    },

    delete: async (slug: string): Promise<void> => {
      validatePathSegment(slug, "slug");
      await this.request("DELETE", `/endpoints/${slug}`);
    },
  };

  requests = {
    list: async (endpointSlug: string, options: ListRequestsOptions = {}): Promise<Request[]> => {
      validatePathSegment(endpointSlug, "endpointSlug");
      const params = new URLSearchParams();
      if (options.limit !== undefined) params.set("limit", String(options.limit));
      if (options.since !== undefined) params.set("since", String(options.since));

      const query = params.toString();
      return this.request<Request[]>(
        "GET",
        `/endpoints/${endpointSlug}/requests${query ? `?${query}` : ""}`
      );
    },

    get: async (requestId: string): Promise<Request> => {
      validatePathSegment(requestId, "requestId");
      return this.request<Request>("GET", `/requests/${requestId}`);
    },

    /**
     * Polls for incoming requests until one matches or timeout expires.
     *
     * Fetches requests that arrived since the last successful check. On API
     * errors, continues polling without updating the timestamp to avoid
     * missing requests during transient failures.
     *
     * @param endpointSlug - Endpoint to monitor
     * @param options - Timeout, poll interval, and optional match filter
     * @returns First matching request, or first request if no match filter
     * @throws Error if timeout expires or max iterations (10000) reached
     */
    waitFor: async (endpointSlug: string, options: WaitForOptions = {}): Promise<Request> => {
      validatePathSegment(endpointSlug, "endpointSlug");
      const { timeout = 30000, pollInterval = 500, match } = options;
      // Clamp pollInterval to safe bounds
      const safePollInterval = Math.max(
        MIN_POLL_INTERVAL,
        Math.min(MAX_POLL_INTERVAL, pollInterval)
      );
      const start = Date.now();
      let lastChecked = 0;
      const MAX_ITERATIONS = 10000;
      let iterations = 0;

      while (Date.now() - start < timeout && iterations < MAX_ITERATIONS) {
        iterations++;
        const checkTime = Date.now();

        try {
          const requests = await this.requests.list(endpointSlug, {
            since: lastChecked,
            limit: 100,
          });

          lastChecked = checkTime;

          const matched = match ? requests.find(match) : requests[0];
          if (matched) {
            return matched;
          }
        } catch (error) {
          // Throw on non-transient errors - don't continue polling with invalid credentials
          if (error instanceof WebhooksCCError) {
            if (error instanceof UnauthorizedError) {
              throw error;
            }
            if (error instanceof NotFoundError) {
              throw error;
            }
            // Continue polling only for transient errors (5xx, rate limit)
            if (error.statusCode < 500 && !(error instanceof RateLimitError)) {
              throw error;
            }
          }
          // Continue polling for transient errors (network issues, 5xx) without updating lastChecked
          // to avoid missing requests during temporary issues
        }

        await sleep(safePollInterval);
      }

      throw new TimeoutError(timeout);
    },
  };
}

/** Returns a promise that resolves after the specified milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
