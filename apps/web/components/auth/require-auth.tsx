"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ConvexAuthProvider } from "@/components/providers/convex-auth-provider";
import { api } from "@convex/_generated/api";
import { identifyUser } from "@/lib/analytics";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthProvider>
      <RequireAuthInner>{children}</RequireAuthInner>
    </ConvexAuthProvider>
  );
}

function RequireAuthInner({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const user = useQuery(api.users.current, isAuthenticated ? undefined : "skip");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (user) {
      identifyUser(user._id, { email: user.email, plan: user.plan });
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
