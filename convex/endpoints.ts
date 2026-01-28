import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nanoid } from "nanoid";

export const create = mutation({
  args: {
    name: v.optional(v.string()),
    mockResponse: v.optional(
      v.object({
        status: v.number(),
        body: v.string(),
        headers: v.record(v.string(), v.string()),
      })
    ),
    isEphemeral: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity ? (identity.subject as any) : null;

    const slug = nanoid(8);
    const isEphemeral = args.isEphemeral ?? !userId;

    const endpointId = await ctx.db.insert("endpoints", {
      userId,
      slug,
      name: args.name,
      mockResponse: args.mockResponse,
      isEphemeral,
      expiresAt: isEphemeral ? Date.now() + 10 * 60 * 1000 : undefined, // 10 min
      createdAt: Date.now(),
    });

    return {
      id: endpointId,
      slug,
      url: `https://webhooks.cc/w/${slug}`,
    };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const endpoints = await ctx.db
      .query("endpoints")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject as any))
      .order("desc")
      .collect();

    return endpoints;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("endpoints")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
  },
});

export const get = query({
  args: { id: v.id("endpoints") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: {
    id: v.id("endpoints"),
    name: v.optional(v.string()),
    mockResponse: v.optional(
      v.object({
        status: v.number(),
        body: v.string(),
        headers: v.record(v.string(), v.string()),
      })
    ),
  },
  handler: async (ctx, { id, ...updates }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const endpoint = await ctx.db.get(id);
    if (!endpoint) throw new Error("Endpoint not found");
    if (endpoint.userId !== identity.subject) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(id, updates);
    return { success: true };
  },
});

export const remove = mutation({
  args: { id: v.id("endpoints") },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const endpoint = await ctx.db.get(id);
    if (!endpoint) throw new Error("Endpoint not found");
    if (endpoint.userId !== identity.subject) {
      throw new Error("Not authorized");
    }

    // Delete all requests for this endpoint
    const requests = await ctx.db
      .query("requests")
      .withIndex("by_endpoint_time", (q) => q.eq("endpointId", id))
      .collect();

    for (const request of requests) {
      await ctx.db.delete(request._id);
    }

    await ctx.db.delete(id);
    return { success: true };
  },
});
