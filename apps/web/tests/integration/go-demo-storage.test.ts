import { describe, expect, it } from "vitest";
import { parseStoredDemoEndpoint } from "@/lib/go-demo-storage";

describe("Guest demo storage parsing", () => {
  it("returns null when no stored endpoint exists", () => {
    expect(parseStoredDemoEndpoint(null)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseStoredDemoEndpoint("{not-json")).toBeNull();
  });

  it("returns null for malformed stored values", () => {
    expect(parseStoredDemoEndpoint(JSON.stringify({ slug: 123, expiresAt: "soon" }))).toBeNull();
  });

  it("returns null for expired endpoints", () => {
    expect(parseStoredDemoEndpoint(JSON.stringify({ slug: "abcd1234", expiresAt: 99 }), 100)).toBeNull();
  });

  it("returns the stored endpoint when it is still valid", () => {
    expect(
      parseStoredDemoEndpoint(JSON.stringify({ slug: "abcd1234", expiresAt: 101 }), 100)
    ).toEqual({
      slug: "abcd1234",
      expiresAt: 101,
    });
  });
});
