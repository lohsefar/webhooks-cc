# Sentry to AppSignal Migration Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Sentry with AppSignal across all services (web app, Rust receiver, Go CLI) for EU data residency compliance.

**Architecture:** The web app uses `@appsignal/nodejs` directly. The Rust receiver exports OpenTelemetry traces to a local AppSignal collector via `opentelemetry-otlp`. The Go CLI simply removes Sentry (CLI crash reports are not critical and can be added later via AppSignal's OTel if needed). The AppSignal collector runs as a systemd user service.

**Tech Stack:** `@appsignal/nodejs` (Next.js), `opentelemetry` + `opentelemetry-otlp` + `tracing-opentelemetry` (Rust), AppSignal collector (systemd service)

**Design doc:** `docs/plans/2026-03-16-sentry-to-appsignal-design.md`

---

## File Structure

### Web App (`apps/web/`)
- **Delete:** `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- **Modify:** `next.config.ts`, `instrumentation.ts`, `app/error.tsx`, `app/global-error.tsx`, `lib/env.ts`, `package.json`
- **Modify:** `app/api/auth/device-authorize/route.ts`, `app/api/auth/device-claim/route.ts`, `app/api/auth/device-code/route.ts`, `app/api/auth/device-poll/route.ts`, `app/api/search/requests/route.ts`, `app/api/search/requests/count/route.ts`, `app/api/stream/[slug]/route.ts`

### Receiver (`apps/receiver-rs/`)
- **Modify:** `Cargo.toml`, `src/config.rs`, `src/main.rs`

### CLI (`apps/cli/`)
- **Modify:** `cmd/whk/main.go`, `go.mod`, `.goreleaser.yaml`

### Infra / Config
- **Modify:** `Makefile`, `mprocs.yaml`, `docker-compose.yml`, `CLAUDE.md`, `AGENTS.md`
- **Create:** `infra/webhooks-collector.service` (template for the systemd unit)

---

## Chunk 1: Web App — Remove Sentry, Add AppSignal

### Task 1: Remove `@sentry/nextjs` and add AppSignal env vars

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/lib/env.ts`

- [ ] **Step 1: Remove `@sentry/nextjs` from web app dependencies**

```bash
cd apps/web && pnpm remove @sentry/nextjs
```

- [ ] **Step 2: Update `lib/env.ts` — remove Sentry vars, add AppSignal**

In `apps/web/lib/env.ts`:

Remove from `publicEnvSchema`:
```typescript
NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
```

Remove from `serverEnvSchema`:
```typescript
SENTRY_DSN: z.string().optional(),
```

Add to `serverEnvSchema`:
```typescript
APPSIGNAL_PUSH_API_KEY: z.string().optional(),
APPSIGNAL_APP_NAME: z.string().default("webhooks-cc-web"),
```

Remove from `publicEnv()` parse object:
```typescript
NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
```

Remove from `serverEnv()` parse object:
```typescript
SENTRY_DSN: process.env.SENTRY_DSN,
```

Add to `serverEnv()` parse object:
```typescript
APPSIGNAL_PUSH_API_KEY: process.env.APPSIGNAL_PUSH_API_KEY,
APPSIGNAL_APP_NAME: process.env.APPSIGNAL_APP_NAME,
```

- [ ] **Step 3: Verify typecheck passes**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
```

Expected: Errors about missing Sentry imports in other files (that's expected — we fix those next).

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/lib/env.ts pnpm-lock.yaml
git commit -m "refactor(web): remove @sentry/nextjs, update env vars for AppSignal"
```

### Task 2: Delete Sentry config files

**Files:**
- Delete: `apps/web/sentry.client.config.ts`
- Delete: `apps/web/sentry.server.config.ts`
- Delete: `apps/web/sentry.edge.config.ts`

- [ ] **Step 1: Delete the three Sentry config files**

```bash
rm apps/web/sentry.client.config.ts apps/web/sentry.server.config.ts apps/web/sentry.edge.config.ts
```

- [ ] **Step 2: Commit**

```bash
git add -u apps/web/sentry.client.config.ts apps/web/sentry.server.config.ts apps/web/sentry.edge.config.ts
git commit -m "chore(web): delete Sentry config files"
```

### Task 3: Replace `next.config.ts` — remove Sentry wrapper

**Files:**
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Rewrite next.config.ts**

Replace the entire contents of `apps/web/next.config.ts` with:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "refactor(web): remove withSentryConfig from next.config.ts"
```

### Task 4: Replace `instrumentation.ts` — AppSignal init

**Files:**
- Modify: `apps/web/instrumentation.ts`

- [ ] **Step 1: Rewrite instrumentation.ts**

Replace the entire contents of `apps/web/instrumentation.ts` with:

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { Appsignal } = await import("@appsignal/nodejs");

    new Appsignal({
      active: process.env.NODE_ENV === "production" && !!process.env.APPSIGNAL_PUSH_API_KEY,
      name: process.env.APPSIGNAL_APP_NAME || "webhooks-cc-web",
      pushApiKey: process.env.APPSIGNAL_PUSH_API_KEY || "",
    });
  }
}
```

Note: `onRequestError` export is removed — AppSignal auto-instruments Next.js request errors.

- [ ] **Step 2: Commit**

```bash
git add apps/web/instrumentation.ts
git commit -m "feat(web): initialize AppSignal in instrumentation.ts"
```

### Task 5: Update error boundary components

**Files:**
- Modify: `apps/web/app/error.tsx`
- Modify: `apps/web/app/global-error.tsx`

- [ ] **Step 1: Rewrite `app/error.tsx`**

Replace the entire contents with:

```tsx
"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h2>Something went wrong</h2>
      <button onClick={() => reset()} style={{ marginTop: "1rem" }}>
        Try again
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `app/global-error.tsx`**

Replace the entire contents with:

```tsx
"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h2>Something went wrong</h2>
          <button onClick={() => reset()} style={{ marginTop: "1rem" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
```

Note: AppSignal auto-captures unhandled errors on the server side. These are client components so they just log to console. No manual `sendError` needed.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/error.tsx apps/web/app/global-error.tsx
git commit -m "refactor(web): remove Sentry from error boundaries"
```

### Task 6: Replace `Sentry.captureException` in API routes

**Files:**
- Modify: `apps/web/app/api/auth/device-authorize/route.ts`
- Modify: `apps/web/app/api/auth/device-claim/route.ts`
- Modify: `apps/web/app/api/auth/device-code/route.ts`
- Modify: `apps/web/app/api/auth/device-poll/route.ts`
- Modify: `apps/web/app/api/search/requests/route.ts`
- Modify: `apps/web/app/api/search/requests/count/route.ts`
- Modify: `apps/web/app/api/stream/[slug]/route.ts`

- [ ] **Step 1: Update all 7 API route files**

In each file, make two changes:

1. Remove the `import * as Sentry from "@sentry/nextjs";` line
2. Replace each `Sentry.captureException(error)` or `Sentry.captureException(err)` with `console.error(error)` or `console.error(err)` respectively

**Why `console.error` instead of an explicit AppSignal call:** AppSignal's Node.js integration auto-captures errors within the request lifecycle. For catch blocks in API routes, `console.error` ensures the error is logged and AppSignal picks it up via its unhandled error instrumentation. This is simpler and doesn't require importing AppSignal in every route file.

Files and their specific changes:

**`app/api/auth/device-authorize/route.ts`:**
- Remove line 5: `import * as Sentry from "@sentry/nextjs";`
- Line 42: `Sentry.captureException(error)` → `console.error(error)`

**`app/api/auth/device-claim/route.ts`:**
- Remove line 4: `import * as Sentry from "@sentry/nextjs";`
- Line 39: `Sentry.captureException(error)` → `console.error(error)`

**`app/api/auth/device-code/route.ts`:**
- Remove line 3: `import * as Sentry from "@sentry/nextjs";`
- Line 24: `Sentry.captureException(err)` → `console.error(err)`

**`app/api/auth/device-poll/route.ts`:**
- Remove line 3: `import * as Sentry from "@sentry/nextjs";`
- Line 21: `Sentry.captureException(err)` → `console.error(err)`

**`app/api/search/requests/route.ts`:**
- Remove line 4: `import * as Sentry from "@sentry/nextjs";`
- Line 77: `Sentry.captureException(err)` → (already has `console.error` on line 78, just remove the Sentry line)

**`app/api/search/requests/count/route.ts`:**
- Remove line 4: `import * as Sentry from "@sentry/nextjs";`
- Line 64: `Sentry.captureException(err)` → (already has `console.error` on line 65, just remove the Sentry line)

**`app/api/stream/[slug]/route.ts`:**
- Remove line 6: `import * as Sentry from "@sentry/nextjs";`
- Line 220: `Sentry.captureException(error)` → `console.error("Realtime callback error:", error)`
- Line 281: `Sentry.captureException(error)` → (already has `console.error` on line 282, just remove the Sentry line)

- [ ] **Step 2: Run typecheck to verify no remaining Sentry imports**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: Clean — no errors.

- [ ] **Step 3: Verify no Sentry references remain in web app source**

```bash
grep -r "sentry\|Sentry" apps/web/app/ apps/web/lib/ apps/web/instrumentation.ts apps/web/next.config.ts --include="*.ts" --include="*.tsx"
```

Expected: No output.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/ apps/web/app/api/stream/
git commit -m "refactor(web): replace Sentry.captureException with console.error in API routes"
```

### Task 7: Build and verify web app

- [ ] **Step 1: Build the web app**

```bash
pnpm build
```

Expected: Clean build with no Sentry-related errors or warnings.

- [ ] **Step 2: Commit any lockfile changes**

```bash
git add pnpm-lock.yaml
git commit -m "chore: update lockfile after Sentry removal"
```

---

## Chunk 2: Rust Receiver — Replace Sentry with OpenTelemetry

### Task 8: Update Cargo.toml — swap Sentry for OTel crates

**Files:**
- Modify: `apps/receiver-rs/Cargo.toml`

- [ ] **Step 1: Replace sentry dependency with OTel crates**

In `apps/receiver-rs/Cargo.toml`, remove:
```toml
sentry = { version = "0.35", default-features = false, features = ["backtrace", "contexts", "panic", "tracing", "reqwest", "rustls"] }
```

Add:
```toml
opentelemetry = "0.28"
opentelemetry_sdk = { version = "0.28", features = ["rt-tokio"] }
opentelemetry-otlp = { version = "0.28", features = ["http-proto", "reqwest-rustls"] }
tracing-opentelemetry = "0.29"
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/receiver-rs && cargo check
```

Expected: Compile errors in `main.rs` and `config.rs` referencing `sentry`. That's expected — we fix those next.

- [ ] **Step 3: Commit**

```bash
git add apps/receiver-rs/Cargo.toml apps/receiver-rs/Cargo.lock
git commit -m "refactor(receiver): swap sentry crate for opentelemetry stack"
```

### Task 9: Update `config.rs` — replace sentry_dsn with collector URL

**Files:**
- Modify: `apps/receiver-rs/src/config.rs`

- [ ] **Step 1: Rewrite config.rs**

Replace the entire contents of `apps/receiver-rs/src/config.rs` with:

```rust
use std::env;

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub capture_shared_secret: String,
    pub port: u16,
    pub debug: bool,
    pub log_dir: String,
    pub pool_min: u32,
    pub pool_max: u32,
    pub otel_collector_url: Option<String>,
}

impl std::fmt::Debug for Config {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Config")
            .field("database_url", &"[REDACTED]")
            .field("capture_shared_secret", &"[REDACTED]")
            .field("port", &self.port)
            .field("debug", &self.debug)
            .field("log_dir", &self.log_dir)
            .field("pool_min", &self.pool_min)
            .field("pool_max", &self.pool_max)
            .field("otel_collector_url", &self.otel_collector_url)
            .finish()
    }
}

fn parse_env_or<T: std::str::FromStr>(name: &str, default: T) -> T {
    match env::var(name) {
        Ok(v) => match v.parse() {
            Ok(parsed) => parsed,
            Err(_) => {
                tracing::warn!("invalid {} value '{}', using default", name, v);
                default
            }
        },
        Err(_) => default,
    }
}

impl Config {
    pub fn from_env() -> Self {
        let database_url = env::var("DATABASE_URL").expect("DATABASE_URL is required");
        let capture_shared_secret =
            env::var("CAPTURE_SHARED_SECRET").expect("CAPTURE_SHARED_SECRET is required");

        let port: u16 = parse_env_or("PORT", 3001);
        let debug = env::var("RECEIVER_DEBUG").is_ok_and(|v| !v.is_empty());
        let log_dir = env::var("RECEIVER_LOG_DIR").unwrap_or_else(|_| "logs".into());
        let pool_min: u32 = parse_env_or("PG_POOL_MIN", 5);
        let pool_max: u32 = parse_env_or("PG_POOL_MAX", 20);
        let otel_collector_url = env::var("APPSIGNAL_COLLECTOR_URL")
            .ok()
            .filter(|v| !v.is_empty());

        Self {
            database_url,
            capture_shared_secret,
            port,
            debug,
            log_dir,
            pool_min,
            pool_max,
            otel_collector_url,
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/receiver-rs/src/config.rs
git commit -m "refactor(receiver): replace sentry_dsn with otel_collector_url in config"
```

### Task 10: Rewrite `main.rs` — OTel pipeline + TraceLayer fix

**Files:**
- Modify: `apps/receiver-rs/src/main.rs`

- [ ] **Step 1: Rewrite main.rs**

Replace the entire contents of `apps/receiver-rs/src/main.rs` with:

```rust
mod config;
mod handlers;

use axum::Router;
use axum::routing::{any, get};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tokio::net::TcpListener;
use tokio::signal;
use tower_http::cors::{Any, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::trace::TraceLayer;

use config::Config;

const MAX_BODY_SIZE: usize = 1_024 * 1_024; // 1MB

/// Shared application state passed to all handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Config,
}

/// Initialize the OpenTelemetry tracing pipeline.
/// Returns `Some(provider)` when a collector URL is configured, `None` otherwise.
fn init_otel(
    collector_url: &str,
) -> Option<opentelemetry_sdk::trace::SdkTracerProvider> {
    use opentelemetry_sdk::trace::SdkTracerProvider;
    use opentelemetry_otlp::SpanExporter;

    let exporter = SpanExporter::builder()
        .with_http()
        .with_endpoint(format!("{collector_url}/v1/traces"))
        .build()
        .expect("failed to create OTLP span exporter");

    let provider = SdkTracerProvider::builder()
        .with_batch_exporter(exporter)
        .with_resource(
            opentelemetry_sdk::Resource::builder()
                .with_service_name("webhooks-receiver")
                .build(),
        )
        .build();

    opentelemetry::global::set_tracer_provider(provider.clone());

    Some(provider)
}

#[tokio::main]
async fn main() {
    // Load config
    let config = Config::from_env();

    // Initialize OTel pipeline (no-op when collector URL is unset)
    let _otel_provider = config
        .otel_collector_url
        .as_deref()
        .and_then(|url| init_otel(url));

    // Initialize tracing — stdout + rotating log file + optional OTel
    let log_level = if config.debug { "debug" } else { "info" };
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        format!("webhooks_receiver={log_level},tower_http={log_level}").into()
    });

    let log_dir = std::path::Path::new(&config.log_dir);
    std::fs::create_dir_all(log_dir).expect("failed to create log directory");
    let file_appender = tracing_appender::rolling::daily(log_dir, "receiver.log");

    use tracing_subscriber::layer::SubscriberExt;
    use tracing_subscriber::util::SubscriberInitExt;

    let registry = tracing_subscriber::registry()
        .with(env_filter)
        .with(tracing_subscriber::fmt::layer().with_target(false))
        .with(
            tracing_subscriber::fmt::layer()
                .json()
                .with_target(false)
                .with_writer(file_appender),
        );

    // Add OTel layer only when provider is active
    if _otel_provider.is_some() {
        let otel_layer = tracing_opentelemetry::layer()
            .with_tracer(opentelemetry::global::tracer("webhooks-receiver"));
        registry.with(otel_layer).init();
    } else {
        registry.with(Option::<tracing_opentelemetry::OpenTelemetryLayer<_, opentelemetry_sdk::trace::Tracer>>::None).init();
    }

    // Connect to Postgres
    let pool = PgPoolOptions::new()
        .min_connections(config.pool_min)
        .max_connections(config.pool_max)
        .connect(&config.database_url)
        .await
        .expect("failed to connect to Postgres");

    tracing::info!(
        pool_min = config.pool_min,
        pool_max = config.pool_max,
        "connected to Postgres"
    );

    // Build app state
    let state = AppState {
        pool,
        config: config.clone(),
    };

    // CORS: allow all origins on public webhook capture endpoints
    let public_cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Public routes: webhook capture + health
    let app = Router::new()
        .route("/health", get(handlers::health::health))
        .route(
            "/w/{slug}/{*path}",
            any(handlers::webhook::handle_webhook),
        )
        .route(
            "/w/{slug}",
            any(handlers::webhook::handle_webhook_no_path),
        )
        .layer(public_cors)
        .layer(RequestBodyLimitLayer::new(MAX_BODY_SIZE))
        .layer(
            TraceLayer::new_for_http()
                .on_response(
                    tower_http::trace::DefaultOnResponse::new()
                        .level(tracing::Level::DEBUG),
                ),
        )
        .with_state(state);

    // Start server
    let addr = format!("0.0.0.0:{}", config.port);
    let listener = TcpListener::bind(&addr)
        .await
        .expect("failed to bind address");

    tracing::info!(port = config.port, "webhook receiver starting");

    // Serve with graceful shutdown
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("server error");

    // Flush any remaining OTel spans on shutdown
    if let Some(provider) = _otel_provider {
        if let Err(e) = provider.shutdown() {
            eprintln!("OTel shutdown error: {e:?}");
        }
    }
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c().await.expect("failed to listen for ctrl+c");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to listen for SIGTERM")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {}
        _ = terminate => {}
    }

    tracing::info!("shutdown signal received");
}
```

Key changes:
- Sentry init/guard/layer removed entirely
- `init_otel()` creates OTLP HTTP exporter → batch span processor → tracer provider
- OTel layer added conditionally (only when `APPSIGNAL_COLLECTOR_URL` is set)
- `DefaultOnResponse` level changed from `INFO` to `DEBUG` (fixes 2GB/day log noise)
- `tower_http` filter level now uses `log_level` variable so it respects `RECEIVER_DEBUG`
- Graceful shutdown flushes OTel spans via `provider.shutdown()`

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/receiver-rs && cargo check
```

Expected: Clean compilation.

- [ ] **Step 3: Run existing tests**

```bash
cd apps/receiver-rs && cargo test
```

Expected: All tests pass (handler tests don't touch tracing).

- [ ] **Step 4: Run clippy**

```bash
cd apps/receiver-rs && cargo clippy -- -D warnings
```

Expected: Clean.

- [ ] **Step 5: Commit**

```bash
git add apps/receiver-rs/src/main.rs
git commit -m "feat(receiver): replace Sentry with OpenTelemetry tracing pipeline

- OTLP HTTP exporter to AppSignal collector (when APPSIGNAL_COLLECTOR_URL set)
- Downgrade TraceLayer response log level to DEBUG (fixes 2GB/day log noise)
- Graceful OTel shutdown on SIGTERM/SIGINT"
```

### Task 11: Build receiver release binary

- [ ] **Step 1: Build release binary**

```bash
cd apps/receiver-rs && cargo build --release
```

Expected: Successful release build.

- [ ] **Step 2: Verify binary size is reasonable**

```bash
ls -lh apps/receiver-rs/target/release/webhooks-receiver
```

Expected: Binary should be a few MB (similar or smaller than before since Sentry was larger than the OTel crates).

---

## Chunk 3: Go CLI — Remove Sentry

### Task 12: Remove Sentry from CLI

**Files:**
- Modify: `apps/cli/cmd/whk/main.go`
- Modify: `apps/cli/.goreleaser.yaml`

- [ ] **Step 1: Update `cmd/whk/main.go`**

Remove the Sentry import:
```go
"github.com/getsentry/sentry-go"
```

Remove the `sentryDSN` variable and all Sentry initialization code (lines 45-65):
```go
var sentryDSN string
```
and the entire `if dsn := ...` / `if sentryDSN != ""` block.

Remove the `sentry.CaptureException(err)` and `sentry.Flush(2 * time.Second)` calls in the error handler (lines 143-144).

The `envOrDefault` helper function is no longer used after removing Sentry — but check if anything else uses it. If not, remove it too.

The `time` import may become unused after removing Sentry — check and remove if so.

- [ ] **Step 2: Update `.goreleaser.yaml`**

Remove the Sentry ldflags line. Change:
```yaml
    ldflags:
      - -s -w
      - -X main.version={{.Version}}
      - -X main.sentryDSN={{ if index .Env "WHK_SENTRY_DSN" }}{{ .Env.WHK_SENTRY_DSN }}{{ end }}
```

To:
```yaml
    ldflags:
      - -s -w
      - -X main.version={{.Version}}
```

- [ ] **Step 3: Remove sentry-go dependency**

```bash
cd apps/cli && go mod tidy
```

- [ ] **Step 4: Verify CLI compiles**

```bash
cd apps/cli && go build ./cmd/whk
```

Expected: Clean build.

- [ ] **Step 5: Run CLI tests**

```bash
cd apps/cli && go test ./...
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add apps/cli/cmd/whk/main.go apps/cli/.goreleaser.yaml apps/cli/go.mod apps/cli/go.sum
git commit -m "refactor(cli): remove Sentry error reporting"
```

---

## Chunk 4: Infrastructure & Docs

### Task 13: Update Makefile and mprocs.yaml

**Files:**
- Modify: `Makefile`
- Modify: `mprocs.yaml`

- [ ] **Step 1: Update Makefile**

Add the collector to `prod`, `prod-status`, `prod-stop`, `prod-restart`:

In the `prod` target, change:
```makefile
	@systemctl --user start webhooks-web webhooks-receiver
```
to:
```makefile
	@systemctl --user start webhooks-web webhooks-receiver webhooks-collector
```

In `prod-status`, change:
```makefile
	@systemctl --user status webhooks-web webhooks-receiver
```
to:
```makefile
	@systemctl --user status webhooks-web webhooks-receiver webhooks-collector
```

In `prod-stop`, change:
```makefile
	@systemctl --user stop webhooks-web webhooks-receiver
```
to:
```makefile
	@systemctl --user stop webhooks-web webhooks-receiver webhooks-collector
```

In `prod-restart`, change:
```makefile
	@systemctl --user restart webhooks-web webhooks-receiver
```
to:
```makefile
	@systemctl --user restart webhooks-web webhooks-receiver webhooks-collector
```

- [ ] **Step 2: Update mprocs.yaml — add collector log pane**

Add a collector entry:
```yaml
procs:
  web:
    cmd: ["journalctl", "--user", "-u", "webhooks-web", "-f", "--no-hostname", "-o", "cat"]
  receiver:
    cmd: ["journalctl", "--user", "-u", "webhooks-receiver", "-f", "--no-hostname", "-o", "cat"]
  collector:
    cmd: ["journalctl", "--user", "-u", "webhooks-collector", "-f", "--no-hostname", "-o", "cat"]
```

- [ ] **Step 3: Commit**

```bash
git add Makefile mprocs.yaml
git commit -m "infra: add AppSignal collector to Makefile targets and mprocs"
```

### Task 14: Create collector systemd service template

**Files:**
- Create: `infra/webhooks-collector.service`

- [ ] **Step 1: Create infra directory if needed and write service file**

```bash
mkdir -p infra
```

Write `infra/webhooks-collector.service`:

```ini
[Unit]
Description=AppSignal Collector (webhooks.cc)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/appsignal-collector start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

- [ ] **Step 2: Commit**

```bash
git add infra/webhooks-collector.service
git commit -m "infra: add AppSignal collector systemd service template"
```

### Task 15: Update docker-compose.yml

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Update docker-compose.yml**

In the `web` service `environment` section, remove:
```yaml
      - SENTRY_DSN=${SENTRY_DSN}
      - NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
```

Add:
```yaml
      - APPSIGNAL_PUSH_API_KEY=${APPSIGNAL_PUSH_API_KEY}
      - APPSIGNAL_APP_NAME=${APPSIGNAL_APP_NAME}
```

In the `receiver` service `environment` section, add:
```yaml
      - APPSIGNAL_COLLECTOR_URL=${APPSIGNAL_COLLECTOR_URL}
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "infra: update docker-compose env vars for AppSignal"
```

### Task 16: Update CI workflow

**Files:**
- Modify: `.github/workflows/cli-release.yml`

- [ ] **Step 1: Remove Sentry DSN from CLI release workflow**

In `.github/workflows/cli-release.yml`, remove the `WHK_SENTRY_DSN` env var from the GoReleaser step:
```yaml
          WHK_SENTRY_DSN: ${{ secrets.WHK_SENTRY_DSN }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/cli-release.yml
git commit -m "ci: remove WHK_SENTRY_DSN from CLI release workflow"
```

### Task 17: Remove `@sentry/cli` from root package.json build allowlist

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Remove `@sentry/cli` from `onlyBuiltDependencies`**

In root `package.json`, change:
```json
    "onlyBuiltDependencies": [
      "esbuild",
      "sharp",
      "@sentry/cli",
      "@appsignal/nodejs"
    ],
```

to:
```json
    "onlyBuiltDependencies": [
      "esbuild",
      "sharp",
      "@appsignal/nodejs"
    ],
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: remove @sentry/cli from build allowlist"
```

### Task 18: Update CLAUDE.md and AGENTS.md

**Files:**
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update CLAUDE.md**

Make these changes:

1. In the Service Layout table, change web app description from:
   `Next.js 16, React 19, Tailwind v4` to same (no Sentry mention in this table).
   Add a new row for the collector:
   | Collector | 8099 | AppSignal Collector (Rust binary) | Receives OTel traces from receiver, reports host metrics |

2. In the Directory Structure comment, change `web/` line from:
   `# Next.js 16 App Router (Tailwind v4, shadcn/ui, Sentry)` to:
   `# Next.js 16 App Router (Tailwind v4, shadcn/ui, AppSignal)`

3. In the Receiver env vars table:
   - Remove the `SENTRY_DSN` row (if present — check CLAUDE.md, it may not be in the receiver table)
   - Add: `APPSIGNAL_COLLECTOR_URL | no | | OTLP endpoint for AppSignal collector`

4. In the Environment Variables section:
   - Remove `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` from the Optional table
   - Add `APPSIGNAL_PUSH_API_KEY` and `APPSIGNAL_APP_NAME` to the Root `.env.local` table
   - Add `APPSIGNAL_COLLECTOR_URL` to the Receiver env vars or Root env vars

5. In the Receiver Internals section, change any mention of Sentry to reference OpenTelemetry/AppSignal.

6. In AGENTS.md, update the web app description to mention AppSignal instead of Sentry.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md AGENTS.md
git commit -m "docs: update CLAUDE.md and AGENTS.md for Sentry→AppSignal migration"
```

### Task 19: Final verification — full build

- [ ] **Step 1: Verify no Sentry references remain in source**

```bash
grep -r "sentry\|Sentry\|SENTRY" --include="*.ts" --include="*.tsx" --include="*.rs" --include="*.go" --include="*.yaml" --include="*.yml" --include="*.toml" apps/ packages/ | grep -v node_modules | grep -v target | grep -v ".lock"
```

Expected: No output (or only lockfile/build artifact references).

- [ ] **Step 2: Full build**

```bash
make build
```

Expected: All components build successfully.

- [ ] **Step 3: Run all tests**

```bash
make test
```

Expected: All pass.
