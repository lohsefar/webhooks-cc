"use client";

import { useEffect, useState } from "react";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import type { PostHog as PostHogClient } from "posthog-js";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<PostHogClient | null>(null);

  useEffect(() => {
    import("posthog-js").then(({ default: posthog }) => {
      // Already initialised (StrictMode double-fire or HMR)
      if (posthog.__loaded) {
        setClient(posthog);
        return;
      }
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        ui_host: "https://eu.posthog.com",
        persistence: "localStorage",
        capture_pageleave: true,
        autocapture: false,
        defaults: "2026-01-30",
        loaded: (ph) => {
          if (process.env.NODE_ENV === "development") ph.debug();
        },
      });
      setClient(posthog);
    });
  }, []);

  if (!client) {
    return <>{children}</>;
  }

  return <PHProvider client={client}>{children}</PHProvider>;
}
