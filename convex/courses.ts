import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";
import { nextStudentId } from "./lib/studentId.ts";

export const createCourse = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.string(),
    coverImage: v.optional(v.string()),
    programCategoryId: v.id("programCategories"),
    semester: v.optional(v.union(v.literal("first"), v.literal("second"), v.literal("full_term"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError({ message: "Only admins can create courses", code: "FORBIDDEN" });
    }
    // Every course lives inside a program of the admin's institution
    const program = await ctx.db.get(args.programCategoryId);
    if (!program || program.orgId.toString() !== user.orgId?.toString()) {
      throw new ConvexError({ message: "Choose a program from your institution", code: "BAD_REQUEST" });
    }
    return await ctx.db.insert("courses", {
      ...args,
      lecturerId: user._id,
      orgId: user.orgId,
      published: false,
      enrollmentCount: 0,
    });
  },
});

// Get enrolled courses with published quiz counts for students — scoped to current org
export const getEnrolledCoursesWithQuizzes = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) return [];
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .collect();
    const result = await Promise.all(
      enrollments.map(async (e) => {
        const course = await ctx.db.get(e.courseId);
        if (!course) return null;
        // Only return courses belonging to the student's current institution
        if (user.orgId && course.orgId?.toString() !== user.orgId.toString()) return null;
        const quizzes = await ctx.db
          .query("quizzes")
          .withIndex("by_course", (q) => q.eq("courseId", e.courseId))
          .filter((q) => q.eq(q.field("published"), true))
          .collect();
        return { ...course, publishedQuizCount: quizzes.length };
      })
    );
    return result.filter(Boolean);
  },
});

// Returns only published courses for the student's current org
export const getPublishedCourses = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    // Unauthenticated or user with no org — return nothing
    if (!user?.orgId) return [];
    return await ctx.db
      .query("courses")
      .withIndex("by_org", (q) => q.eq("orgId", user.orgId))
      .filter((q) => q.eq(q.field("published"), true))
      .collect();
  },
});

export const getAllCoursesForLecturer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) return [];
    // Admin sees only their org's courses
    if (user.role === "admin" || user.role === "superadmin") {
      if (!user.orgId) return [];
      return await ctx.db
        .query("courses")
        .withIndex("by_org", (q) => q.eq("orgId", user.orgId))
        .collect();
    }
    // Lecturer sees their own courses PLUS all courses in programs they are assigned to
    const ownCourses = await ctx.db
      .query("courses")
      .withIndex("by_lecturer", (q) => q.eq("lecturerId", user._id))
      .collect();
    // Get programs assigned to this lecturer
    const programAssignments = await ctx.db
      .query("programLecturers")
      .withIndex("by_lecturer", (q) => q.eq("lecturerId", user._id))
      .collect();
    const assignedProgramIds = new Set(
      programAssignments.filter((a) => a.orgId.toString() === user.orgId?.toString()).map((a) => a.programId.toString())
    );
    if (assignedProgramIds.size === 0) return ownCourses;
    // Get all courses in those programs (within lecturer's org)
    if (!user.orgId) return ownCourses;
    const orgCourses = await ctx.db
      .query("courses")
      .withIndex("by_org", (q) => q.eq("orgId", user.orgId))
      .collect();
    const programCourses = orgCourses.filter(
      (c) => c.programCategoryId && assignedProgramIds.has(c.programCategoryId.toString())
    );
    // Merge without duplicates
    const seen = new Set(ownCourses.map((c) => c._id.toString()));
    for (const c of programCourses) {
      if (!seen.has(c._id.toString())) ownCourses.push(c);
    }
    return ownCourses;
  },
});

export const getCourseById = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.courseId);
  },
});

export const publishCourse = mutation({
  args: { courseId: v.id("courses"), published: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    await ctx.db.patch(args.courseId, { published: args.published });
  },
});

export const deleteCourse = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.courseId);
  },
});

// Returns only enrollments for courses in the student's current org
export const getMyEnrollments = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) return [];
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .collect();
    const courses = await Promise.all(enrollments.map(e => ctx.db.get(e.courseId)));
    // Only show courses belonging to the user's current org
    return courses.filter((c) => {
      if (!c) return false;
      if (!user.orgId) return false;
      return c.orgId?.toString() === user.orgId.toString();
    });
  },
});

export const getCourseEnrollments = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "lecturer")) return [];
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    const students = await Promise.all(
      enrollments.map(async (e) => {
        const student = await ctx.db.get(e.studentId);
        return student ? { ...student, enrollmentId: e._id, enrolledAt: e.enrolledAt } : null;
      })
    );
    return students.filter(Boolean);
  },
});

export const adminEnrollStudent = mutation({
  args: { courseId: v.id("courses"), studentId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!currentUser || currentUser.role !== "admin") {
      throw new ConvexError({ message: "Only admins can assign students", code: "FORBIDDEN" });
    }
    const existing = await ctx.db
      .query("enrollments")
      .withIndex("by_student_and_course", (q) => q.eq("studentId", args.studentId).eq("courseId", args.courseId))
      .unique();
    if (existing) throw new ConvexError({ message: "Student already enrolled", code: "CONFLICT" });
    await ctx.db.insert("enrollments", {
      studentId: args.studentId,
      courseId: args.courseId,
      enrolledAt: new Date().toISOString(),
    });
    const course = await ctx.db.get(args.courseId);
    if (course) await ctx.db.patch(args.courseId, { enrollmentCount: course.enrollmentCount + 1 });
  },
});

export const adminUnenrollStudent = mutation({
  args: { courseId: v.id("courses"), studentId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!currentUser || currentUser.role !== "admin") {
      throw new ConvexError({ message: "Only admins can remove students", code: "FORBIDDEN" });
    }
    const enrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_student_and_course", (q) => q.eq("studentId", args.studentId).eq("courseId", args.courseId))
      .unique();
    if (!enrollment) throw new ConvexError({ message: "Enrollment not found", code: "NOT_FOUND" });
    await ctx.db.delete(enrollment._id);
    const course = await ctx.db.get(args.courseId);
    if (course && course.enrollmentCount > 0) {
      await ctx.db.patch(args.courseId, { enrollmentCount: course.enrollmentCount - 1 });
    }
  },
});

export const isEnrolled = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) return false;
    const enrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_student_and_course", (q) => q.eq("studentId", user._id).eq("courseId", args.courseId))
      .unique();
    return !!enrollment;
  },
});

// Returns courses for the current org grouped by program category, with semester separation
export const getCoursesGroupedByProgram = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user?.orgId) return [];
    const allCourses = await ctx.db
      .query("courses")
      .withIndex("by_org", (q) => q.eq("orgId", user.orgId))
      .collect();
    const categories = await ctx.db
      .query("programCategories")
      .withIndex("by_org", (q) => q.eq("orgId", user.orgId!))
      .collect();
    const catMap = new Map(categories.map((c) => [c._id.toString(), c]));
    // Group by program category, then by semester inside each group
    type SemKey = "first" | "second" | "full_term";
    type SemGroup = { first: typeof allCourses; second: typeof allCourses; full_term: typeof allCourses };
    const grouped: Record<string, { category: { _id: string; name: string; description?: string } | null; semesterGroups: SemGroup }> = {
      uncategorized: { category: null, semesterGroups: { first: [], second: [], full_term: [] } },
    };
    for (const cat of categories) {
      grouped[cat._id.toString()] = {
        category: { _id: cat._id.toString(), name: cat.name, description: cat.description },
        semesterGroups: { first: [], second: [], full_term: [] },
      };
    }
    const isStaff = user.role === "admin" || user.role === "superadmin" || user.role === "lecturer";
    for (const course of allCourses) {
      // Students only browse published courses that sit inside a program
      if (!isStaff && (!course.published || !course.programCategoryId)) continue;
      const key = course.programCategoryId && catMap.has(course.programCategoryId.toString())
        ? course.programCategoryId.toString()
        : "uncategorized";
      const sem: SemKey = course.semester ?? "first";
      grouped[key].semesterGroups[sem].push(course);
    }
    return Object.values(grouped).filter((g) => {
      const total = g.semesterGroups.first.length + g.semesterGroups.second.length + g.semesterGroups.full_term.length;
      return total > 0 || g.category !== null;
    });
  },
});

// Bulk enroll students into one or more courses
export const bulkEnrollStudents = mutation({
  args: {
    studentIds: v.array(v.id("users")),
    courseIds: v.array(v.id("courses")),
    level: v.optional(v.number()), // 100, 200, 300, 400
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      throw new ConvexError({ message: "Only admins can bulk-enroll students", code: "FORBIDDEN" });
    }
    let enrolled = 0;
    for (const studentId of args.studentIds) {
      // Optionally set level on the student
      if (args.level !== undefined) {
        await ctx.db.patch(studentId, { level: args.level });
      }
      for (const courseId of args.courseIds) {
        const existing = await ctx.db
          .query("enrollments")
          .withIndex("by_student_and_course", (q) => q.eq("studentId", studentId).eq("courseId", courseId))
          .unique();
        if (!existing) {
          await ctx.db.insert("enrollments", {
            studentId,
            courseId,
            enrolledAt: new Date().toISOString(),
          });
          const course = await ctx.db.get(courseId);
          if (course) await ctx.db.patch(courseId, { enrollmentCount: course.enrollmentCount + 1 });
          enrolled++;
        }
      }
    }
    return { enrolled };
  },
});

// Admin adds a student to the institution manually (creates user record if needed, assigns orgId+role)
export const adminAddStudentManually = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    level: v.optional(v.number()),
    courseIds: v.array(v.id("courses")),
  },
  handler: async (ctx, args): Promise<{ userId: Id<"users">; enrolled: number; isNew: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!admin || (admin.role !== "admin" && admin.role !== "superadmin")) {
      throw new ConvexError({ message: "Only admins can add students", code: "FORBIDDEN" });
    }
    if (!admin.orgId) throw new ConvexError({ message: "No org found", code: "BAD_REQUEST" });

    // Find existing user by email
    let studentId: Id<"users"> | null = null;
    let isNew = false;
    const allUsers = await ctx.db.query("users").collect();
    const existing = allUsers.find((u) => u.email === args.email);
    if (existing) {
      studentId = existing._id;
      // Grant org access if not already in this org
      if (existing.orgId?.toString() !== admin.orgId.toString()) {
        const membership = await ctx.db
          .query("orgMemberships")
          .withIndex("by_user_and_org", (q) => q.eq("userId", existing._id).eq("orgId", admin.orgId!))
          .unique();
        if (!membership) {
          await ctx.db.insert("orgMemberships", {
            userId: existing._id,
            orgId: admin.orgId,
            role: "student",
            joinedAt: new Date().toISOString(),
            indexNumber: await nextStudentId(ctx, admin.orgId),
          });
          await ctx.db.patch(existing._id, { orgId: admin.orgId, role: "student", level: args.level });
        }
      }
    } else {
      // Create a placeholder user
      const indexNumber = await nextStudentId(ctx, admin.orgId);
      studentId = await ctx.db.insert("users", {
        tokenIdentifier: `placeholder|${args.email}`,
        name: args.name,
        email: args.email,
        role: "student",
        orgId: admin.orgId,
        level: args.level,
        indexNumber,
      });
      await ctx.db.insert("orgMemberships", {
        userId: studentId,
        orgId: admin.orgId,
        role: "student",
        joinedAt: new Date().toISOString(),
        indexNumber,
      });
      isNew = true;
    }

    let enrolled = 0;
    for (const courseId of args.courseIds) {
      const existing2 = await ctx.db
        .query("enrollments")
        .withIndex("by_student_and_course", (q) => q.eq("studentId", studentId!).eq("courseId", courseId))
        .unique();
      if (!existing2) {
        await ctx.db.insert("enrollments", {
          studentId: studentId!,
          courseId,
          enrolledAt: new Date().toISOString(),
        });
        const course = await ctx.db.get(courseId);
        if (course) await ctx.db.patch(courseId, { enrollmentCount: course.enrollmentCount + 1 });
        enrolled++;
      }
    }
    return { userId: studentId!, enrolled, isNew };
  },
});

// Assign / unassign an existing course to a program category (admin only)
export const assignCourseToProgram = mutation({
  args: {
    courseId: v.id("courses"),
    programCategoryId: v.optional(v.id("programCategories")),
    semester: v.optional(v.union(v.literal("first"), v.literal("second"), v.literal("full_term"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError({ message: "Only admins can assign courses to programs", code: "FORBIDDEN" });
    }
    await ctx.db.patch(args.courseId, {
      programCategoryId: args.programCategoryId,
      semester: args.semester,
    });
  },
});

// Get all courses for org (unassigned ones — no programCategoryId)
export const getUnassignedCourses = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user?.orgId || (user.role !== "admin" && user.role !== "superadmin")) return [];
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_org", (q) => q.eq("orgId", user.orgId))
      .collect();
    return courses.filter((c) => !c.programCategoryId);
  },
});

// Update student level
export const setStudentLevel = mutation({
  args: { studentId: v.id("users"), level: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!admin || (admin.role !== "admin" && admin.role !== "superadmin")) {
      throw new ConvexError({ message: "Only admins can update levels", code: "FORBIDDEN" });
    }
    await ctx.db.patch(args.studentId, { level: args.level });
  },
});
