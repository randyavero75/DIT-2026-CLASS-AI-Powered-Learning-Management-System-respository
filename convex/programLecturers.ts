import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

// ── Admin: Assign a lecturer to a program ─────────────────────────────────────
export const assignLecturer = mutation({
  args: {
    programId: v.id("programCategories"),
    lecturerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!admin || (admin.role !== "admin" && admin.role !== "superadmin")) {
      throw new ConvexError({ message: "Only admins can assign lecturers", code: "FORBIDDEN" });
    }
    if (!admin.orgId) throw new ConvexError({ message: "No org found", code: "BAD_REQUEST" });

    // Ensure the user is a lecturer in THIS org (membership role, or primary org role)
    const lecturer = await ctx.db.get(args.lecturerId);
    const adminOrgId = admin.orgId;
    const lecturerMemberships = await ctx.db
      .query("orgMemberships")
      .withIndex("by_user_and_org", (q) => q.eq("userId", args.lecturerId).eq("orgId", adminOrgId))
      .collect();
    const isOrgLecturer =
      lecturerMemberships.some((m) => m.role === "lecturer") ||
      (lecturer?.orgId?.toString() === adminOrgId.toString() && lecturer.role === "lecturer");
    if (!lecturer || !isOrgLecturer) {
      throw new ConvexError({ message: "User is not a lecturer in this org", code: "BAD_REQUEST" });
    }
    const program = await ctx.db.get(args.programId);
    if (!program || program.orgId.toString() !== adminOrgId.toString()) {
      throw new ConvexError({ message: "Program not found in your institution", code: "NOT_FOUND" });
    }

    const existing = await ctx.db
      .query("programLecturers")
      .withIndex("by_program_and_lecturer", (q) =>
        q.eq("programId", args.programId).eq("lecturerId", args.lecturerId)
      )
      .unique();
    if (existing) throw new ConvexError({ message: "Lecturer already assigned to this program", code: "CONFLICT" });

    await ctx.db.insert("programLecturers", {
      programId: args.programId,
      lecturerId: args.lecturerId,
      orgId: admin.orgId,
      assignedAt: new Date().toISOString(),
    });
    // Assigned lecturers get full access, including the AI quiz tools
    await ctx.db.patch(args.lecturerId, { lecturerApproved: true });

    // Also approve any pending access requests from this lecturer for this program
    const pending = await ctx.db
      .query("programAccessRequests")
      .withIndex("by_program_and_lecturer", (q) =>
        q.eq("programId", args.programId).eq("lecturerId", args.lecturerId)
      )
      .unique();
    if (pending && pending.status === "pending") {
      await ctx.db.patch(pending._id, { status: "approved", reviewedAt: new Date().toISOString() });
    }
  },
});

// ── Admin: Remove a lecturer from a program ───────────────────────────────────
export const removeLecturer = mutation({
  args: {
    programId: v.id("programCategories"),
    lecturerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!admin || (admin.role !== "admin" && admin.role !== "superadmin")) {
      throw new ConvexError({ message: "Only admins can remove lecturers", code: "FORBIDDEN" });
    }
    const assignment = await ctx.db
      .query("programLecturers")
      .withIndex("by_program_and_lecturer", (q) =>
        q.eq("programId", args.programId).eq("lecturerId", args.lecturerId)
      )
      .unique();
    if (!assignment) throw new ConvexError({ message: "Assignment not found", code: "NOT_FOUND" });
    await ctx.db.delete(assignment._id);
  },
});

// ── Query: Get lecturers assigned to a program ────────────────────────────────
export const getLecturersForProgram = query({
  args: { programId: v.id("programCategories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const assignments = await ctx.db
      .query("programLecturers")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    const lecturers = await Promise.all(assignments.map((a) => ctx.db.get(a.lecturerId)));
    return lecturers.filter(Boolean);
  },
});

// ── Query: Get programs assigned to current lecturer ──────────────────────────
export const getMyAssignedPrograms = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || user.role !== "lecturer") return [];
    const assignments = await ctx.db
      .query("programLecturers")
      .withIndex("by_lecturer", (q) => q.eq("lecturerId", user._id))
      .collect();
    const programs = await Promise.all(assignments.map((a) => ctx.db.get(a.programId)));
    return programs.filter((p) => !!p && p.orgId.toString() === user.orgId?.toString());
  },
});

// ── Lecturer: Request access to a program ─────────────────────────────────────
export const requestProgramAccess = mutation({
  args: {
    programId: v.id("programCategories"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || user.role !== "lecturer") {
      throw new ConvexError({ message: "Only lecturers can request program access", code: "FORBIDDEN" });
    }
    if (!user.orgId) throw new ConvexError({ message: "No org found", code: "BAD_REQUEST" });

    // Check if already assigned
    const assigned = await ctx.db
      .query("programLecturers")
      .withIndex("by_program_and_lecturer", (q) =>
        q.eq("programId", args.programId).eq("lecturerId", user._id)
      )
      .unique();
    if (assigned) throw new ConvexError({ message: "You already have access to this program", code: "CONFLICT" });

    // Check if already a pending request
    const existing = await ctx.db
      .query("programAccessRequests")
      .withIndex("by_program_and_lecturer", (q) =>
        q.eq("programId", args.programId).eq("lecturerId", user._id)
      )
      .unique();
    if (existing) {
      if (existing.status === "pending") {
        throw new ConvexError({ message: "You already have a pending request for this program", code: "CONFLICT" });
      }
      // Re-open a previously rejected request
      await ctx.db.patch(existing._id, {
        status: "pending",
        message: args.message,
        requestedAt: new Date().toISOString(),
        reviewedAt: undefined,
      });
      return;
    }

    await ctx.db.insert("programAccessRequests", {
      programId: args.programId,
      lecturerId: user._id,
      orgId: user.orgId,
      message: args.message,
      status: "pending",
      requestedAt: new Date().toISOString(),
    });
  },
});

// ── Admin: Get pending program access requests ────────────────────────────────
export const getPendingAccessRequests = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!admin || (admin.role !== "admin" && admin.role !== "superadmin")) return [];
    if (!admin.orgId) return [];
    const requests = await ctx.db
      .query("programAccessRequests")
      .withIndex("by_org", (q) => q.eq("orgId", admin.orgId!))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
    return await Promise.all(
      requests.map(async (r) => {
        const lecturer = await ctx.db.get(r.lecturerId);
        const program = await ctx.db.get(r.programId);
        return { ...r, lecturer, program };
      })
    );
  },
});

// ── Admin: Review a program access request ────────────────────────────────────
export const reviewAccessRequest = mutation({
  args: {
    requestId: v.id("programAccessRequests"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!admin || (admin.role !== "admin" && admin.role !== "superadmin")) {
      throw new ConvexError({ message: "Only admins can review requests", code: "FORBIDDEN" });
    }
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError({ message: "Request not found", code: "NOT_FOUND" });

    await ctx.db.patch(args.requestId, {
      status: args.decision,
      reviewedAt: new Date().toISOString(),
    });

    if (args.decision === "approved") {
      // Create program assignment
      const existing = await ctx.db
        .query("programLecturers")
        .withIndex("by_program_and_lecturer", (q) =>
          q.eq("programId", request.programId).eq("lecturerId", request.lecturerId)
        )
        .unique();
      await ctx.db.patch(request.lecturerId, { lecturerApproved: true });
      if (!existing) {
        await ctx.db.insert("programLecturers", {
          programId: request.programId,
          lecturerId: request.lecturerId,
          orgId: request.orgId,
          assignedAt: new Date().toISOString(),
        });
      }
    }
  },
});

// ── Query: Get my access requests (for lecturer) ──────────────────────────────
export const getMyAccessRequests = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || user.role !== "lecturer") return [];
    const requests = await ctx.db
      .query("programAccessRequests")
      .withIndex("by_lecturer", (q) => q.eq("lecturerId", user._id))
      .collect();
    return await Promise.all(
      requests.map(async (r) => {
        const program = await ctx.db.get(r.programId);
        return { ...r, program };
      })
    );
  },
});

// ── Check if lecturer is assigned to a program ───────────────────────────────
export const isAssignedToProgram = query({
  args: { programId: v.id("programCategories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) return false;
    const assignment = await ctx.db
      .query("programLecturers")
      .withIndex("by_program_and_lecturer", (q) =>
        q.eq("programId", args.programId).eq("lecturerId", user._id)
      )
      .unique();
    return !!assignment;
  },
});

// ── Get all lecturers in org (for admin assign panel) ────────────────────────
export const getOrgLecturers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!admin || (admin.role !== "admin" && admin.role !== "superadmin")) return [];
    if (!admin.orgId) return [];
    const memberships = await ctx.db
      .query("orgMemberships")
      .withIndex("by_org", (q) => q.eq("orgId", admin.orgId!))
      .collect();
    const lecturerIds = new Set(memberships.filter((m) => m.role === "lecturer").map((m) => m.userId.toString()));
    // Also include primary-org lecturers that have no membership row yet
    const primary = await ctx.db.query("users").withIndex("by_org", (q) => q.eq("orgId", admin.orgId)).take(2000);
    for (const u of primary) {
      if (u.role === "lecturer") lecturerIds.add(u._id.toString());
    }
    const lecturers = await Promise.all([...lecturerIds].map((id) => ctx.db.get(id as Id<"users">)));
    return lecturers.filter(Boolean);
  },
});
