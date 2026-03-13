"use client";

import { useEffect, useRef } from "react";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import type { PostHog as PostHogClient } from "posthog-js";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const posthogRef = useRef<PostHogClient | null>(null);

  useEffect(() => {
    if (posthogRef.current) return;

    import("posthog-js").then(({ default: posthog }) => {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        ui_host: "https://eu.posthog.com",
        persistence: "localStorage",
        capture_pageleave: true,
        autocapture: {
          dom_event_allowlist: ["click"],
          element_allowlist: ["a", "button"],
        },
        defaults: "2026-01-30",
        loaded: (ph) => {
          if (process.env.NODE_ENV === "development") ph.debug();
        },
      });
      posthogRef.current = posthog;
    });
  }, []);

  if (!posthogRef.current) {
    return <>{children}</>;
  }

  return <PHProvider client={posthogRef.current}>{children}</PHProvider>;
}
