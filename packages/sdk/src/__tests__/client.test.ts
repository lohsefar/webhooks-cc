import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebhooksCC } from "../client";
import { WebhooksCCError, UnauthorizedError, NotFoundError } from "../errors";

const API_KEY = "whcc_testkey123";
const BASE_URL = "https://test.webhooks.cc";
const WEBHOOK_URL = "https://go.test.webhooks.cc";

function createClient(opts?: { timeout?: number; webhookUrl?: string }) {
  return new WebhooksCC({
    apiKey: API_KEY,
    baseUrl: BASE_URL,
    webhookUrl: WEBHOOK_URL,
    ...opts,
  });
}

async function hmacSha1Base64(secret: string, payload: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("crypto.subtle is required for this test");
  }
  const key = await subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Buffer.from(new Uint8Array(signature)).toString("base64");
}

function mockFetch(response: {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}) {
  const status = response.status ?? 200;
  const headers = new Headers({
    "content-type": "application/json",
    ...response.headers,
  });

  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers,
    json: () => Promise.resolve(response.body),
    text: () => Promise.resolve(JSON.stringify(response.body)),
  });
}

describe("WebhooksCC", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("endpoints.create", () => {
    it("sends POST /api/endpoints with auth header", async () => {
      const endpoint = {
        id: "ep1",
        slug: "abc123",
        url: "https://r.webhooks.cc/w/abc123",
        createdAt: Date.now(),
      };
      const fetchMock = mockFetch({ body: endpoint });
      globalThis.fetch = fetchMock;

      const client = createClient();
      const result = await client.endpoints.create({ name: "Test" });

      expect(result).toEqual(endpoint);
      expect(fetchMock).toHaveBeenCalledOnce();

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/api/endpoints`);
      expect(opts.method).toBe("POST");
      expect(opts.headers.Authorization).toBe(`Bearer ${API_KEY}`);
      expect(JSON.parse(opts.body)).toEqual({ name: "Test" });
    });

    it("sends POST with empty options when none provided", async () => {
      const endpoint = {
        id: "ep1",
        slug: "abc123",
        url: "https://r.webhooks.cc/w/abc123",
        createdAt: Date.now(),
      };
      const fetchMock = mockFetch({ body: endpoint });
      globalThis.fetch = fetchMock;

      const client = createClient();
      await client.endpoints.create();

      const [, opts] = fetchMock.mock.calls[0];
      expect(JSON.parse(opts.body)).toEqual({});
    });
  });

  describe("endpoints.list", () => {
    it("sends GET /api/endpoints", async () => {
      const endpoints = [
        { id: "ep1", slug: "abc", url: "https://r.webhooks.cc/w/abc", createdAt: Date.now() },
      ];
      const fetchMock = mockFetch({ body: endpoints });
      globalThis.fetch = fetchMock;

      const client = createClient();
      const result = await client.endpoints.list();

      expect(result).toEqual(endpoints);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/api/endpoints`);
      expect(opts.method).toBe("GET");
    });
  });

  describe("endpoints.sendTemplate", () => {
    it("sends a Stripe template webhook with signed stripe-signature header", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        text: () => Promise.resolve("ok"),
      });
      globalThis.fetch = fetchMock;

      const client = createClient();
      await client.endpoints.sendTemplate("abc123", {
        provider: "stripe",
        secret: "whsec_test_123",
        timestamp: 1700000000,
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe(`${WEBHOOK_URL}/w/abc123`);
      expect(opts.method).toBe("POST");
      expect(opts.headers["content-type"] ?? opts.headers["Content-Type"]).toContain(
        "application/json"
      );
      expect(opts.headers["stripe-signature"]).toMatch(/^t=1700000000,v1=[a-f0-9]+$/);
      expect(opts.headers["x-webhooks-cc-template-template"]).toBe("payment_intent.succeeded");
      expect(opts.body).toContain('"type":"payment_intent.succeeded"');
    });

    it("sends a GitHub pull_request template webhook with signature and event headers", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        text: () => Promise.resolve("ok"),
      });
      globalThis.fetch = fetchMock;

      const client = createClient();
      await client.endpoints.sendTemplate("abc123", {
        provider: "github",
        template: "pull_request.opened",
        secret: "github_secret",
      });

      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.headers["x-github-event"]).toBe("pull_request");
      expect(opts.headers["x-hub-signature-256"]).toMatch(/^sha256=[a-f0-9]+$/);
      expect(opts.headers["x-github-delivery"]).toBeTruthy();
      expect(opts.body).toContain('"action":"opened"');
      expect(opts.body).toContain('"pull_request"');
    });

    it("sends a Shopify template with topic and HMAC headers", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        text: () => Promise.resolve("ok"),
      });
      globalThis.fetch = fetchMock;

      const client = createClient();
      await client.endpoints.sendTemplate("abc123", {
        provider: "shopify",
        template: "products/update",
        secret: "shopify_secret",
      });

      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.headers["x-shopify-topic"]).toBe("products/update");
      expect(opts.headers["x-shopify-hmac-sha256"]).toMatch(/^[A-Za-z0-9+/=]+$/);
      expect(opts.headers["x-shopify-shop-domain"]).toBeTruthy();
      expect(opts.body).toContain('"title":"Webhook Tester Hoodie"');
    });

    it("sends a Twilio template webhook as form-encoded body", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        text: () => Promise.resolve("ok"),
      });
      globalThis.fetch = fetchMock;

      const client = createClient();
      await client.endpoints.sendTemplate("abc123", {
        provider: "twilio",
        template: "messaging.status_callback",
        secret: "twilio_auth_token",
      });

      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.headers["content-type"] ?? opts.headers["Content-Type"]).toContain(
        "application/x-www-form-urlencoded"
      );
      expect(opts.headers["x-twilio-signature"]).toMatch(/^[A-Za-z0-9+/=]+$/);
      expect(opts.body).toContain("MessageSid=");
      expect(opts.body).toContain("MessageStatus=delivered");
    });

    it("signs Twilio string body override using URL + sorted params", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        text: () => Promise.resolve("ok"),
      });
      globalThis.fetch = fetchMock;

      const bodyOverride =
        "MessageStatus=delivered&To=%2B14155559876&From=%2B14155550123&MessageSid=SM123";
      const client = createClient();
      await client.endpoints.sendTemplate("abc123", {
        provider: "twilio",
        secret: "twilio_auth_token",
        body: bodyOverride,
      });

      const [, opts] = fetchMock.mock.calls[0];
      const endpointUrl = `${WEBHOOK_URL}/w/abc123`;
      const sorted = Array.from(new URLSearchParams(bodyOverride).entries()).sort(([a], [b]) =>
        a.localeCompare(b)
      );
      const signaturePayload = `${endpointUrl}${sorted.map(([k, v]) => `${k}${v}`).join("")}`;
      const expectedSignature = await hmacSha1Base64("twilio_auth_token", signaturePayload);

      expect(opts.body).toBe(bodyOverride);
      expect(opts.headers["x-twilio-signature"]).toBe(expectedSignature);
    });

    it("throws on unsupported provider template", async () => {
      const client = createClient();
      await expect(
        client.endpoints.sendTemplate("abc123", {
          provider: "stripe",
          template: "not-a-template",
          secret: "whsec_test_123",
        })
      ).rejects.toThrow(/Unsupported template/i);
    });

    it("throws when secret is missing", async () => {
      const client = createClient();
      await expect(
        client.endpoints.sendTemplate("abc123", {
          provider: "stripe",
          secret: "",
        })
      ).rejects.toThrow(/non-empty secret/i);
    });
  });

  describe("endpoints.get", () => {
    it("sends GET /api/endpoints/{slug}", async () => {
      const endpoint = {
        id: "ep1",
        slug: "abc123",
        url: "https://r.webhooks.cc/w/abc123",
        createdAt: Date.now(),
      };
      const fetchMock = mockFetch({ body: endpoint });
      globalThis.fetch = fetchMock;

      const client = createClient();
      const result = await client.endpoints.get("abc123");

      expect(result).toEqual(endpoint);
      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/api/endpoints/abc123`);
    });

    it("rejects invalid slug characters", async () => {
      const client = createClient();
      await expect(client.endpoints.get("../admin")).rejects.toThrow("Invalid slug");
    });

    it("rejects slugs with slashes", async () => {
      const client = createClient();
      await expect(client.endpoints.get("foo/bar")).rejects.toThrow("Invalid slug");
    });
  });

  describe("endpoints.delete", () => {
    it("sends DELETE /api/endpoints/{slug}", async () => {
      const fetchMock = mockFetch({
        status: 204,
        body: undefined,
        headers: { "content-length": "0" },
      });
      globalThis.fetch = fetchMock;

      const client = createClient();
      await client.endpoints.delete("abc123");

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/api/endpoints/abc123`);
      expect(opts.method).toBe("DELETE");
    });
  });

  describe("requests.list", () => {
    it("sends GET /api/endpoints/{slug}/requests with query params", async () => {
      const requests = [{ id: "r1", method: "POST", receivedAt: Date.now() }];
      const fetchMock = mockFetch({ body: requests });
      globalThis.fetch = fetchMock;

      const client = createClient();
      const result = await client.requests.list("abc123", { limit: 10, since: 1000 });

      expect(result).toEqual(requests);
      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/api/endpoints/abc123/requests?limit=10&since=1000`);
    });

    it("sends GET without query params when none provided", async () => {
      const fetchMock = mockFetch({ body: [] });
      globalThis.fetch = fetchMock;

      const client = createClient();
      await client.requests.list("abc123");

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/api/endpoints/abc123/requests`);
    });
  });

  describe("requests.get", () => {
    it("sends GET /api/requests/{id}", async () => {
      const request = { id: "r1", method: "POST" };
      const fetchMock = mockFetch({ body: request });
      globalThis.fetch = fetchMock;

      const client = createClient();
      const result = await client.requests.get("r1");

      expect(result).toEqual(request);
      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/api/requests/r1`);
    });
  });

  describe("requests.waitFor", () => {
    it("returns first matching request", async () => {
      const req1 = { id: "r1", method: "GET", receivedAt: 1000 };
      const req2 = { id: "r2", method: "POST", receivedAt: 2000 };

      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        const body = callCount === 1 ? [] : [req1, req2];
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(body),
          text: () => Promise.resolve(JSON.stringify(body)),
        });
      });

      const client = createClient();
      const result = await client.requests.waitFor("abc123", {
        timeout: 5000,
        pollInterval: 10,
        match: (r) => r.method === "POST",
      });

      expect(result.id).toBe("r2");
    });

    it("returns first request when no match filter", async () => {
      const req = { id: "r1", method: "POST", receivedAt: Date.now() };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve([req]),
        text: () => Promise.resolve(JSON.stringify([req])),
      });

      const client = createClient();
      const result = await client.requests.waitFor("abc123", {
        timeout: 5000,
        pollInterval: 10,
      });

      expect(result.id).toBe("r1");
    });

    it("throws on timeout", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve([]),
        text: () => Promise.resolve("[]"),
      });

      const client = createClient();
      await expect(
        client.requests.waitFor("abc123", { timeout: 50, pollInterval: 10 })
      ).rejects.toThrow(/timed out/i);
    });

    it("throws on 401 instead of retrying", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ error: "unauthorized" }),
        text: () => Promise.resolve('{"error":"unauthorized"}'),
      });

      const client = createClient();
      await expect(
        client.requests.waitFor("abc123", { timeout: 5000, pollInterval: 10 })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("throws on 404 instead of retrying", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ error: "not_found" }),
        text: () => Promise.resolve('{"error":"not_found"}'),
      });

      const client = createClient();
      await expect(
        client.requests.waitFor("abc123", { timeout: 5000, pollInterval: 10 })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("continues polling on 5xx errors", async () => {
      const req = { id: "r1", method: "POST", receivedAt: Date.now() };
      let callCount = 0;

      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            headers: new Headers({ "content-type": "application/json" }),
            json: () => Promise.resolve({ error: "internal" }),
            text: () => Promise.resolve('{"error":"internal"}'),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve([req]),
          text: () => Promise.resolve(JSON.stringify([req])),
        });
      });

      const client = createClient();
      const result = await client.requests.waitFor("abc123", {
        timeout: 5000,
        pollInterval: 10,
      });

      expect(result.id).toBe("r1");
      expect(callCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe("error handling", () => {
    it("throws WebhooksCCError with status code on non-ok response", async () => {
      const fetchMock = mockFetch({ status: 400, body: { error: "bad request" } });
      globalThis.fetch = fetchMock;

      const client = createClient();
      try {
        await client.endpoints.list();
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(WebhooksCCError);
        expect((error as WebhooksCCError).statusCode).toBe(400);
      }
    });

    it("truncates long error messages", async () => {
      const longError = "x".repeat(500);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ error: longError }),
        text: () => Promise.resolve(longError),
      });

      const client = createClient();
      try {
        await client.endpoints.list();
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as WebhooksCCError).message.length).toBeLessThan(300);
      }
    });
  });

  describe("path validation", () => {
    it("rejects path traversal in slug", async () => {
      const client = createClient();
      await expect(client.endpoints.get("..")).rejects.toThrow();
      await expect(client.endpoints.delete("../admin")).rejects.toThrow();
      await expect(client.requests.list("../admin")).rejects.toThrow();
      await expect(client.requests.get("../admin")).rejects.toThrow();
    });

    it("accepts valid slugs", async () => {
      const fetchMock = mockFetch({ body: {} });
      globalThis.fetch = fetchMock;

      const client = createClient();
      // These should not throw validation errors
      await client.endpoints.get("abc-123");
      await client.endpoints.get("test_slug");
      await client.endpoints.get("ABC123");
    });
  });
});
