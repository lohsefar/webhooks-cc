import Link from "next/link";
import { BlogPostShell } from "@/components/blog/blog-post-shell";
import { getBlogPostBySlug } from "@/lib/blog";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Debug Webhooks with AI Agents via MCP",
  description:
    "Connect AI coding agents to webhooks.cc and automate endpoint creation, inspection, sending, and replay.",
  path: "/blog/ai-agents-debug-webhooks-mcp",
});

const post = getBlogPostBySlug("ai-agents-debug-webhooks-mcp");

const sections = [
  { id: "why-mcp", label: "Why MCP for webhooks" },
  { id: "setup", label: "Setup" },
  { id: "workflow", label: "Debug workflow" },
  { id: "signed-templates", label: "Signed templates" },
  { id: "guardrails", label: "Guardrails" },
] as const;

export default function McpDebugBlogPage() {
  if (!post) return null;

  return (
    <BlogPostShell post={post} sections={sections}>
      <p>
        MCP lets your coding agent call webhook tools directly: create endpoints, send test
        payloads, inspect captured requests, and replay to local targets. You can keep the whole
        debug loop in a single chat instead of switching between tabs.
      </p>

      <h2 id="why-mcp">Why MCP helps webhook debugging</h2>
      <ul>
        <li>Fast iteration: no manual copy/paste between tools.</li>
        <li>Better context: the agent sees recent requests and can compare attempts.</li>
        <li>Automation-friendly: the same flow can be reused in scripts and checks.</li>
      </ul>

      <h2 id="setup">1. Set up MCP server</h2>
      <pre className="neo-code text-sm">{`npx @webhooks-cc/mcp setup codex --api-key whcc_...`}</pre>
      <p>
        After setup, confirm your agent can call tools like <code>create_endpoint</code>,
        <code>send_webhook</code>, and <code>list_requests</code>.
      </p>

      <h2 id="workflow">2. Example debug workflow</h2>
      <pre className="neo-code text-sm">{`Create an endpoint named stripe-debug.
Send a Stripe checkout.session.completed template to stripe-debug with secret whsec_dev.
Show the last 3 requests for stripe-debug.
Replay the latest request to http://localhost:3000/webhooks.`}</pre>
      <p>This sequence validates receive, inspect, and local handler behavior in one pass.</p>

      <h2 id="signed-templates">3. Use signed provider templates</h2>
      <p>
        The MCP <code>send_webhook</code> tool supports provider templates for Stripe, GitHub,
        Shopify, and Twilio. Pass <code>provider</code>, optional <code>template</code>, and a mock
        webhook secret to generate signature headers that match provider expectations.
      </p>
      <pre className="neo-code text-sm">{`Send a GitHub pull_request.opened template to repo-hooks with secret github_test_secret`}</pre>

      <h2 id="guardrails">4. Add guardrails</h2>
      <ul>
        <li>Use dedicated endpoints per integration under test.</li>
        <li>Use test-only secrets, never production signing secrets.</li>
        <li>Replay only to trusted local or staging URLs.</li>
      </ul>

      <p>
        See the full tool list in the <Link href="/docs/mcp">MCP docs</Link>.
      </p>
    </BlogPostShell>
  );
}
