#!/usr/bin/env npx tsx
/**
 * Data migration: Convex production → Supabase
 *
 * Migrates users, endpoints, api_keys, and requests from a Convex export
 * (created via `npx convex export --prod`) into a Supabase instance.
 *
 * Usage:
 *   npx tsx scripts/migrate-convex-to-supabase.ts --from-files=./convex-export
 *   npx tsx scripts/migrate-convex-to-supabase.ts --from-files=./convex-export --dry-run
 *
 * Required env vars (set in .env.local or export):
 *   SUPABASE_URL          — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key
 *
 * The script is idempotent: re-running skips already-migrated rows.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes("--dry-run");

const SUPABASE_URL = mustEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

function mustEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return val;
}

// ---------------------------------------------------------------------------
// Types: Convex documents
// ---------------------------------------------------------------------------

interface ConvexUser {
  _id: string;
  _creationTime: number;
  email: string;
  name?: string;
  image?: string;
  plan: "free" | "pro";
  polarCustomerId?: string;
  polarSubscriptionId?: string;
  subscriptionStatus?: "active" | "canceled" | "past_due";
  periodStart?: number;
  periodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  requestsUsed: number;
  requestLimit: number;
  createdAt: number;
}

interface ConvexEndpoint {
  _id: string;
  _creationTime: number;
  userId?: string;
  slug: string;
  name?: string;
  mockResponse?: { status: number; body: string; headers: Record<string, string> };
  isEphemeral: boolean;
  expiresAt?: number;
  requestCount: number;
}

interface ConvexApiKey {
  _id: string;
  _creationTime: number;
  userId: string;
  keyHash: string;
  keyPrefix: string;
  name: string;
  lastUsedAt?: number;
  expiresAt?: number;
  createdAt: number;
}

interface ConvexRequest {
  _id: string;
  _creationTime: number;
  endpointId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
  queryParams: Record<string, string>;
  contentType?: string;
  ip: string;
  size: number;
  receivedAt: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}

function msToIsoOrNull(ms: number | undefined): string | null {
  return ms != null ? new Date(ms).toISOString() : null;
}

function log(msg: string) {
  const prefix = DRY_RUN ? "[DRY RUN] " : "";
  console.log(`${prefix}${msg}`);
}

// ---------------------------------------------------------------------------
// Read from Convex export directory (created by `npx convex export`)
// Structure: tableName/documents.jsonl (one JSON object per line)
// ---------------------------------------------------------------------------

function readJsonl<T>(filePath: string): T[] {
  const content = readFileSync(filePath, "utf-8").trim();
  if (!content) return [];
  return content.split("\n").map((line) => JSON.parse(line) as T);
}

function readFromFiles(dir: string) {
  return {
    users: readJsonl<ConvexUser>(join(dir, "users/documents.jsonl")),
    endpoints: readJsonl<ConvexEndpoint>(join(dir, "endpoints/documents.jsonl")),
    apiKeys: readJsonl<ConvexApiKey>(join(dir, "apiKeys/documents.jsonl")),
    requests: readJsonl<ConvexRequest>(join(dir, "requests/documents.jsonl")),
  };
}

// ---------------------------------------------------------------------------
// Migration steps
// ---------------------------------------------------------------------------

async function migrateUsers(
  admin: SupabaseClient,
  users: ConvexUser[]
): Promise<Map<string, string>> {
  log(`\nMigrating ${users.length} users...`);
  const idMap = new Map<string, string>(); // convexId -> supabaseId

  for (const user of users) {
    // Check if user already exists by email
    const { data: existing } = await admin
      .from("users")
      .select("id, email")
      .eq("email", user.email)
      .maybeSingle();

    if (existing) {
      log(`  SKIP user ${user.email} (already exists as ${existing.id})`);
      idMap.set(user._id, existing.id);
      continue;
    }

    if (DRY_RUN) {
      log(`  WOULD create auth user: ${user.email} (${user.plan})`);
      idMap.set(user._id, `dry-run-${user._id}`);
      continue;
    }

    // Create auth user (triggers handle_new_user → inserts public.users row)
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: user.email,
      email_confirm: true,
      user_metadata: {
        full_name: user.name,
        avatar_url: user.image,
      },
    });

    if (authError) {
      console.error(`  ERROR creating auth user ${user.email}:`, authError.message);
      continue;
    }

    const supabaseId = authUser.user.id;
    idMap.set(user._id, supabaseId);

    // Backfill user fields not set by the trigger
    const { error: updateError } = await admin
      .from("users")
      .update({
        plan: user.plan,
        polar_customer_id: user.polarCustomerId ?? null,
        polar_subscription_id: user.polarSubscriptionId ?? null,
        subscription_status: user.subscriptionStatus ?? null,
        period_start: msToIsoOrNull(user.periodStart),
        period_end: msToIsoOrNull(user.periodEnd),
        cancel_at_period_end: user.cancelAtPeriodEnd ?? false,
        requests_used: user.requestsUsed,
        request_limit: user.requestLimit,
      })
      .eq("id", supabaseId);

    if (updateError) {
      console.error(`  ERROR backfilling user ${user.email}:`, updateError.message);
    } else {
      log(`  OK user ${user.email} → ${supabaseId}`);
    }
  }

  return idMap;
}

async function migrateEndpoints(
  admin: SupabaseClient,
  endpoints: ConvexEndpoint[],
  userIdMap: Map<string, string>
): Promise<Map<string, string>> {
  log(`\nMigrating ${endpoints.length} endpoints...`);
  const idMap = new Map<string, string>(); // convexId -> supabaseId

  // Filter out ephemeral endpoints (they're transient by design)
  const persistentEndpoints = endpoints.filter((e) => !e.isEphemeral);
  log(`  (${endpoints.length - persistentEndpoints.length} ephemeral endpoints skipped)`);

  for (const ep of persistentEndpoints) {
    // Check if endpoint already exists by slug
    const { data: existing } = await admin
      .from("endpoints")
      .select("id")
      .eq("slug", ep.slug)
      .maybeSingle();

    if (existing) {
      log(`  SKIP endpoint ${ep.slug} (already exists)`);
      idMap.set(ep._id, existing.id);
      continue;
    }

    const supabaseUserId = ep.userId ? userIdMap.get(ep.userId) : null;
    if (ep.userId && !supabaseUserId) {
      console.error(`  ERROR endpoint ${ep.slug}: user ${ep.userId} not found in map`);
      continue;
    }

    if (DRY_RUN) {
      log(`  WOULD create endpoint: ${ep.slug} (user: ${supabaseUserId ?? "none"})`);
      idMap.set(ep._id, `dry-run-${ep._id}`);
      continue;
    }

    const { data: created, error } = await admin
      .from("endpoints")
      .insert({
        user_id: supabaseUserId ?? null,
        slug: ep.slug,
        name: ep.name ?? null,
        mock_response: ep.mockResponse ?? null,
        is_ephemeral: false,
        expires_at: msToIsoOrNull(ep.expiresAt),
        request_count: ep.requestCount ?? 0,
        created_at: msToIso(ep._creationTime),
      })
      .select("id")
      .single();

    if (error) {
      console.error(`  ERROR creating endpoint ${ep.slug}:`, error.message);
    } else {
      idMap.set(ep._id, created.id);
      log(`  OK endpoint ${ep.slug} → ${created.id}`);
    }
  }

  return idMap;
}

async function migrateApiKeys(
  admin: SupabaseClient,
  apiKeys: ConvexApiKey[],
  userIdMap: Map<string, string>
): Promise<void> {
  log(`\nMigrating ${apiKeys.length} API keys...`);

  for (const key of apiKeys) {
    // Check if key already exists by hash
    const { data: existing } = await admin
      .from("api_keys")
      .select("id")
      .eq("key_hash", key.keyHash)
      .maybeSingle();

    if (existing) {
      log(`  SKIP api_key ${key.keyPrefix}... (already exists)`);
      continue;
    }

    const supabaseUserId = userIdMap.get(key.userId);
    if (!supabaseUserId) {
      console.error(`  ERROR api_key ${key.keyPrefix}: user ${key.userId} not found in map`);
      continue;
    }

    if (DRY_RUN) {
      log(`  WOULD create api_key: ${key.keyPrefix}... (user: ${supabaseUserId})`);
      continue;
    }

    const { error } = await admin.from("api_keys").insert({
      user_id: supabaseUserId,
      key_hash: key.keyHash,
      key_prefix: key.keyPrefix,
      name: key.name,
      last_used_at: msToIsoOrNull(key.lastUsedAt),
      expires_at: msToIsoOrNull(key.expiresAt),
      created_at: msToIso(key.createdAt),
    });

    if (error) {
      console.error(`  ERROR creating api_key ${key.keyPrefix}:`, error.message);
    } else {
      log(`  OK api_key ${key.keyPrefix}...`);
    }
  }
}

async function migrateRequests(
  admin: SupabaseClient,
  requests: ConvexRequest[],
  endpointIdMap: Map<string, string>,
  endpointToUser: Map<string, string | null>
): Promise<void> {
  log(`\nMigrating ${requests.length} requests...`);

  // Batch insert for performance
  const BATCH_SIZE = 100;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  // Filter to requests whose endpoints were migrated
  const migratable = requests.filter((r) => endpointIdMap.has(r.endpointId));
  log(`  (${requests.length - migratable.length} requests for unmigrated endpoints skipped)`);

  for (let i = 0; i < migratable.length; i += BATCH_SIZE) {
    const batch = migratable.slice(i, i + BATCH_SIZE);

    const rows = batch.map((req) => {
      const supabaseEndpointId = endpointIdMap.get(req.endpointId)!;
      const supabaseUserId = endpointToUser.get(req.endpointId) ?? null;

      return {
        endpoint_id: supabaseEndpointId,
        user_id: supabaseUserId,
        method: req.method,
        path: req.path,
        headers: req.headers,
        body: req.body ?? null,
        query_params: req.queryParams,
        content_type: req.contentType ?? null,
        ip: req.ip,
        size: req.size,
        received_at: msToIso(req.receivedAt),
      };
    });

    if (DRY_RUN) {
      inserted += rows.length;
      continue;
    }

    const { error } = await admin.from("requests").insert(rows);

    if (error) {
      // On conflict, try one at a time
      for (const row of rows) {
        const { error: singleError } = await admin.from("requests").insert(row);
        if (singleError) {
          errors++;
        } else {
          inserted++;
        }
      }
    } else {
      inserted += rows.length;
    }

    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= migratable.length) {
      log(`  Progress: ${Math.min(i + BATCH_SIZE, migratable.length)}/${migratable.length}`);
    }
  }

  log(`  Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log("=== Convex → Supabase Data Migration ===");
  log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}\n`);

  // Connect to Supabase
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Read exported data from Convex export directory
  const exportDirArg = process.argv.find((a) => a.startsWith("--from-files="));
  if (!exportDirArg) {
    console.error(
      "Usage: npx tsx scripts/migrate-convex-to-supabase.ts --from-files=./convex-export [--dry-run]"
    );
    process.exit(1);
  }

  const dir = exportDirArg.split("=")[1];
  log(`Reading from exported files in: ${dir}`);
  const data = readFromFiles(dir);

  log(
    `\nExported: ${data.users.length} users, ${data.endpoints.length} endpoints, ${data.apiKeys.length} api_keys, ${data.requests.length} requests`
  );

  // Step 1: Migrate users (creates auth users + public.users rows)
  const userIdMap = await migrateUsers(admin, data.users);

  // Step 2: Migrate endpoints (map Convex user IDs → Supabase user IDs)
  // Build endpoint→user mapping for request denormalization
  const endpointToConvexUser = new Map<string, string | undefined>();
  for (const ep of data.endpoints) {
    endpointToConvexUser.set(ep._id, ep.userId);
  }

  const endpointIdMap = await migrateEndpoints(admin, data.endpoints, userIdMap);

  // Build endpoint→supabaseUser mapping for requests
  const endpointToSupabaseUser = new Map<string, string | null>();
  for (const ep of data.endpoints) {
    const convexUserId = ep.userId;
    const supabaseUserId = convexUserId ? (userIdMap.get(convexUserId) ?? null) : null;
    endpointToSupabaseUser.set(ep._id, supabaseUserId);
  }

  // Step 3: Migrate API keys
  await migrateApiKeys(admin, data.apiKeys, userIdMap);

  // Step 4: Migrate requests
  await migrateRequests(admin, data.requests, endpointIdMap, endpointToSupabaseUser);

  log("\n=== Migration complete ===");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
