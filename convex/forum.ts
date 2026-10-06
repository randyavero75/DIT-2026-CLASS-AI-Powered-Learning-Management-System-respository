import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel.d.ts";

async function currentUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .first();
}
import { paginationOptsValidator } from "convex/server";

// ── Create thread ─────────────────────────────────────────────────────────────

export const createThread = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || !user.orgId) throw new ConvexError({ message: "You must be in an organization to post", code: "FORBIDDEN" });

    return await ctx.db.insert("forumThreads", {
      orgId: user.orgId,
      authorId: user._id,
      title: args.title,
      body: args.body,
      category: args.category,
      upvotes: 0,
      replyCount: 0,
      createdAt: new Date().toISOString(),
    });
  },
});

// ── List threads ─────────────────────────────────────────────────────────────

export const listThreads = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { page: [], isDone: true, continueCursor: "" };
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user?.orgId) return { page: [], isDone: true, continueCursor: "" };

    const result = await ctx.db
      .query("forumThreads")
      .withIndex("by_org", (q) => q.eq("orgId", user.orgId!))
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      result.page.map(async (thread) => {
        const author = await ctx.db.get(thread.authorId);
        return { ...thread, authorName: author?.name ?? "Unknown", authorAvatar: author?.avatar };
      })
    );

    return { ...result, page };
  },
});

// ── Get thread by id ──────────────────────────────────────────────────────────

export const getThread = query({
  args: { threadId: v.id("forumThreads") },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return null;
    const author = await ctx.db.get(thread.authorId);
    const me = await currentUser(ctx);
    const vote = me
      ? await ctx.db
          .query("forumVotes")
          .withIndex("by_user_and_thread", (q) => q.eq("userId", me._id).eq("threadId", args.threadId))
          .first()
      : null;
    return { ...thread, authorName: author?.name ?? "Unknown", authorAvatar: author?.avatar, myVote: !!vote };
  },
});

// ── Upvote thread ──────────────────────────────────────────────────────────────

export const upvoteThread = mutation({
  args: { threadId: v.id("forumThreads") },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new ConvexError({ message: "Thread not found", code: "NOT_FOUND" });
    // Toggle: a second click removes the vote
    const existing = await ctx.db
      .query("forumVotes")
      .withIndex("by_user_and_thread", (q) => q.eq("userId", user._id).eq("threadId", args.threadId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(args.threadId, { upvotes: Math.max(0, thread.upvotes - 1) });
    } else {
      await ctx.db.insert("forumVotes", { userId: user._id, threadId: args.threadId });
      await ctx.db.patch(args.threadId, { upvotes: thread.upvotes + 1 });
    }
  },
});

// ── Delete thread (author or admin) ───────────────────────────────────────────

export const deleteThread = mutation({
  args: { threadId: v.id("forumThreads") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new ConvexError({ message: "Thread not found", code: "NOT_FOUND" });
    const isAuthor = thread.authorId === user?._id;
    const isAdminOrLecturer = user?.role === "admin" || user?.role === "superadmin" || user?.role === "lecturer";
    if (!isAuthor && !isAdminOrLecturer) {
      throw new ConvexError({ message: "Not authorized", code: "FORBIDDEN" });
    }
    await ctx.db.delete(args.threadId);
  },
});

// ── Replies ───────────────────────────────────────────────────────────────────

export const addReply = mutation({
  args: { threadId: v.id("forumThreads"), body: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    await ctx.db.insert("forumReplies", {
      threadId: args.threadId,
      authorId: user._id,
      body: args.body,
      upvotes: 0,
      createdAt: new Date().toISOString(),
    });

    const thread = await ctx.db.get(args.threadId);
    if (thread) {
      await ctx.db.patch(args.threadId, { replyCount: thread.replyCount + 1 });
    }
  },
});

export const getReplies = query({
  args: { threadId: v.id("forumThreads") },
  handler: async (ctx, args) => {
    const replies = await ctx.db
      .query("forumReplies")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();

    const me = await currentUser(ctx);
    return await Promise.all(
      replies.map(async (r) => {
        const author = await ctx.db.get(r.authorId);
        const vote = me
          ? await ctx.db
              .query("forumVotes")
              .withIndex("by_user_and_reply", (q) => q.eq("userId", me._id).eq("replyId", r._id))
              .first()
          : null;
        return { ...r, authorName: author?.name ?? "Unknown", authorAvatar: author?.avatar, myVote: !!vote };
      })
    );
  },
});

export const upvoteReply = mutation({
  args: { replyId: v.id("forumReplies") },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const reply = await ctx.db.get(args.replyId);
    if (!reply) throw new ConvexError({ message: "Reply not found", code: "NOT_FOUND" });
    const existing = await ctx.db
      .query("forumVotes")
      .withIndex("by_user_and_reply", (q) => q.eq("userId", user._id).eq("replyId", args.replyId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(args.replyId, { upvotes: Math.max(0, reply.upvotes - 1) });
    } else {
      await ctx.db.insert("forumVotes", { userId: user._id, replyId: args.replyId });
      await ctx.db.patch(args.replyId, { upvotes: reply.upvotes + 1 });
    }
  },
});

export const deleteReply = mutation({
  args: { replyId: v.id("forumReplies") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    const reply = await ctx.db.get(args.replyId);
    if (!reply) throw new ConvexError({ message: "Reply not found", code: "NOT_FOUND" });
    const isAuthor = reply.authorId === user?._id;
    const isAdminOrLecturer = user?.role === "admin" || user?.role === "superadmin" || user?.role === "lecturer";
    if (!isAuthor && !isAdminOrLecturer) {
      throw new ConvexError({ message: "Not authorized", code: "FORBIDDEN" });
    }
    await ctx.db.delete(args.replyId);
  },
});

// ── Pin/unpin thread (admin/lecturer) ────────────────────────────────────────

export const pinThread = mutation({
  args: { threadId: v.id("forumThreads"), pinned: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || (user.role !== "admin" && user.role !== "superadmin" && user.role !== "lecturer")) {
      throw new ConvexError({ message: "Not authorized", code: "FORBIDDEN" });
    }
    await ctx.db.patch(args.threadId, { isPinned: args.pinned });
  },
});
