/**
 * Rate limiter configuration for webhooks.cc.
 *
 * Uses token bucket algorithm for ephemeral endpoint rate limiting:
 * - 50 tokens per 10 minutes (matches ephemeral endpoint TTL)
 * - Users can burst 50 requests at once, or spread them over 10 minutes
 */
import { RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";
import { EPHEMERAL_TTL_MS } from "./config";

// Rate limit for ephemeral/demo endpoints: 50 requests per 10 minutes
export const EPHEMERAL_RATE_LIMIT = 50;

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Token bucket for ephemeral endpoints
  // Key: endpoint slug
  // Capacity: 50 tokens (requests)
  // Refill: full bucket every 10 minutes (matches endpoint TTL)
  ephemeralEndpoint: {
    kind: "token bucket",
    rate: EPHEMERAL_RATE_LIMIT,
    period: EPHEMERAL_TTL_MS,
    capacity: EPHEMERAL_RATE_LIMIT,
  },
});
