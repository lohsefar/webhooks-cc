import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/stats
 * Public endpoint returning site-wide aggregate stats for the landing page.
 * Cached for 1 hour — the cron refreshes the underlying data 4x/day.
 */
export async function GET() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("site_stats")
    .select("total_webhooks, total_endpoints, total_users, updated_at")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { total_webhooks: 0, total_endpoints: 0, total_users: 0 },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } }
    );
  }

  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
  });
}
