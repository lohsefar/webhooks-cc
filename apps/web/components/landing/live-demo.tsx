"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { RequestList } from "@/components/dashboard/request-list";

export function LiveDemo() {
  const [endpointSlug, setEndpointSlug] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const createEndpoint = useMutation(api.endpoints.create);

  // Check for existing ephemeral endpoint in localStorage
  useEffect(() => {
    const stored = localStorage.getItem("demo_endpoint");
    if (stored) {
      try {
        const { slug, expiresAt } = JSON.parse(stored);
        if (expiresAt > Date.now()) {
          setEndpointSlug(slug);
        } else {
          localStorage.removeItem("demo_endpoint");
        }
      } catch {
        localStorage.removeItem("demo_endpoint");
      }
    }
  }, []);

  const handleCreateEndpoint = async () => {
    setIsCreating(true);
    try {
      const result = await createEndpoint({ isEphemeral: true });
      setEndpointSlug(result.slug);
      localStorage.setItem(
        "demo_endpoint",
        JSON.stringify({
          slug: result.slug,
          expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        })
      );
    } finally {
      setIsCreating(false);
    }
  };

  const endpointUrl = endpointSlug
    ? `https://webhooks.cc/w/${endpointSlug}`
    : null;

  const curlCommand = endpointUrl
    ? `curl -X POST ${endpointUrl} -H "Content-Type: application/json" -d '{"hello": "world"}'`
    : null;

  return (
    <div className="border rounded-lg p-8 bg-card">
      <h2 className="text-2xl font-bold mb-6 text-center">Try it now</h2>

      {!endpointSlug ? (
        <div className="text-center">
          <p className="text-muted-foreground mb-4">
            Create a temporary endpoint to see webhooks in action.
            No signup required.
          </p>
          <Button onClick={handleCreateEndpoint} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create test endpoint"}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Endpoint URL */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Your endpoint URL
            </label>
            <div className="flex gap-2">
              <code className="flex-1 bg-muted p-3 rounded text-sm font-mono overflow-x-auto">
                {endpointUrl}
              </code>
              <Button
                variant="outline"
                onClick={() => navigator.clipboard.writeText(endpointUrl!)}
              >
                Copy
              </Button>
            </div>
          </div>

          {/* Curl command */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Send a test request
            </label>
            <div className="flex gap-2">
              <code className="flex-1 bg-muted p-3 rounded text-sm font-mono overflow-x-auto whitespace-pre">
                {curlCommand}
              </code>
              <Button
                variant="outline"
                onClick={() => navigator.clipboard.writeText(curlCommand!)}
              >
                Copy
              </Button>
            </div>
          </div>

          {/* Request list */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Incoming requests
            </label>
            <DemoRequestList slug={endpointSlug} />
          </div>

          <p className="text-center text-sm text-muted-foreground">
            This endpoint expires in 10 minutes.{" "}
            <a href="/login" className="underline">
              Sign up
            </a>{" "}
            to keep your endpoints.
          </p>
        </div>
      )}
    </div>
  );
}

function DemoRequestList({ slug }: { slug: string }) {
  const endpoint = useQuery(api.endpoints.getBySlug, { slug });
  const requests = useQuery(
    api.requests.list,
    endpoint ? { endpointId: endpoint._id, limit: 10 } : "skip"
  );

  if (!endpoint) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="border rounded p-8 text-center text-muted-foreground">
        Waiting for requests...
      </div>
    );
  }

  return <RequestList requests={requests} />;
}
