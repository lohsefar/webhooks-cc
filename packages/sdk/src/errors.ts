/**
 * Base error class for all webhooks.cc SDK errors.
 * Extends the standard Error with an HTTP status code.
 */
export class WebhooksCCError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "WebhooksCCError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when the API key is invalid or missing (401). */
export class UnauthorizedError extends WebhooksCCError {
  constructor(message = "Invalid or missing API key") {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}

/** Thrown when the requested resource does not exist (404). */
export class NotFoundError extends WebhooksCCError {
  constructor(message = "Resource not found") {
    super(404, message);
    this.name = "NotFoundError";
  }
}

/** Thrown when the request times out. */
export class TimeoutError extends WebhooksCCError {
  constructor(timeoutMs: number) {
    super(0, `Request timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

/** Thrown when the API returns 429 Too Many Requests. */
export class RateLimitError extends WebhooksCCError {
  /** Seconds until the rate limit resets, if provided by the server. */
  public readonly retryAfter?: number;

  constructor(retryAfter?: number) {
    const message = retryAfter
      ? `Rate limited, retry after ${retryAfter}s`
      : "Rate limited";
    super(429, message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}
