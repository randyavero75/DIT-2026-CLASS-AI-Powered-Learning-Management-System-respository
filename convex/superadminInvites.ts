import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";

// Superadmin invites another user to become superadmin by email
export const inviteSuperAdmin = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

    const me = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!me || me.role !== "superadmin") {
      throw new ConvexError({ message: "Only superadmins can invite new superadmins", code: "FORBIDDEN" });
    }

    const email = args.email.toLowerCase().trim();

    // Check if user with this email already exists and make them superadmin directly
    const existingUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .first();

    if (existingUser) {
      await ctx.db.patch(existingUser._id, { role: "superadmin" });
      return { type: "promoted" as const, email };
    }

    // Create invite token
    const token = `sa-${crypto.randomUUID().replace(/-/g, "")}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    // Expire old pending invites for this email
    const existingInvites = await ctx.db
      .query("superadminInvites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    for (const invite of existingInvites) {
      if (invite.status === "pending") {
        await ctx.db.patch(invite._id, { status: "expired" });
      }
    }

    await ctx.db.insert("superadminInvites", {
      email,
      invitedBy: me._id,
      status: "pending",
      token,
      createdAt: now.toISOString(),
      expiresAt,
    });

    return { type: "invited" as const, email, token };
  },
});

// When a user signs up, check if there's a pending invite for their email
export const checkAndAcceptInvite = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || !user.email) return null;

    const userEmail = user.email.toLowerCase();
    const invite = await ctx.db
      .query("superadminInvites")
      .withIndex("by_email", (q) => q.eq("email", userEmail))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (!invite) return null;

    // Check if not expired
    if (new Date(invite.expiresAt) < new Date()) {
      await ctx.db.patch(invite._id, { status: "expired" });
      return null;
    }

    await ctx.db.patch(invite._id, { status: "accepted" });
    await ctx.db.patch(user._id, { role: "superadmin" });

    return { accepted: true };
  },
});

export const listPendingInvites = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const me = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!me || me.role !== "superadmin") return [];

    return await ctx.db
      .query("superadminInvites")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});
