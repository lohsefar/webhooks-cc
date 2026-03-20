export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  items: string[];
}

export const APP_VERSION = "0.9.1";

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.9.1",
    date: "2026-03-20",
    title: "Provider Templates & Mock Response Delay",
    items: [
      "Add SendGrid, Clerk, Discord, Vercel, GitLab provider templates (12 total)",
      "Configurable response delay for mock responses (0-30s)",
      "Comprehensive analytics tracking for request and endpoint operations",
      "New provider template reference documentation page",
      "SDK and MCP bumped to v1.0.1",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-03-16",
    title: "AppSignal & Next.js 16 Proxy",
    items: [
      "Replace Sentry with AppSignal for EU data residency compliance",
      "OpenTelemetry tracing pipeline for Rust receiver",
      "Migrate Next.js middleware.ts to proxy.ts (Next.js 16)",
      "Proxy test webhook sends through server-side API route",
      "Fix hono prototype pollution vulnerability (CVE)",
    ],
  },
  {
    version: "0.8.1",
    date: "2026-03-14",
    title: "CLI Improvements",
    items: [
      "Support base path in tunnel target (e.g. whk tunnel 8080/api/webhooks)",
      "Fix TUI tunnel input swallowing shortcut-bound keys",
      "Environment-controlled maintenance banner",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-03-10",
    title: "Docs Overhaul & SDK/MCP 1.0",
    items: [
      "14 new documentation pages with MDX pipeline",
      "SDK v1.0.0 and MCP v1.0.0 (stable API)",
      "Standard Webhooks provider and sendTo method",
      "Dynamic blog system with API publishing",
      "PostHog analytics integration",
      "Receiver file logging with daily rotation",
      "Adjusted tier quotas (guest 25/12hrs, free 50/day, pro 100K/month)",
    ],
  },
  {
    version: "0.7.4",
    date: "2026-02-27",
    title: "SEO & Navigation Refresh",
    items: ["Refresh site metadata and navigation layout", "Fix sitemap response content"],
  },
  {
    version: "0.7.3",
    date: "2026-02-22",
    title: "Webhook Templates & Retention",
    items: [
      "Signed webhook templates (Stripe, GitHub, Shopify, Twilio, Slack, Paddle, Linear)",
      "SDK v0.4.0 and MCP v0.2.0 with signature verification",
      "Request retention policy improvements",
      "Homepage comparison section",
    ],
  },
  {
    version: "0.7.2",
    date: "2026-02-17",
    title: "SEO & Search",
    items: [
      "Structured data (JSON-LD), FAQ section, breadcrumbs",
      "Add llms.txt for AI discovery",
      "Full-text search across request body, headers, and path",
      "Paginated request history with retention policies",
      "Strip proxy/CDN headers from stored requests",
    ],
  },
  {
    version: "0.7.1",
    date: "2026-02-14",
    title: "SDK Streaming & MCP Launch",
    items: [
      "SDK v0.3.0: subscribe() SSE streaming, describe() introspection for AI agents",
      "MCP server v0.1.0 (@webhooks-cc/mcp) with 11 tools for AI coding agents",
      "Fix SSE abort ReadableStream errors",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-02-10",
    title: "Rust Receiver & CLI TUI",
    items: [
      "Rewrite webhook receiver from Go to Rust (Axum + sqlx + Tokio)",
      "Optimize database with stored procedures (capture_webhook())",
      "CLI TUI mode with real-time SSE subscriptions",
      "Guest live dashboard for unauthenticated users",
      "Strict quota enforcement for all endpoint types",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-02-06",
    title: "Production Hardening",
    items: [
      "Six phases of production hardening (abuse protection, CSP, rate limiting)",
      "Integration test suite (42 test cases)",
      "Go CLI test coverage improvements",
      "SEO metadata, sitemap improvements, crawler exclusions",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-02-05",
    title: "SDK Launch",
    items: [
      "TypeScript SDK v0.1.0 (@webhooks-cc/sdk) with endpoints, requests, matchers",
      "Security hardening across backend, API routes, and CLI",
      "Floating navbar, sidebar, and docs improvements",
      "Cosign keyless signing for CLI releases",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-02-04",
    title: "CLI Auth & Public Pages",
    items: [
      "CLI device authentication flow (browser-based login)",
      "Installation page with copy-paste commands",
      "Privacy policy and terms of service pages",
      "XML sitemap generation",
      "whk update self-update command with SHA256 verification",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-02-02",
    title: "Billing & Polish",
    items: [
      "Polar.sh subscription management (free/pro tiers)",
      "Request batching and endpoint caching for high-throughput",
      "Dashboard UI improvements (empty states, layout fixes)",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-01-30",
    title: "CI/CD & Code Quality",
    items: [
      "CI pipeline with lint, typecheck, build, and test stages",
      "Dependabot and CodeQL security scanning",
      "ESLint and Prettier configuration",
      "Input validation, CSP, and rate limiting",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-01-28",
    title: "Initial Release",
    items: [
      "Dashboard with webhook capture and real-time inspection",
      "GitHub and Google OAuth authentication",
      "Go webhook receiver with slug-based routing",
      "Go CLI with whk tunnel and whk listen",
      "Basic endpoint CRUD and request viewer",
    ],
  },
];
