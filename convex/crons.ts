import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up expired ephemeral endpoints every 5 minutes
crons.interval("cleanup expired endpoints", { minutes: 5 }, internal.requests.cleanupExpired);

// Clean up expired device codes every 5 minutes
crons.interval("cleanup expired device codes", { minutes: 5 }, internal.deviceAuth.cleanupExpired);

// Check billing period resets daily at midnight UTC
crons.daily(
  "check billing period resets",
  { hourUTC: 0, minuteUTC: 0 },
  internal.billing.checkPeriodResets
);

// Clean up expired API keys daily at 2 AM UTC
crons.daily(
  "cleanup expired api keys",
  { hourUTC: 2, minuteUTC: 0 },
  internal.apiKeys.cleanupExpired
);

// Clean up old requests for free users (7-day retention)
crons.daily(
  "cleanup old free requests",
  { hourUTC: 1, minuteUTC: 30 },
  internal.requests.cleanupOldFreeRequests,
  { cursor: undefined }
);

// Clean up old requests for pro users (30-day retention)
crons.daily(
  "cleanup old requests",
  { hourUTC: 1, minuteUTC: 0 },
  internal.requests.cleanupOldRequests,
  { cursor: undefined }
);

export default crons;
