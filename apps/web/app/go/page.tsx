import { GuestLiveDashboard } from "@/components/go/guest-live-dashboard";
import { createPageMetadata } from "@/lib/seo";
import { JsonLd, faqSchema, softwareApplicationSchema } from "@/lib/schemas";

const GO_FAQ_ITEMS = [
  {
    question: "Is there a free webhook endpoint with no signup?",
    answer:
      "Yes. The /go page creates a temporary guest endpoint so you can send a webhook and inspect the payload immediately without creating an account first.",
  },
  {
    question: "What makes webhooks.cc a Webhook.site alternative?",
    answer:
      "webhooks.cc combines live inspection with CLI, a TypeScript SDK for automated tests, and an MCP server for AI coding agents, so teams can move from manual tests to repeatable workflows.",
  },
  {
    question: "Can I test webhooks locally and in CI?",
    answer:
      "Yes. You can use the CLI to forward events to localhost during development and use the SDK in automated test suites for CI pipelines.",
  },
] as const;

export const metadata = createPageMetadata({
  title: "Free Webhook Endpoint: Webhook.site Alternative",
  description:
    "Create a free guest webhook endpoint and inspect requests live in seconds. Test webhooks instantly with CLI, SDK, and MCP workflows in a Webhook.site alternative.",
  path: "/go",
  keywords: [
    "free webhook endpoint",
    "guest webhook endpoint",
    "live webhook test",
    "test webhook online",
    "webhook request inspector",
    "webhook.site alternative",
    "webhook cli",
    "webhook sdk",
    "webhook mcp",
  ],
});

export default function GoPage() {
  return (
    <main>
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd data={faqSchema([...GO_FAQ_ITEMS])} />
      <GuestLiveDashboard />
    </main>
  );
}
