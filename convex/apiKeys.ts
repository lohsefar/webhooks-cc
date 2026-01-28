import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, { name }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Generate a random key
    const rawKey = `whk_${generateRandomString(32)}`;
    const keyHash = await hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 12);

    await ctx.db.insert("apiKeys", {
      userId: identity.subject as any,
      keyHash,
      keyPrefix,
      name,
      createdAt: Date.now(),
    });

    // Return the raw key only once - it won't be retrievable later
    return { key: rawKey, prefix: keyPrefix };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject as any))
      .order("desc")
      .collect();

    // Don't return the hash
    return keys.map((k) => ({
      id: k._id,
      prefix: k.keyPrefix,
      name: k.name,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    }));
  },
});

export const revoke = mutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const key = await ctx.db.get(id);
    if (!key) throw new Error("API key not found");
    if (key.userId !== identity.subject) {
      throw new Error("Not authorized");
    }

    await ctx.db.delete(id);
    return { success: true };
  },
});

export const validate = query({
  args: { keyHash: v.string() },
  handler: async (ctx, { keyHash }) => {
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_key_hash", (q) => q.eq("keyHash", keyHash))
      .first();

    if (!key) return null;

    return { userId: key.userId };
  },
});

// Helper functions
function generateRandomString(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
