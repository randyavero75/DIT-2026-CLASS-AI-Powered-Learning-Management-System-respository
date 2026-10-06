import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";

// ── Student: request to join a program ───────────────────────────────────────

export const requestProgramEnrollment = mutation({
  args: {
    programId: v.id("programCategories"),
    fullName: v.string(),
    phone: v.string(),
    indexNumber: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("other"), v.literal("prefer_not_to_say"))),
    yearOfStudy: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const student = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!student) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    if (!student.orgId) throw new ConvexError({ message: "You must belong to an institution first", code: "BAD_REQUEST" });

    const program = await ctx.db.get(args.programId);
    if (!program || program.orgId.toString() !== student.orgId.toString()) {
      throw new ConvexError({ message: "Program not found", code: "NOT_FOUND" });
    }

    // Check for existing request
    const existing = await ctx.db
      .query("programEnrollmentRequests")
      .withIndex("by_student_and_program", (q) => q.eq("studentId", student._id).eq("programId", args.programId))
      .first();

    if (existing?.status === "pending") {
      throw new ConvexError({ message: "You already have a pending request for this program", code: "CONFLICT" });
    }
    if (existing?.status === "approved") {
      throw new ConvexError({ message: "You are already enrolled in this program", code: "CONFLICT" });
    }
    // Remove previous rejected entry so student can re-apply
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    await ctx.db.insert("programEnrollmentRequests", {
      studentId: student._id,
      programId: args.programId,
      orgId: student.orgId,
      fullName: args.fullName,
      phone: args.phone,
      indexNumber: args.indexNumber,
      dateOfBirth: args.dateOfBirth,
      gender: args.gender,
      yearOfStudy: args.yearOfStudy,
      message: args.message,
      status: "pending",
      requestedAt: new Date().toISOString(),
    });
  },
});

// ── Student: get my request status for each program ──────────────────────────

export const getMyProgramRequests = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const student = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!student) return [];
    return await ctx.db
      .query("programEnrollmentRequests")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .collect();
  },
});

// ── Admin: list all pending program enrollment requests for their org ─────────

export const getPendingProgramEnrollmentRequests = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!admin?.orgId || (admin.role !== "admin" && admin.role !== "superadmin")) return [];

    const requests = await ctx.db
      .query("programEnrollmentRequests")
      .withIndex("by_org", (q) => q.eq("orgId", admin.orgId!))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    return await Promise.all(
      requests.map(async (r) => {
        const student = await ctx.db.get(r.studentId);
        const program = await ctx.db.get(r.programId);
        return { ...r, student, program };
      })
    );
  },
});

// ── Admin: approve or reject a program enrollment request ────────────────────
// On approval the student joins the program and can then request its courses

export const reviewProgramEnrollmentRequest = mutation({
  args: {
    requestId: v.id("programEnrollmentRequests"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, args): Promise<{ enrolledCourseCount: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!admin || (admin.role !== "admin" && admin.role !== "superadmin")) {
      throw new ConvexError({ message: "Not authorized", code: "FORBIDDEN" });
    }

    const req = await ctx.db.get(args.requestId);
    if (!req) throw new ConvexError({ message: "Request not found", code: "NOT_FOUND" });

    await ctx.db.patch(req._id, {
      status: args.decision,
      reviewedAt: new Date().toISOString(),
    });

    if (args.decision !== "approved") return { enrolledCourseCount: 0 };

    // Set the student's enrolledProgramId so they land directly in the program
    await ctx.db.patch(req.studentId, { enrolledProgramId: req.programId });

    // Courses are NOT auto-enrolled: the student requests each course and the admin approves it
    return { enrolledCourseCount: 0 };
  },
});

// ── Get approved programs for a student (programs they are enrolled in) ───────

export const getMyApprovedPrograms = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const student = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!student) return [];
    const approved = await ctx.db
      .query("programEnrollmentRequests")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();
    const programs = await Promise.all(approved.map((r) => ctx.db.get(r.programId)));
    return programs.filter(Boolean);
  },
});
