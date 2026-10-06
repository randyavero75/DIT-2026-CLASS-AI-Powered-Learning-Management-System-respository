import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

const ITEM_TYPE = v.union(v.literal("pdf"), v.literal("video"), v.literal("link"), v.literal("document"));

// Generate upload URL for library file
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    return await ctx.storage.generateUploadUrl();
  },
});

// Add library item (link or uploaded file)
export const addItem = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    type: ITEM_TYPE,
    url: v.optional(v.string()),
    fileStorageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    const canAdd =
      user.role === "lecturer" || user.role === "admin" || user.role === "superadmin";
    if (!canAdd) throw new ConvexError({ message: "Only lecturers and admins can add library items", code: "FORBIDDEN" });

    return await ctx.db.insert("libraryItems", {
      orgId: user.orgId,
      addedBy: user._id,
      title: args.title,
      description: args.description,
      category: args.category,
      type: args.type,
      url: args.url,
      fileStorageId: args.fileStorageId,
      fileName: args.fileName,
      tags: args.tags,
      createdAt: new Date().toISOString(),
    });
  },
});

// List items (org-scoped + global)
export const listItems = query({
  args: {
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
    type: v.optional(ITEM_TYPE),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { page: [], isDone: true, continueCursor: "" };
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    let baseQuery = ctx.db.query("libraryItems").order("desc");

    // Filter by category if provided
    if (args.category) {
      baseQuery = ctx.db
        .query("libraryItems")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .order("desc");
    }

    const result = await baseQuery.paginate(args.paginationOpts);

    // Filter to org-scoped + global, resolve file URLs
    const filtered = result.page.filter(
      (item) => !item.orgId || item.orgId === user?.orgId
    );

    const page = await Promise.all(
      filtered.map(async (item) => {
        const url = item.fileStorageId
          ? await ctx.storage.getUrl(item.fileStorageId)
          : item.url ?? null;
        const adder = await ctx.db.get(item.addedBy);
        return { ...item, resolvedUrl: url, adderName: adder?.name ?? "Unknown" };
      })
    );

    return { ...result, page };
  },
});

// Get distinct categories
export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("libraryItems").take(500);
    const cats = [...new Set(items.map((i) => i.category))];
    return cats.sort();
  },
});

// Delete item (adder or admin)
export const deleteItem = mutation({
  args: { itemId: v.id("libraryItems") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new ConvexError({ message: "Item not found", code: "NOT_FOUND" });
    const isAdder = item.addedBy === user?._id;
    const isAdmin = user?.role === "admin" || user?.role === "superadmin";
    if (!isAdder && !isAdmin) throw new ConvexError({ message: "Not authorized", code: "FORBIDDEN" });
    if (item.fileStorageId) {
      await ctx.storage.delete(item.fileStorageId);
    }
    await ctx.db.delete(args.itemId);
  },
});
