"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import { RequestList } from "@/components/dashboard/request-list";
import Link from "next/link";

export default function DashboardPage() {
  const endpoints = useQuery(api.endpoints.list);
  const { signOut } = useAuthActions();

  // Get the most recent endpoint
  const currentEndpoint = endpoints?.[0];

  const requests = useQuery(
    api.requests.list,
    currentEndpoint ? { endpointId: currentEndpoint._id, limit: 50 } : "skip"
  );

  if (endpoints === undefined) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-bold text-xl">
              webhooks.cc
            </Link>

            {/* Endpoint selector */}
            {endpoints.length > 0 && (
              <select className="border rounded px-3 py-1.5 text-sm">
                {endpoints.map((ep) => (
                  <option key={ep._id} value={ep._id}>
                    {ep.name || ep.slug}
                  </option>
                ))}
              </select>
            )}

            <Button size="sm" asChild>
              <Link href="/endpoints/new">New Endpoint</Link>
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/account"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Account
            </Link>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        {endpoints.length === 0 ? (
          <EmptyState />
        ) : currentEndpoint ? (
          <div className="space-y-6">
            {/* Endpoint info */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">
                  {currentEndpoint.name || currentEndpoint.slug}
                </h1>
                <code className="text-sm text-muted-foreground">
                  https://webhooks.cc/w/{currentEndpoint.slug}
                </code>
              </div>
              <Button variant="outline" asChild>
                <Link href={`/endpoints/${currentEndpoint.slug}/settings`}>
                  Settings
                </Link>
              </Button>
            </div>

            {/* Requests */}
            {requests && requests.length > 0 ? (
              <RequestList requests={requests} />
            ) : (
              <div className="border rounded-lg p-12 text-center">
                <p className="text-muted-foreground mb-4">
                  No requests yet. Send a webhook to get started.
                </p>
                <code className="bg-muted p-3 rounded text-sm block">
                  curl -X POST https://webhooks.cc/w/{currentEndpoint.slug} -d
                  &apos;test&apos;
                </code>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <h2 className="text-xl font-semibold mb-2">No endpoints yet</h2>
      <p className="text-muted-foreground mb-6">
        Create your first endpoint to start capturing webhooks.
      </p>
      <Button asChild>
        <Link href="/endpoints/new">Create endpoint</Link>
      </Button>
    </div>
  );
}
