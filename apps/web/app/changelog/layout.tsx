import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Changelog — webhooks.cc",
  description:
    "See what's new in webhooks.cc. Full version history of features, improvements, and fixes across the web app, CLI, SDK, and MCP server.",
};

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
