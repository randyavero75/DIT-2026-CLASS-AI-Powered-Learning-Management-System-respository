import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .first();
  if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
  return user;
}

const isStaff = (u: Doc<"users">) => u.role === "admin" || u.role === "lecturer" || u.role === "superadmin";

// Staff may only manage assignments in their own institution
async function requireStaffForCourse(ctx: QueryCtx | MutationCtx, courseId: Id<"courses">) {
  const user = await requireUser(ctx);
  const course = await ctx.db.get(courseId);
  if (!course || !user.orgId || course.orgId !== user.orgId || !isStaff(user)) {
    throw new ConvexError({ message: "Not allowed for this course", code: "FORBIDDEN" });
  }
  return { user, course };
}

async function isEnrolled(ctx: QueryCtx | MutationCtx, studentId: Id<"users">, courseId: Id<"courses">) {
  const e = await ctx.db
    .query("enrollments")
    .withIndex("by_student_and_course", (q) => q.eq("studentId", studentId).eq("courseId", courseId))
    .first();
  return !!e;
}

const extOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.string(),
    instructions: v.optional(v.string()),
    dueAt: v.string(),
    maxScore: v.number(),
    allowedFormats: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, course } = await requireStaffForCourse(ctx, args.courseId);
    if (!args.title.trim()) throw new ConvexError({ message: "Title is required", code: "BAD_REQUEST" });
    if (Number.isNaN(Date.parse(args.dueAt))) {
      throw new ConvexError({ message: "Invalid due date", code: "BAD_REQUEST" });
    }
    if (args.maxScore <= 0) throw new ConvexError({ message: "Max score must be positive", code: "BAD_REQUEST" });
    const formats = args.allowedFormats.map((f) => f.trim().toLowerCase().replace(/^\./, "")).filter(Boolean);
    if (formats.length === 0) {
      throw new ConvexError({ message: "Pick at least one accepted file format", code: "BAD_REQUEST" });
    }
    return await ctx.db.insert("assignments", {
      orgId: course.orgId!,
      courseId: args.courseId,
      createdBy: user._id,
      title: args.title.trim(),
      instructions: args.instructions?.trim() || undefined,
      dueAt: new Date(args.dueAt).toISOString(),
      maxScore: args.maxScore,
      allowedFormats: formats,
      createdAt: new Date().toISOString(),
    });
  },
});

export const remove = mutation({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, args) => {
    const a = await ctx.db.get(args.assignmentId);
    if (!a) return;
    await requireStaffForCourse(ctx, a.courseId);
    const subs = await ctx.db
      .query("assignmentSubmissions")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", args.assignmentId))
      .take(500);
    for (const s of subs) {
      for (const f of s.files) await ctx.storage.delete(f.storageId);
      await ctx.db.delete(s._id);
    }
    await ctx.db.delete(args.assignmentId);
  },
});

// Lecturer view: assignments for their courses with submission counts
export const listForStaff = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user?.orgId || !isStaff(user)) return [];
    const orgId = user.orgId;
    const list = await ctx.db
      .query("assignments")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(100);
    return await Promise.all(
      list.map(async (a) => {
        const course = await ctx.db.get(a.courseId);
        const subs = await ctx.db
          .query("assignmentSubmissions")
          .withIndex("by_assignment", (q) => q.eq("assignmentId", a._id))
          .take(500);
        return {
          ...a,
          courseTitle: course?.title ?? "Course",
          submissionCount: subs.length,
          gradedCount: subs.filter((s) => s.score !== undefined).length,
        };
      }),
    );
  },
});

// Lecturer view: every submission with student details and download links
export const listSubmissions = query({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, args) => {
    const a = await ctx.db.get(args.assignmentId);
    if (!a) return [];
    await requireStaffForCourse(ctx, a.courseId);
    const subs = await ctx.db
      .query("assignmentSubmissions")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", args.assignmentId))
      .take(500);
    return await Promise.all(
      subs.map(async (s) => {
        const student = await ctx.db.get(s.studentId);
        const files = await Promise.all(
          s.files.map(async (f) => ({ ...f, url: await ctx.storage.getUrl(f.storageId) })),
        );
        return {
          ...s,
          files,
          studentName: student?.name ?? "Student",
          indexNumber: student?.indexNumber,
        };
      }),
    );
  },
});

export const grade = mutation({
  args: {
    submissionId: v.id("assignmentSubmissions"),
    score: v.number(),
    feedback: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.submissionId);
    if (!sub) throw new ConvexError({ message: "Submission not found", code: "NOT_FOUND" });
    const a = await ctx.db.get(sub.assignmentId);
    if (!a) throw new ConvexError({ message: "Assignment not found", code: "NOT_FOUND" });
    await requireStaffForCourse(ctx, a.courseId);
    if (args.score < 0 || args.score > a.maxScore) {
      throw new ConvexError({ message: `Score must be between 0 and ${a.maxScore}`, code: "BAD_REQUEST" });
    }
    await ctx.db.patch(args.submissionId, {
      score: args.score,
      feedback: args.feedback?.trim() || undefined,
      gradedAt: new Date().toISOString(),
    });
  },
});

// Student view: assignments for enrolled courses with their own submission + score
export const listForStudent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user?.orgId) return [];
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .take(200);
    const result = [];
    for (const e of enrollments) {
      const course = await ctx.db.get(e.courseId);
      // Only courses from the active institution
      if (!course || course.orgId !== user.orgId) continue;
      const list = await ctx.db
        .query("assignments")
        .withIndex("by_course", (q) => q.eq("courseId", e.courseId))
        .take(100);
      for (const a of list) {
        const sub = await ctx.db
          .query("assignmentSubmissions")
          .withIndex("by_assignment_and_student", (q) => q.eq("assignmentId", a._id).eq("studentId", user._id))
          .first();
        const files = sub
          ? await Promise.all(sub.files.map(async (f) => ({ ...f, url: await ctx.storage.getUrl(f.storageId) })))
          : [];
        result.push({ ...a, courseTitle: course.title, submission: sub ? { ...sub, files } : null });
      }
    }
    return result.sort((x, y) => x.dueAt.localeCompare(y.dueAt));
  },
});

export const submit = mutation({
  args: {
    assignmentId: v.id("assignments"),
    note: v.optional(v.string()),
    files: v.array(v.object({ storageId: v.id("_storage"), fileName: v.string() })),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const a = await ctx.db.get(args.assignmentId);
    if (!a) throw new ConvexError({ message: "Assignment not found", code: "NOT_FOUND" });
    if (user.orgId !== a.orgId || !(await isEnrolled(ctx, user._id, a.courseId))) {
      throw new ConvexError({ message: "You are not enrolled in this course", code: "FORBIDDEN" });
    }
    if (args.files.length === 0 || args.files.length > MAX_FILES) {
      throw new ConvexError({ message: `Upload 1 to ${MAX_FILES} files`, code: "BAD_REQUEST" });
    }
    const existing = await ctx.db
      .query("assignmentSubmissions")
      .withIndex("by_assignment_and_student", (q) => q.eq("assignmentId", a._id).eq("studentId", user._id))
      .first();
    if (existing?.score !== undefined) {
      throw new ConvexError({ message: "Already graded; resubmission is closed", code: "CONFLICT" });
    }

    // Validate against the formats the lecturer accepts, and real stored sizes
    const files: { storageId: Id<"_storage">; fileName: string; size: number }[] = [];
    for (const f of args.files) {
      if (!a.allowedFormats.includes(extOf(f.fileName))) {
        throw new ConvexError({
          message: `${f.fileName}: format not accepted (allowed: ${a.allowedFormats.join(", ")})`,
          code: "BAD_REQUEST",
        });
      }
      const meta = await ctx.db.system.get("_storage", f.storageId);
      if (!meta || meta.size > MAX_FILE_BYTES) {
        throw new ConvexError({ message: `${f.fileName}: file missing or over 20 MB`, code: "BAD_REQUEST" });
      }
      files.push({ storageId: f.storageId, fileName: f.fileName, size: meta.size });
    }

    const now = new Date();
    const isLate = now.getTime() > Date.parse(a.dueAt);
    if (existing) {
      for (const old of existing.files) await ctx.storage.delete(old.storageId);
      await ctx.db.patch(existing._id, {
        files,
        note: args.note?.trim() || undefined,
        submittedAt: now.toISOString(),
        isLate,
      });
      return existing._id;
    }
    return await ctx.db.insert("assignmentSubmissions", {
      assignmentId: a._id,
      studentId: user._id,
      files,
      note: args.note?.trim() || undefined,
      submittedAt: now.toISOString(),
      isLate,
    });
  },
});
