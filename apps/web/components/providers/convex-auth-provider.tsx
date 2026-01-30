"use client";

import { ConvexAuthProvider as ConvexAuth } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
}
const convex = new ConvexReactClient(convexUrl);

export function ConvexAuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  return <ConvexAuth client={convex}>{children}</ConvexAuth>;
}
