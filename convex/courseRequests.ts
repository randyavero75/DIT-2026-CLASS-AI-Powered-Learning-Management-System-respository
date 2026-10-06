import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";

// Student submits a request to join a course
export const requestAccess = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const course = await ctx.db.get(args.courseId);
    if (!course || !course.published || course.orgId?.toString() !== user.orgId?.toString()) {
      throw new ConvexError({ message: "This course is not available", code: "NOT_FOUND" });
    }
    if (!course.programCategoryId) {
      throw new ConvexError({ message: "This course is not part of a program yet", code: "BAD_REQUEST" });
    }

    // Check not already enrolled
    const enrolled = await ctx.db
      .query("enrollments")
      .withIndex("by_student_and_course", (q) => q.eq("studentId", user._id).eq("courseId", args.courseId))
      .unique();
    if (enrolled) throw new ConvexError({ message: "Already enrolled in this course", code: "CONFLICT" });

    // Check no active pending request
    const existing = await ctx.db
      .query("courseRequests")
      .withIndex("by_student_and_course", (q) => q.eq("studentId", user._id).eq("courseId", args.courseId))
      .first();
    if (existing && existing.status === "pending") {
      throw new ConvexError({ message: "Request already pending", code: "CONFLICT" });
    }

    // If previously rejected, allow re-request by updating
    if (existing && existing.status === "rejected") {
      await ctx.db.patch(existing._id, {
        status: "pending",
        requestedAt: new Date().toISOString(),
        reviewedAt: undefined,
        reviewNote: undefined,
      });
      return existing._id;
    }

    return await ctx.db.insert("courseRequests", {
      studentId: user._id,
      courseId: args.courseId,
      status: "pending",
      requestedAt: new Date().toISOString(),
    });
  },
});

// Get the current user's request status for a course
export const getMyRequestStatus = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) return null;
    return await ctx.db
      .query("courseRequests")
      .withIndex("by_student_and_course", (q) => q.eq("studentId", user._id).eq("courseId", args.courseId))
      .first();
  },
});

// Get all pending requests (for admin, org-scoped)
export const getPendingRequests = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) return [];

    const requests = await ctx.db
      .query("courseRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const results = await Promise.all(
      requests.map(async (req) => {
        const student = await ctx.db.get(req.studentId);
        const course = await ctx.db.get(req.courseId);
        return { ...req, student, course };
      })
    );

    // Filter to only show requests for courses in the admin's own org
    return results.filter((r) => {
      if (!r.course) return false;
      if (currentUser.role === "superadmin") return true;
      return r.course.orgId?.toString() === currentUser.orgId?.toString();
    });
  },
});

// Admin approves or rejects a request
export const reviewRequest = mutation({
  args: {
    requestId: v.id("courseRequests"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    // Allow both org admins and superadmin to approve/reject course access
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      throw new ConvexError({ message: "Only admins can review requests", code: "FORBIDDEN" });
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError({ message: "Request not found", code: "NOT_FOUND" });

    const reqCourse = await ctx.db.get(request.courseId);
    if (currentUser.role !== "superadmin" && reqCourse?.orgId?.toString() !== currentUser.orgId?.toString()) {
      throw new ConvexError({ message: "This request belongs to another institution", code: "FORBIDDEN" });
    }

    await ctx.db.patch(args.requestId, {
      status: args.decision,
      reviewedAt: new Date().toISOString(),
      reviewNote: args.reviewNote,
    });

    // If approved, create enrollment
    if (args.decision === "approved") {
      const alreadyEnrolled = await ctx.db
        .query("enrollments")
        .withIndex("by_student_and_course", (q) =>
          q.eq("studentId", request.studentId).eq("courseId", request.courseId)
        )
        .unique();
      if (!alreadyEnrolled) {
        await ctx.db.insert("enrollments", {
          studentId: request.studentId,
          courseId: request.courseId,
          enrolledAt: new Date().toISOString(),
        });
        const course = await ctx.db.get(request.courseId);
        if (course) {
          await ctx.db.patch(request.courseId, { enrollmentCount: course.enrollmentCount + 1 });
        }
      }
    }
  },
});

// Student's own requests list — scoped to current org
export const getMyRequests = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) return [];
    const requests = await ctx.db
      .query("courseRequests")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .collect();
    const results = await Promise.all(
      requests.map(async (req) => {
        const course = await ctx.db.get(req.courseId);
        return { ...req, course };
      })
    );
    // Only show requests for courses in the current org
    if (!user.orgId) return results;
    return results.filter((r) => r.course?.orgId?.toString() === user.orgId!.toString());
  },
});
