"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Request {
  _id: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
  queryParams: Record<string, string>;
  contentType?: string;
  size: number;
  receivedAt: number;
}

interface RequestListProps {
  requests: Request[];
}

export function RequestList({ requests }: RequestListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="border rounded divide-y">
      {requests.map((request) => (
        <RequestRow
          key={request._id}
          request={request}
          isExpanded={expandedId === request._id}
          onToggle={() =>
            setExpandedId(expandedId === request._id ? null : request._id)
          }
        />
      ))}
    </div>
  );
}

function RequestRow({
  request,
  isExpanded,
  onToggle,
}: {
  request: Request;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const methodColors: Record<string, string> = {
    GET: "bg-green-100 text-green-800",
    POST: "bg-blue-100 text-blue-800",
    PUT: "bg-yellow-100 text-yellow-800",
    DELETE: "bg-red-100 text-red-800",
    PATCH: "bg-purple-100 text-purple-800",
  };

  const time = new Date(request.receivedAt).toLocaleTimeString();

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-4 hover:bg-muted/50 text-left"
      >
        <span
          className={cn(
            "px-2 py-1 rounded text-xs font-mono font-semibold",
            methodColors[request.method] || "bg-gray-100 text-gray-800"
          )}
        >
          {request.method}
        </span>
        <span className="font-mono text-sm flex-1 truncate">{request.path}</span>
        <span className="text-sm text-muted-foreground">
          {formatBytes(request.size)}
        </span>
        <span className="text-sm text-muted-foreground">{time}</span>
      </button>

      {isExpanded && (
        <div className="p-4 bg-muted/30 border-t">
          <RequestDetail request={request} />
        </div>
      )}
    </div>
  );
}

function RequestDetail({ request }: { request: Request }) {
  const [tab, setTab] = useState<"headers" | "body" | "query">("body");

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {["body", "headers", "query"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as typeof tab)}
            className={cn(
              "px-3 py-1 rounded text-sm",
              tab === t ? "bg-primary text-primary-foreground" : "bg-muted"
            )}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "body" && (
        <pre className="bg-background p-4 rounded overflow-x-auto text-sm font-mono">
          {request.body ? formatBody(request.body, request.contentType) : "(empty)"}
        </pre>
      )}

      {tab === "headers" && (
        <div className="bg-background p-4 rounded overflow-x-auto">
          <table className="text-sm font-mono w-full">
            <tbody>
              {Object.entries(request.headers).map(([key, value]) => (
                <tr key={key}>
                  <td className="pr-4 text-muted-foreground">{key}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "query" && (
        <div className="bg-background p-4 rounded overflow-x-auto">
          {Object.keys(request.queryParams).length > 0 ? (
            <table className="text-sm font-mono w-full">
              <tbody>
                {Object.entries(request.queryParams).map(([key, value]) => (
                  <tr key={key}>
                    <td className="pr-4 text-muted-foreground">{key}</td>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <span className="text-muted-foreground">(no query params)</span>
          )}
        </div>
      )}
    </div>
  );
}

function formatBody(body: string, contentType?: string): string {
  if (!body) return "(empty)";

  // Try to parse and format JSON
  if (contentType?.includes("application/json") || body.startsWith("{") || body.startsWith("[")) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      // Not valid JSON, return as-is
    }
  }

  return body;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}b`;
  return `${(bytes / 1024).toFixed(1)}kb`;
}
