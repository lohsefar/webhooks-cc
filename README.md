# webhooks.cc

Inspect and debug webhooks without deploying to production.

Get a unique URL, point your webhook there, and see every request in real-time. No signup required.

**[Try it now →](https://webhooks.cc)**

## Getting Started

1. Visit [webhooks.cc](https://webhooks.cc)
2. Copy your unique webhook URL
3. Send a test request: `curl -X POST https://hooks.webhooks.cc/w/your-slug -d '{"test": true}'`
4. Watch it appear in the dashboard

## Features

- **Capture requests** — Store incoming webhooks with headers, body, query params, and metadata
- **Inspect in real-time** — See requests the moment they arrive via WebSocket
- **Configure responses** — Return custom status codes, headers, and body for testing error paths
- **Forward to localhost** — Tunnel webhooks to your local server during development
- **CLI** — Manage endpoints and tunnel from your terminal with `whk`
- **TypeScript SDK** — Access webhook data programmatically for automation and testing

## Use Cases

**Testing payment integrations** — Point Stripe's test webhooks at your endpoint. Inspect the payload structure before writing handlers.

**Debugging CI/CD hooks** — See exactly what GitHub sends when a push, PR, or deployment occurs.

**Developing locally** — Forward production-like webhooks to localhost without exposing your machine to the internet.

**Mocking failure scenarios** — Configure your endpoint to return 500 errors and test your retry logic.

## Pricing

**Free** — 200 requests/day, 24-hour data retention. Enough for development and testing.

**Pro ($8/month)** — 500,000 requests/month, 30-day retention. For production monitoring and high-volume testing.

See [webhooks.cc/pricing](https://webhooks.cc/pricing) for details.

## CLI

```bash
whk login
whk endpoints list
whk endpoints create --name "stripe-test"
whk tunnel 8080
```

## SDK

```typescript
import { WebhooksClient } from '@webhooks-cc/sdk';

const client = new WebhooksClient({ apiKey: 'your-api-key' });

const endpoint = await client.endpoints.create({ name: 'my-webhook' });
console.log(endpoint.url);

const requests = await client.requests.list(endpoint.id);
```

## Open Source

This project is MIT licensed. The source is available for transparency and community contributions, not as a deployment guide.

If you want to contribute, see [CONTRIBUTING.md](CONTRIBUTING.md).

If you need to self-host for compliance or air-gapped environments, the code is here. But for most use cases, the hosted service at [webhooks.cc](https://webhooks.cc) is the easier path.

## License

[MIT](LICENSE)
