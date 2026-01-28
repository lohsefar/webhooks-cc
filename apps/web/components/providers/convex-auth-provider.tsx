"use client";

import { ConvexAuthProvider as ConvexAuth } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexAuthProvider({ children }: { children: ReactNode }) {
  return <ConvexAuth client={convex}>{children}</ConvexAuth>;
}
