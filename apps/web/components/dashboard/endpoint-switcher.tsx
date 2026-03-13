"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/supabase-auth-provider";
import {
  fetchDashboardEndpoints,
  subscribeDashboardEndpointsChanged,
  type DashboardEndpoint,
} from "@/lib/dashboard-api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function EndpointSwitcher() {
  const { session } = useAuth();
  const [endpoints, setEndpoints] = useState<DashboardEndpoint[] | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSlug = searchParams.get("endpoint");

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      setEndpoints(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const nextEndpoints = await fetchDashboardEndpoints(accessToken);
        if (!cancelled) {
          setEndpoints(nextEndpoints);
        }
      } catch (error) {
        console.error("Failed to load endpoints for switcher:", error);
        if (!cancelled) {
          setEndpoints([]);
        }
      }
    };

    void load();
    const unsubscribe = subscribeDashboardEndpointsChanged(() => {
      void load();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [session?.access_token]);

  if (!endpoints || endpoints.length === 0) {
    return null;
  }

  const handleChange = (slug: string) => {
    router.push(`/dashboard?endpoint=${slug}`);
  };

  return (
    <Select value={currentSlug || endpoints[0]?.slug} onValueChange={handleChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select endpoint" />
      </SelectTrigger>
      <SelectContent>
        {endpoints.map((endpoint) => (
          <SelectItem key={endpoint.id} value={endpoint.slug}>
            {endpoint.name || endpoint.slug}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
