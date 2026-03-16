# Replace Sentry with AppSignal

**Date:** 2026-03-16
**Status:** Approved
**Motivation:** EU data residency — no customer data on US servers. Sentry is US-based. AppSignal is Dutch (AppSignal B.V.), all data stored in Netherlands.

## Architecture

### What changes

| Component | Change |
|---|---|
| Web app (Next.js) | Remove `@sentry/nextjs`, wire in `@appsignal/nodejs`. Replace `Sentry.captureException()` calls. Remove Sentry config files and `withSentryConfig` wrapper. |
| Receiver (Rust) | Remove `sentry` crate. Add `opentelemetry`, `opentelemetry_sdk`, `opentelemetry-otlp`, `tracing-opentelemetry`. OTel layer exports to localhost:8099. |
| Collector (new) | AppSignal collector as systemd user service. Receives OTLP from receiver, reports host metrics, forwards to AppSignal NL. |
| Environment | Remove `SENTRY_*` vars. Add `APPSIGNAL_PUSH_API_KEY`, `APPSIGNAL_APP_NAME`, `APPSIGNAL_COLLECTOR_URL`. |

### Data flow

```
Web app errors/traces  -->  AppSignal servers (direct, via @appsignal/nodejs)
Receiver traces/errors -->  localhost:8099 (OTLP) --> AppSignal collector --> AppSignal servers
Host metrics           -->  AppSignal collector --> AppSignal servers
```

## Web App Changes

### Files to delete
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`

### Files to modify
- `next.config.ts` — Remove `withSentryConfig` wrapper, export plain config
- `instrumentation.ts` — Replace Sentry with AppSignal init in `register()`. Remove edge branch (AppSignal has no edge runtime support).
- `app/error.tsx` / `app/global-error.tsx` — Remove `Sentry.captureException`, use console.error (AppSignal auto-captures unhandled errors)
- 7 API routes with `Sentry.captureException()` — Replace with AppSignal `sendError()`
- `lib/env.ts` — Remove `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`, add `APPSIGNAL_PUSH_API_KEY`
- `package.json` — Remove `@sentry/nextjs`

No client-side SDK needed. Sentry had replays disabled; server-side coverage is sufficient.

## Receiver Changes

### Crate changes
Remove: `sentry`
Add: `opentelemetry`, `opentelemetry_sdk`, `opentelemetry-otlp`, `tracing-opentelemetry`

### config.rs
- Remove `sentry_dsn` field
- Add `appsignal_collector_url: Option<String>` from `APPSIGNAL_COLLECTOR_URL` env var

### main.rs
- Remove Sentry init, guard, and tracing layer
- Add OTel pipeline: OTLP HTTP exporter -> batch span processor -> tracing-opentelemetry layer
- When `APPSIGNAL_COLLECTOR_URL` is unset, skip OTel layer (no-op like Sentry today)
- Graceful shutdown: flush spans via `shutdown_tracer_provider()`
- TraceLayer: change `DefaultOnResponse` level from INFO to DEBUG (stops 2GB/day log noise)
- Custom response classifier: always mark webhook route responses as OK so mock 5xx don't become error spans

No changes to handler files — they don't reference Sentry directly.

## Collector Setup

### Installation (one-time on prod)
```bash
apt install appsignal-collector
```

### Config (`/etc/appsignal-collector.conf`)
```toml
push_api_key = "<key>"
enable_host_metrics = true
```

### Systemd service
New user service at `~/.config/systemd/user/webhooks-collector.service`.

## Environment Variables

### Remove
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`

### Add
- `APPSIGNAL_PUSH_API_KEY` — web app
- `APPSIGNAL_APP_NAME` — web app (e.g. `webhooks-cc-web`)
- `APPSIGNAL_COLLECTOR_URL` — receiver (default `http://localhost:8099`)

## Makefile / Infra Updates
- Add `deploy-collector` target
- Update `prod-status` / `prod-restart` / `prod-stop` to include collector
- Update `mprocs.yaml` to tail collector journal
- Update `CLAUDE.md` env var tables, service layout, receiver docs
