import { v, ConvexError } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";

export const getUserByToken = internalQuery({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .first();
  },
});

export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: identity.name,
        email: identity.email,
        avatar: identity.profileUrl,
      });
      return existing._id;
    }

    const allUsers = await ctx.db.query("users").take(1);
    const isFirstUser = allUsers.length === 0;

    const userId = await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name,
      email: identity.email,
      avatar: identity.profileUrl,
      // First user ever on the platform becomes superadmin
      role: isFirstUser ? "superadmin" : "student",
      lecturerApproved: false,
    });
    return userId;
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
  },
});

export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const me = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!me) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    // Superadmin sees all users
    if (me.role === "superadmin") {
      return await ctx.db.query("users").collect();
    }

    // Org admin sees only their org's users
    if (me.role === "admin" && me.orgId) {
      return await ctx.db
        .query("users")
        .withIndex("by_org", (q) => q.eq("orgId", me.orgId))
        .collect();
    }

    return [];
  },
});

export const updateUserRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("admin"), v.literal("lecturer"), v.literal("student"), v.literal("superadmin")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!admin || (admin.role !== "admin" && admin.role !== "superadmin")) {
      throw new ConvexError({ message: "Only admins can change roles", code: "FORBIDDEN" });
    }
    await ctx.db.patch(args.userId, {
      role: args.role,
      lecturerApproved: args.role === "lecturer" ? true : false,
    });
  },
});

export const approveLecturer = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!admin || admin.role !== "admin") {
      throw new ConvexError({ message: "Only admins can approve lecturers", code: "FORBIDDEN" });
    }
    await ctx.db.patch(args.userId, { role: "lecturer", lecturerApproved: true });
  },
});

export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

// Org admin: delete a user account from the platform (admin use only)
export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!admin || (admin.role !== "admin" && admin.role !== "superadmin")) {
      throw new ConvexError({ message: "Only admins can delete users", code: "FORBIDDEN" });
    }

    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    // Org admins can only delete users in their org
    if (admin.role === "admin" && target.orgId?.toString() !== admin.orgId?.toString()) {
      throw new ConvexError({ message: "Cannot delete users outside your org", code: "FORBIDDEN" });
    }

    // Remove all org memberships for this user
    const memberships = await ctx.db
      .query("orgMemberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const m of memberships) {
      await ctx.db.delete(m._id);
    }

    // Remove all orgInviteRequests
    const inviteReqs = await ctx.db
      .query("orgInviteRequests")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const r of inviteReqs) {
      await ctx.db.delete(r._id);
    }

    // Delete the user record entirely
    await ctx.db.delete(args.userId);
  },
});

// Allow a student to set their own enrolled program
export const setEnrolledProgram = mutation({
  args: { programCategoryId: v.optional(v.id("programCategories")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    await ctx.db.patch(user._id, { enrolledProgramId: args.programCategoryId });
  },
});
