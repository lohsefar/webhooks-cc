"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { ANNOUNCEMENTS } from "@/lib/announcements";
import { isMaintenanceBannerEnabled } from "@/components/maintenance-banner";

export function AnnouncementBanner() {
  const announcement = ANNOUNCEMENTS[0];
  const announcementId = announcement?.id;
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  // Don't show on dashboard — it has its own DashboardAnnouncement.
  const isDashboard = pathname.startsWith("/dashboard");

  useEffect(() => {
    if (announcementId && !isDashboard && !localStorage.getItem(announcementId)) {
      setVisible(true);
    }
  }, [announcementId, isDashboard]);

  if (!announcement || isDashboard) return null;

  function dismiss() {
    localStorage.setItem(announcement.id, "1");
    setVisible(false);
  }

  const maintenanceActive = isMaintenanceBannerEnabled();

  const content = (
    <div className="bg-primary border-b-2 border-foreground text-primary-foreground px-4 py-2 text-center text-sm font-medium">
      <div className="flex items-center justify-center gap-2">
        <span>
          <span className="font-bold">New:</span> {announcement.text}{" "}
          <Link href={announcement.cta.href} className="underline hover:opacity-80">
            {announcement.cta.label} &rarr;
          </Link>
        </span>
        <button
          onClick={dismiss}
          className="ml-2 p-0.5 hover:opacity-70 transition-opacity flex-shrink-0"
          aria-label="Dismiss announcement"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {visible && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-0 right-0 z-[55] ${maintenanceActive ? "top-[42px]" : "top-0"}`}
        >
          {content}
        </div>
      )}
      {/* Spacer always rendered so navbar offset stays consistent */}
      <div className="invisible" aria-hidden="true" inert>
        {content}
      </div>
    </>
  );
}
