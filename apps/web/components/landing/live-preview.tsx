import { LivePreviewCTA } from "./live-preview-cta";

export function LivePreview() {
  return (
    <div className="mt-10 space-y-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Live preview
      </p>

      <div className="neo-card neo-card-static p-0! overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="w-full h-auto block"
          src="/video/WebhooksCcLanding.mp4"
        />
      </div>

      <LivePreviewCTA />
    </div>
  );
}
