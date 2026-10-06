import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";

// ── Queries ───────────────────────────────────────────────────────────────────

export const listByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("programCategories")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

export const listForCurrentOrg = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user?.orgId) return [];
    return await ctx.db
      .query("programCategories")
      .withIndex("by_org", (q) => q.eq("orgId", user.orgId!))
      .collect();
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError({ message: "Only admins can create program categories", code: "FORBIDDEN" });
    }
    if (!user.orgId) throw new ConvexError({ message: "No organization found", code: "BAD_REQUEST" });
    return await ctx.db.insert("programCategories", {
      orgId: user.orgId,
      name: args.name,
      description: args.description,
      createdAt: new Date().toISOString(),
    });
  },
});

export const update = mutation({
  args: {
    categoryId: v.id("programCategories"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError({ message: "Only admins can update categories", code: "FORBIDDEN" });
    }
    await ctx.db.patch(args.categoryId, { name: args.name, description: args.description });
  },
});

export const remove = mutation({
  args: { categoryId: v.id("programCategories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError({ message: "Only admins can remove categories", code: "FORBIDDEN" });
    }
    await ctx.db.delete(args.categoryId);
  },
});
