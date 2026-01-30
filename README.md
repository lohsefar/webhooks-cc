# webhooks.cc

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A webhook inspection and testing service. Capture incoming webhooks, inspect request details, configure mock responses, and forward requests to localhost for development.

## Features

- **Capture webhooks** - Receive and store incoming HTTP requests
- **Real-time updates** - See requests instantly via WebSocket subscriptions
- **Request inspection** - View headers, body, query params, and metadata
- **Mock responses** - Configure custom response status, headers, and body
- **Localhost tunneling** - Forward webhooks to your local development server
- **CLI tool** - Manage endpoints and tunnel from the command line
- **TypeScript SDK** - Programmatic access to your webhook data

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  External       │────▶│  Go Receiver    │────▶│  Convex         │
│  Service        │     │  (port 3001)    │     │  Backend        │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  CLI Tool       │◀───▶│  Next.js Web    │◀────│  Real-time      │
│  (tunneling)    │     │  (port 3000)    │     │  Subscriptions  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

1. External services send webhooks to the Go receiver
2. Receiver captures the request and stores it via Convex
3. Web dashboard displays requests in real-time
4. CLI can tunnel requests to your localhost

## Prerequisites

- **Node.js** 20+
- **pnpm** 8+ (`npm install -g pnpm`)
- **Go** 1.21+
- **Make**
- A [Convex](https://convex.dev) account

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-username/webhooks-cc.git
cd webhooks-cc

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local
# Edit .env.local with your Convex credentials

# Start Convex (in a separate terminal)
pnpm dev:convex

# Start the web app
pnpm dev:web

# Start the receiver (in a separate terminal)
make dev-receiver
```

## Project Structure

```
webhooks-cc/
├── apps/
│   ├── web/          # Next.js dashboard (port 3000)
│   ├── receiver/     # Go webhook receiver (port 3001)
│   ├── cli/          # Go CLI tool
│   └── go-shared/    # Shared Go types
├── packages/
│   └── sdk/          # TypeScript SDK
├── convex/           # Convex backend
└── docs/             # Documentation
```

## Tech Stack

- **Frontend:** Next.js 15, Tailwind CSS, shadcn/ui
- **Backend:** Convex (database, auth, real-time)
- **Receiver:** Go + Fiber
- **CLI:** Go + Cobra
- **SDK:** TypeScript
- **Payments:** Polar.sh (optional)

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `CONVEX_DEPLOYMENT` | Yes | Your Convex deployment identifier |
| `NEXT_PUBLIC_CONVEX_URL` | Yes | Convex cloud URL (`.convex.cloud`) |
| `CONVEX_SITE_URL` | Yes | Convex site URL (`.convex.site`) |
| `NEXT_PUBLIC_WEBHOOK_URL` | Yes | Public URL of your receiver |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of your web app |
| `POLAR_ACCESS_TOKEN` | No | Polar.sh billing integration |
| `SMTP_*` | No | Email configuration |

### Convex Environment Variables

Set these in Convex dashboard or via `npx convex env set`:

| Variable | Default | Description |
|----------|---------|-------------|
| `FREE_REQUEST_LIMIT` | 500 | Requests per billing period (free tier) |
| `PRO_REQUEST_LIMIT` | 500000 | Requests per billing period (pro tier) |
| `EPHEMERAL_TTL_MS` | 600000 | Anonymous endpoint lifetime (10 min) |
| `BILLING_PERIOD_MS` | 2592000000 | Billing cycle length (30 days) |

## Commands

```bash
# Development
pnpm dev:web              # Start Next.js web app
pnpm dev:convex           # Start Convex backend
make dev-receiver         # Start Go receiver
make dev-cli ARGS="..."   # Run CLI with arguments

# Build
pnpm build                # Build TypeScript packages
pnpm typecheck            # Type check all packages
make build                # Build everything including Go
make build-receiver       # Build Go receiver
make build-cli            # Build CLI

# Test
make test                 # Run all tests

# Deploy
npx convex deploy         # Deploy Convex functions
docker compose up -d      # Deploy with Docker
```

## CLI Usage

```bash
# Install (or use make dev-cli)
go install ./apps/cli

# Login
whk login

# List endpoints
whk endpoints list

# Create endpoint
whk endpoints create --name "my-webhook"

# Tunnel to localhost
whk tunnel 8080
```

Set `WHK_API_URL` environment variable to point to your deployment.

## Docker Deployment

```bash
# Configure environment
cp .env.example .env
# Edit .env with production values

# Deploy
docker compose up -d
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT - see [LICENSE](LICENSE) for details.
