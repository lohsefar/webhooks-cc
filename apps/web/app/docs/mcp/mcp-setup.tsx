"use client";

import { CopyButton } from "@/components/ui/copy-button";

const SETUP_COMMANDS = [
  {
    tool: "Claude Code",
    command: "npx @webhooks-cc/mcp setup claude-code --api-key whcc_...",
    note: "Adds to user scope — available in all sessions",
  },
  {
    tool: "Cursor",
    command: "npx @webhooks-cc/mcp setup cursor --api-key whcc_...",
    note: "Writes .cursor/mcp.json in current directory",
  },
  {
    tool: "VS Code",
    command: "npx @webhooks-cc/mcp setup vscode --api-key whcc_...",
    note: "Writes .vscode/mcp.json in current directory",
  },
  {
    tool: "OpenAI Codex",
    command: "npx @webhooks-cc/mcp setup codex --api-key whcc_...",
    note: "Runs codex mcp add",
  },
  {
    tool: "Windsurf",
    command: "npx @webhooks-cc/mcp setup windsurf --api-key whcc_...",
    note: "Writes ~/.codeium/windsurf/mcp_config.json",
  },
  {
    tool: "Claude Desktop",
    command: "npx @webhooks-cc/mcp setup claude-desktop --api-key whcc_...",
    note: "Writes claude_desktop_config.json",
  },
];

const CURSOR_URL =
  "https://cursor.com/en/install-mcp?name=webhooks-cc&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkB3ZWJob29rcy1jYy9tY3AiXSwiZW52Ijp7IldIS19BUElfS0VZIjoiWU9VUl9BUElfS0VZIn19";

const VSCODE_URL =
  "https://insiders.vscode.dev/redirect/mcp/install?name=webhooks-cc&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40webhooks-cc%2Fmcp%22%5D%2C%22env%22%3A%7B%22WHK_API_KEY%22%3A%22%24%7Binput%3Awhk_api_key%7D%22%7D%7D&inputs=%5B%7B%22id%22%3A%22whk_api_key%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22webhooks.cc%20API%20key%20%28get%20yours%20at%20webhooks.cc%2Faccount%29%22%2C%22password%22%3Atrue%7D%5D";

export function McpInstallButtons() {
  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={CURSOR_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 border-2 border-foreground bg-background font-bold text-sm shadow-neo-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
      >
        <CursorIcon />
        Add to Cursor
      </a>
      <a
        href={VSCODE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 border-2 border-foreground bg-background font-bold text-sm shadow-neo-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
      >
        <VSCodeIcon />
        Add to VS Code
      </a>
    </div>
  );
}

export function SetupCommandsTable() {
  return (
    <div className="space-y-2">
      {SETUP_COMMANDS.map((m) => (
        <div key={m.tool} className="neo-code !p-3 !shadow-none relative">
          <CopyButton text={m.command} />
          <div className="pr-8">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {m.tool}
            </span>
            <code className="block text-sm mt-1">{m.command}</code>
            <span className="text-xs text-muted-foreground">{m.note}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CopyableCode({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <pre className="neo-code text-sm relative">
      <CopyButton text={text} />
      <code className="pr-8">{children}</code>
    </pre>
  );
}

function CursorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M14.5 1.5L7 9M14.5 1.5L10 14.5L7 9M14.5 1.5L1.5 6L7 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VSCodeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11.5 1L5 7.5L2.5 5.5L1 6.5L4.5 9.5L1 12.5L2.5 13.5L5 11.5L11.5 15L15 13.5V2.5L11.5 1ZM11.5 3.5V12.5L5 8.5V7.5L11.5 3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
