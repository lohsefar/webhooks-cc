export interface StoredDemoEndpoint {
  slug: string;
  expiresAt: number;
}

export function parseStoredDemoEndpoint(
  value: string | null,
  now = Date.now()
): StoredDemoEndpoint | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as { slug?: unknown; expiresAt?: unknown };

    if (typeof parsed.slug !== "string" || typeof parsed.expiresAt !== "number") {
      return null;
    }

    if (parsed.expiresAt <= now) {
      return null;
    }

    return {
      slug: parsed.slug,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}
