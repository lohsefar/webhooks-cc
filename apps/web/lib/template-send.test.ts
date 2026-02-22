import { describe, expect, test } from "vitest";

import { buildTemplateRequest } from "./template-send";

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

describe("template-send", () => {
  test("throws for unsupported template id", async () => {
    await expect(
      buildTemplateRequest({
        provider: "stripe",
        template: "not-a-template",
        secret: "mock_webhook_secret",
        targetUrl: "https://go.webhooks.cc/w/demo",
      })
    ).rejects.toThrow("Unsupported template");
  });

  test("builds signed stripe template payload", async () => {
    const request = await buildTemplateRequest({
      provider: "stripe",
      secret: "mock_webhook_secret",
      targetUrl: "https://go.webhooks.cc/w/demo",
    });

    expect(request.method).toBe("POST");
    expect(request.headers["content-type"]).toBe("application/json");
    expect(request.headers["stripe-signature"]).toMatch(/^t=\d+,v1=[a-f0-9]+$/);
    expect(request.body).toContain('"type":"payment_intent.succeeded"');
  });

  test("signs Twilio string body override using URL + sorted params", async () => {
    const targetUrl = "https://go.webhooks.cc/w/demo";
    const bodyOverride =
      "MessageStatus=delivered&To=%2B14155559876&From=%2B14155550123&MessageSid=SM123";

    const request = await buildTemplateRequest({
      provider: "twilio",
      secret: "twilio_auth_token",
      targetUrl,
      bodyOverride,
    });

    const sorted = Array.from(new URLSearchParams(bodyOverride).entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const signaturePayload = `${targetUrl}${sorted.map(([k, v]) => `${k}${v}`).join("")}`;
    const expectedSignature = await hmacSha1Base64("twilio_auth_token", signaturePayload);

    expect(request.body).toBe(bodyOverride);
    expect(request.headers["x-twilio-signature"]).toBe(expectedSignature);
  });
});
