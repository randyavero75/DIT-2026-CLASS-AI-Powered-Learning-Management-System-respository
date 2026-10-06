import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { nextStudentId } from "./lib/studentId.ts";

// Public: list all organizations (for search) — only active ones (no auth required)
export const listPublicOrganizations = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();
    // Filter out deactivated orgs and KNUST placeholder
    return orgs
      .filter((o) => o.isActive !== false && o.name.toLowerCase() !== "knust")
      .map((o) => ({
        _id: o._id,
        name: o.name,
        slug: o.slug,
        type: o.type,
        description: o.description,
        website: o.website,
      }));
  },
});

// Request to join an org (works even if user is already in another org — multi-institution support)
export const requestInviteCode = mutation({
  args: {
    orgId: v.id("organizations"),
    fullName: v.optional(v.string()),
    phone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    let user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    // Auto-create user record if it doesn't exist yet (first action before auth callback ran)
    if (!user) {
      const newId = await ctx.db.insert("users", {
        tokenIdentifier: identity.tokenIdentifier,
        name: identity.name,
        email: identity.email,
        avatar: identity.profileUrl,
      });
      user = await ctx.db.get(newId);
      if (!user) throw new ConvexError({ message: "Failed to create user", code: "NOT_FOUND" });
    }

    // Check user is not already a member of this specific org
    if (user.orgId?.toString() === args.orgId.toString()) {
      throw new ConvexError({ message: "You are already a member of this organization", code: "CONFLICT" });
    }
    const existingMembership = await ctx.db
      .query("orgMemberships")
      .withIndex("by_user_and_org", (q) => q.eq("userId", user._id).eq("orgId", args.orgId))
      .first();
    if (existingMembership) {
      throw new ConvexError({ message: "You are already a member of this organization", code: "CONFLICT" });
    }

    // Check no existing pending request for this specific org
    const existing = await ctx.db
      .query("orgInviteRequests")
      .withIndex("by_user_and_org", (q) => q.eq("userId", user._id).eq("orgId", args.orgId))
      .first();
    if (existing && existing.status === "pending") {
      throw new ConvexError({ message: "You already have a pending request for this organization", code: "CONFLICT" });
    }
    // Re-submit if previously rejected — clear history and start fresh
    if (existing) {
      // Delete previous request(s) for clean slate
      const allPrevious = await ctx.db
        .query("orgInviteRequests")
        .withIndex("by_user_and_org", (q) => q.eq("userId", user._id).eq("orgId", args.orgId))
        .collect();
      for (const r of allPrevious) {
        await ctx.db.delete(r._id);
      }
    }

    // Also clear any stale enrollments, quiz attempts, and course requests that may
    // linger from a prior membership in this org — start completely fresh
    const orgCourses = await ctx.db
      .query("courses")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const orgCourseIds = new Set(orgCourses.map((c) => c._id.toString()));

    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .collect();
    for (const e of enrollments) {
      if (orgCourseIds.has(e.courseId.toString())) {
        await ctx.db.delete(e._id);
      }
    }

    const courseReqs = await ctx.db
      .query("courseRequests")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .collect();
    for (const r of courseReqs) {
      if (orgCourseIds.has(r.courseId.toString())) {
        await ctx.db.delete(r._id);
      }
    }

    await ctx.db.insert("orgInviteRequests", {
      userId: user._id,
      orgId: args.orgId,
      fullName: args.fullName,
      phone: args.phone,
      email: args.contactEmail,
      message: args.message,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
  },
});

// Get my pending invite request statuses (for onboarding screen)
export const getMyPendingRequests = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];
    const requests = await ctx.db
      .query("orgInviteRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    // Only return pending or rejected (not approved — approved means they have full access)
    const active = requests.filter((r) => r.status === "pending" || r.status === "rejected");
    return await Promise.all(
      active.map(async (r) => {
        const org = await ctx.db.get(r.orgId);
        return { ...r, orgName: org?.name ?? "Unknown Institution" };
      })
    );
  },
});

// Get my request status for an org
export const getMyRequestStatus = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return null;
    return await ctx.db
      .query("orgInviteRequests")
      .withIndex("by_user_and_org", (q) => q.eq("userId", user._id).eq("orgId", args.orgId))
      .first();
  },
});

// Org admin: get pending invite requests
export const getPendingInviteRequests = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!admin || !admin.orgId || (admin.role !== "admin" && admin.role !== "superadmin")) return [];

    const requests = await ctx.db
      .query("orgInviteRequests")
      .withIndex("by_org", (q) => q.eq("orgId", admin.orgId!))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    return await Promise.all(
      requests.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        const org = await ctx.db.get(r.orgId);
        return { ...r, user, org };
      })
    );
  },
});

// Admin: approve or reject invite request
export const reviewInviteRequest = mutation({
  args: {
    requestId: v.id("orgInviteRequests"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    // Role to grant when approving (defaults to "student")
    grantRole: v.optional(v.union(v.literal("student"), v.literal("lecturer"))),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!admin || (admin.role !== "admin" && admin.role !== "superadmin")) {
      throw new ConvexError({ message: "Not authorized", code: "FORBIDDEN" });
    }

    const req = await ctx.db.get(args.requestId);
    if (!req) throw new ConvexError({ message: "Request not found", code: "NOT_FOUND" });

    const org = await ctx.db.get(req.orgId);
    if (!org) throw new ConvexError({ message: "Organization not found", code: "NOT_FOUND" });

    const requestingUser = await ctx.db.get(req.userId);
    if (!requestingUser) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    await ctx.db.patch(req._id, {
      status: args.decision,
      reviewedAt: new Date().toISOString(),
    });

    if (args.decision === "approved") {
      const grantedRole = args.grantRole ?? "student";

      // Unique, never-reused student ID (per-institution counter)
      const indexNumber = grantedRole === "student" ? await nextStudentId(ctx, req.orgId) : undefined;

      // Build patch: always copy contact details from the request
      const userPatch: Record<string, unknown> = {};
      if (req.fullName) userPatch.name = req.fullName;
      if (req.phone) userPatch.phone = req.phone;
      if (req.email && !requestingUser.email) userPatch.email = req.email;

      if (!requestingUser.orgId) {
        // First org — set primary orgId, role, and index number on the user record
        userPatch.orgId = req.orgId;
        userPatch.role = grantedRole;
        if (grantedRole === "lecturer") userPatch.lecturerApproved = true;
        if (indexNumber !== undefined) userPatch.indexNumber = indexNumber;
      }
      // If user already has an orgId (another org), don't overwrite primary orgId/role —
      // the orgMemberships row handles access for this org context

      if (Object.keys(userPatch).length > 0) {
        await ctx.db.patch(req.userId, userPatch);
      }

      // Also record the membership in orgMemberships table
      const existingMembership = await ctx.db
        .query("orgMemberships")
        .withIndex("by_user_and_org", (q) => q.eq("userId", req.userId).eq("orgId", req.orgId))
        .first();
      if (existingMembership) {
        // Re-approval with a different role must not leave the old role behind
        await ctx.db.patch(existingMembership._id, { role: grantedRole, indexNumber: existingMembership.indexNumber ?? indexNumber });
      } else {
        await ctx.db.insert("orgMemberships", {
          userId: req.userId,
          orgId: req.orgId,
          role: grantedRole,
          joinedAt: new Date().toISOString(),
          indexNumber,
        });
      }

      // Find superadmin to notify
      const superadmin = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "superadmin"))
        .first();

      // Only send emails if user and superadmin have emails
      if (requestingUser.email && superadmin?.email) {
        // Build a sender address from institution name — requires a verified domain/email
        // We use a slug-based address; users must verify this sender in Hercules Emails
        const orgSenderEmail = process.env.PLATFORM_SENDER_EMAIL ?? process.env.HERCULES_OIDC_AUTHORITY?.replace(/^https?:\/\//, "noreply@").split("/")[0] ?? "noreply@eduai.app";

        await ctx.scheduler.runAfter(0, internal.emails.sendApprovalEmails, {
          userEmail: requestingUser.email,
          userName: requestingUser.name,
          orgName: org.name,
          orgEmail: orgSenderEmail,
          superadminEmail: superadmin.email,
          superadminName: superadmin.name,
          role: grantedRole,
        });
      }
    }
  },
});

// ── Admin: get org invite code (for display/sharing) ─────────────────────────

export const getOrgInviteCode = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!admin?.orgId || (admin.role !== "admin" && admin.role !== "superadmin")) return null;
    const org = await ctx.db.get(admin.orgId);
    return org ? { inviteCode: org.inviteCode, orgName: org.name } : null;
  },
});
