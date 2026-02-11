import Link from "next/link";
import { createPageMetadata } from "@/lib/seo";
import { McpInstallButtons, SetupCommandsTable, CopyableCode } from "./mcp-setup";

export const metadata = createPageMetadata({
  title: "MCP Server Docs",
  description:
    "Connect your AI coding agent to webhooks.cc with the MCP server. Works with Claude Code, Cursor, VS Code, Codex, and Windsurf.",
  path: "/docs/mcp",
});

const TOOLS = [
  {
    name: "create_endpoint",
    description: "Create a new webhook endpoint",
    example: '"Create a webhook endpoint called stripe-test"',
  },
  {
    name: "list_endpoints",
    description: "List all your endpoints",
    example: '"Show me my webhook endpoints"',
  },
  {
    name: "get_endpoint",
    description: "Get details for an endpoint by slug",
    example: '"What\'s the URL for my stripe-test endpoint?"',
  },
  {
    name: "update_endpoint",
    description: "Update an endpoint name or mock response",
    example: '"Set stripe-test to return a 201 with {\"ok\":true}"',
  },
  {
    name: "delete_endpoint",
    description: "Delete an endpoint and its requests",
    example: '"Delete the stripe-test endpoint"',
  },
  {
    name: "list_requests",
    description: "List captured requests for an endpoint",
    example: '"Show me the last 10 requests on stripe-test"',
  },
  {
    name: "get_request",
    description: "Get full details of a captured request",
    example: '"Show me the body of request abc123"',
  },
  {
    name: "send_test_webhook",
    description: "Send a test webhook to an endpoint",
    example: '"Send a POST with {\"event\":\"test\"} to stripe-test"',
  },
  {
    name: "wait_for_request",
    description: "Wait for an incoming request (polling)",
    example: '"Wait for a POST on stripe-test for 30 seconds"',
  },
  {
    name: "replay_request",
    description: "Replay a captured request to a target URL",
    example: '"Replay request abc123 to http://localhost:3000/webhooks"',
  },
  {
    name: "describe_sdk",
    description: "Describe all available SDK operations",
    example: '"What can you do with webhooks.cc?"',
  },
];

export default function McpPage() {
  return (
    <article>
      <h1 className="text-3xl md:text-4xl font-bold mb-4">MCP Server</h1>
      <p className="text-lg text-muted-foreground mb-6">
        The <code className="font-mono font-bold">@webhooks-cc/mcp</code> package lets AI coding
        agents create endpoints, inspect webhooks, send test payloads, and replay captured requests
        — all through natural language.
      </p>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-4">One-click install</h2>
        <McpInstallButtons />
        <p className="text-sm text-muted-foreground mt-3">
          Cursor uses a placeholder API key you&apos;ll need to replace. VS Code prompts you for
          your key during install.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">Setup via CLI</h2>
        <p className="text-muted-foreground mb-4">
          Or use the setup command. Get your API key from your{" "}
          <Link href="/account" className="text-primary hover:underline font-bold">
            account page
          </Link>
          , then run:
        </p>
        <SetupCommandsTable />
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">Manual configuration</h2>
        <p className="text-muted-foreground mb-4">
          If you prefer to configure manually, use this stdio server config:
        </p>
        <CopyableCode
          text={`{
  "mcpServers": {
    "webhooks-cc": {
      "command": "npx",
      "args": ["-y", "@webhooks-cc/mcp"],
      "env": {
        "WHK_API_KEY": "whcc_..."
      }
    }
  }
}`}
        >{`{
  "mcpServers": {
    "webhooks-cc": {
      "command": "npx",
      "args": ["-y", "@webhooks-cc/mcp"],
      "env": {
        "WHK_API_KEY": "whcc_..."
      }
    }
  }
}`}</CopyableCode>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">Environment variables</h2>
        <div className="neo-code text-sm overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-foreground/20">
                <th className="text-left py-1.5 pr-3 font-bold">Variable</th>
                <th className="text-left py-1.5 pr-3 font-bold">Required</th>
                <th className="text-left py-1.5 font-bold">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-foreground/20">
                <td className="py-1.5 pr-3">
                  <code>WHK_API_KEY</code>
                </td>
                <td className="py-1.5 pr-3">Yes</td>
                <td className="py-1.5 text-muted-foreground">Your webhooks.cc API key</td>
              </tr>
              <tr className="border-b border-foreground/20">
                <td className="py-1.5 pr-3">
                  <code>WHK_WEBHOOK_URL</code>
                </td>
                <td className="py-1.5 pr-3">No</td>
                <td className="py-1.5 text-muted-foreground">
                  Override webhook receiver URL (default: production)
                </td>
              </tr>
              <tr className="border-b border-foreground/20 last:border-0">
                <td className="py-1.5 pr-3">
                  <code>WHK_BASE_URL</code>
                </td>
                <td className="py-1.5 pr-3">No</td>
                <td className="py-1.5 text-muted-foreground">
                  Override API base URL (default: production)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">Available tools</h2>
        <p className="text-muted-foreground mb-4">
          The MCP server exposes 11 tools your AI agent can call:
        </p>
        <div className="space-y-4">
          {TOOLS.map((tool) => (
            <div key={tool.name} className="neo-code text-sm p-3">
              <div className="flex items-start justify-between gap-4 mb-1">
                <code className="font-bold">{tool.name}</code>
              </div>
              <p className="text-muted-foreground mb-1">{tool.description}</p>
              <p className="text-xs text-muted-foreground/70">
                Try: <span className="italic">{tool.example}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">Example conversation</h2>
        <p className="text-muted-foreground mb-4">
          With the MCP server connected, you can talk to your AI agent naturally:
        </p>
        <pre className="neo-code text-sm">{`You: "Create a webhook endpoint for testing Stripe"
Agent: Created endpoint "stripe-test" at https://go.webhooks.cc/w/abc123

You: "Set it to return 201 with {"received": true}"
Agent: Updated mock response for stripe-test

You: "Send a test POST with a checkout.session.completed event"
Agent: Sent POST to stripe-test with event payload

You: "Show me what was captured"
Agent: 1 request captured:
  POST /w/abc123 — {"event": "checkout.session.completed", ...}

You: "Replay that to my local server"
Agent: Replayed to http://localhost:3000/webhooks — got 200 OK`}</pre>
      </section>

      <section className="border-t-2 border-foreground pt-8">
        <h2 className="text-xl font-bold mb-4">Learn more</h2>
        <ul className="space-y-2">
          <li>
            <Link href="/docs/sdk" className="text-primary hover:underline font-bold">
              SDK Overview
            </Link>{" "}
            <span className="text-muted-foreground">
              — the TypeScript SDK that powers the MCP server
            </span>
          </li>
          <li>
            <Link href="/docs/sdk/api" className="text-primary hover:underline font-bold">
              API Reference
            </Link>{" "}
            <span className="text-muted-foreground">— all methods, matchers, and types</span>
          </li>
          <li>
            <Link href="/docs/sdk/testing" className="text-primary hover:underline font-bold">
              Testing patterns
            </Link>{" "}
            <span className="text-muted-foreground">— CI/CD integration examples</span>
          </li>
        </ul>
      </section>
    </article>
  );
}
