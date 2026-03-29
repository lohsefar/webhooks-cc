import { describe, it, expect } from "vitest";
import {
  WebhooksCCError,
  UnauthorizedError,
  NotFoundError,
  TimeoutError,
  RateLimitError,
} from "../errors";

describe("WebhooksCCError", () => {
  it("stores statusCode and message", () => {
    const err = new WebhooksCCError(500, "Internal error");
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("Internal error");
    expect(err.name).toBe("WebhooksCCError");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("UnauthorizedError", () => {
  it("has statusCode 401 and default message", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Invalid or missing API key");
    expect(err.name).toBe("UnauthorizedError");
    expect(err).toBeInstanceOf(WebhooksCCError);
  });

  it("accepts custom message", () => {
    const err = new UnauthorizedError("Token expired");
    expect(err.message).toBe("Token expired");
  });
});

describe("NotFoundError", () => {
  it("has statusCode 404 and default message", () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Resource not found");
    expect(err.name).toBe("NotFoundError");
    expect(err).toBeInstanceOf(WebhooksCCError);
  });
});

describe("TimeoutError", () => {
  it("has statusCode 0 and timeout message", () => {
    const err = new TimeoutError(5000);
    expect(err.statusCode).toBe(0);
    expect(err.message).toBe("Request timed out after 5000ms");
    expect(err.name).toBe("TimeoutError");
    expect(err).toBeInstanceOf(WebhooksCCError);
  });
});

describe("RateLimitError", () => {
  it("has statusCode 429", () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.name).toBe("RateLimitError");
    expect(err).toBeInstanceOf(WebhooksCCError);
  });

  it("stores retryAfter when provided", () => {
    const err = new RateLimitError(30);
    expect(err.retryAfter).toBe(30);
    expect(err.message).toBe("Rate limited, retry after 30s");
  });

  it("has default message when retryAfter is not provided", () => {
    const err = new RateLimitError();
    expect(err.retryAfter).toBeUndefined();
    expect(err.message).toBe("Rate limited");
  });

  it("backwards compat: limit/remaining/reset are undefined without meta", () => {
    const err = new RateLimitError(10);
    expect(err.limit).toBeUndefined();
    expect(err.remaining).toBeUndefined();
    expect(err.reset).toBeUndefined();
  });

  it("stores rate limit metadata when provided", () => {
    const meta = { limit: 100, remaining: 0, reset: 1711612800 };
    const err = new RateLimitError(60, meta);
    expect(err.retryAfter).toBe(60);
    expect(err.limit).toBe(100);
    expect(err.remaining).toBe(0);
    expect(err.reset).toBe(1711612800);
  });

  it("stores meta fields independently from retryAfter", () => {
    const meta = { limit: 50, remaining: 3, reset: 1711612900 };
    const err = new RateLimitError(undefined, meta);
    expect(err.retryAfter).toBeUndefined();
    expect(err.limit).toBe(50);
    expect(err.remaining).toBe(3);
    expect(err.reset).toBe(1711612900);
  });

  it("works with zero retryAfter and meta", () => {
    const meta = { limit: 10, remaining: 0, reset: 1711613000 };
    // retryAfter = 0 is falsy, so message should be "Rate limited"
    const err = new RateLimitError(0, meta);
    expect(err.retryAfter).toBe(0);
    expect(err.message).toBe("Rate limited");
    expect(err.limit).toBe(10);
    expect(err.remaining).toBe(0);
    expect(err.reset).toBe(1711613000);
  });
});
