import { v, ConvexError } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

// Internal: called by AI action to persist quiz + questions atomically
export const createQuizWithQuestions = internalMutation({
  args: {
    title: v.string(),
    courseId: v.id("courses"),
    createdBy: v.id("users"),
    orgId: v.optional(v.id("organizations")),
    timeLimit: v.optional(v.number()),
    sourcePdfName: v.optional(v.string()),
    sourcePdfStorageId: v.optional(v.id("_storage")),
    questions: v.array(v.object({
      questionText: v.string(),
      options: v.array(v.string()),
      correctOptionIndex: v.number(),
      explanation: v.string(),
      points: v.number(),
      orderIndex: v.number(),
    })),
  },
  handler: async (ctx, args): Promise<Id<"quizzes">> => {
    const totalPoints = args.questions.reduce((sum, q) => sum + q.points, 0);
    const quizId = await ctx.db.insert("quizzes", {
      title: args.title,
      courseId: args.courseId,
      createdBy: args.createdBy,
      orgId: args.orgId,
      published: false,
      timeLimit: args.timeLimit,
      sourcePdfName: args.sourcePdfName,
      sourcePdfStorageId: args.sourcePdfStorageId,
      totalPoints,
      questionCount: args.questions.length,
    });

    for (const q of args.questions) {
      await ctx.db.insert("questions", {
        quizId,
        questionText: q.questionText,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
        explanation: q.explanation,
        points: q.points,
        orderIndex: q.orderIndex,
      });
    }

    return quizId;
  },
});

export const getQuizzesByCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("quizzes")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
  },
});

export const getAllQuizzesForLecturer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) return [];

    // Superadmin sees all
    if (user.role === "superadmin") return await ctx.db.query("quizzes").collect();

    // Admin sees all quizzes in their org
    if (user.role === "admin" && user.orgId) {
      return await ctx.db
        .query("quizzes")
        .withIndex("by_org", (q) => q.eq("orgId", user.orgId))
        .collect();
    }

    // Lecturer sees only quizzes they created
    return await ctx.db
      .query("quizzes")
      .withIndex("by_creator", (q) => q.eq("createdBy", user._id))
      .collect();
  },
});

export const getQuizById = query({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.quizId);
  },
});

export const getQuizWithQuestions = query({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) return null;
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_quiz", (q) => q.eq("quizId", args.quizId))
      .collect();
    questions.sort((a, b) => a.orderIndex - b.orderIndex);
    return { ...quiz, questions };
  },
});

export const publishQuiz = mutation({
  args: { quizId: v.id("quizzes"), published: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || (user.role !== "lecturer" && user.role !== "admin")) {
      throw new ConvexError({ message: "Only lecturers/admins can publish quizzes", code: "FORBIDDEN" });
    }
    await ctx.db.patch(args.quizId, { published: args.published });
  },
});

export const deleteQuiz = mutation({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    // Delete questions first
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_quiz", (q) => q.eq("quizId", args.quizId))
      .collect();
    for (const q of questions) await ctx.db.delete(q._id);
    await ctx.db.delete(args.quizId);
  },
});

// Get published quizzes for a course (used by enrolled students)
export const getPublishedQuizzesByCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) return [];
    // Check student is enrolled
    const enrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_student_and_course", (q) => q.eq("studentId", user._id).eq("courseId", args.courseId))
      .unique();
    if (!enrollment && user.role !== "admin" && user.role !== "lecturer") return [];

    return await ctx.db
      .query("quizzes")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .filter((q) => q.eq(q.field("published"), true))
      .collect();
  },
});

export const setRetryAllowed = mutation({
  args: { quizId: v.id("quizzes"), retryAllowed: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || (user.role !== "lecturer" && user.role !== "admin")) {
      throw new ConvexError({ message: "Only lecturers/admins can change retry settings", code: "FORBIDDEN" });
    }
    await ctx.db.patch(args.quizId, { retryAllowed: args.retryAllowed });
  },
});

export const createManualQuiz = mutation({
  args: {
    title: v.string(),
    courseId: v.id("courses"),
    timeLimit: v.optional(v.number()),
    questions: v.array(v.object({
      questionText: v.string(),
      options: v.array(v.string()),
      correctOptionIndex: v.number(),
      explanation: v.optional(v.string()),
      points: v.number(),
      orderIndex: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || (user.role !== "lecturer" && user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError({ message: "Only lecturers/admins can create quizzes", code: "FORBIDDEN" });
    }

    const totalPoints = args.questions.reduce((sum, q) => sum + q.points, 0);
    const quizId = await ctx.db.insert("quizzes", {
      title: args.title,
      courseId: args.courseId,
      createdBy: user._id,
      orgId: user.orgId,
      published: false,
      timeLimit: args.timeLimit,
      totalPoints,
      questionCount: args.questions.length,
    });

    for (const q of args.questions) {
      await ctx.db.insert("questions", {
        quizId,
        questionText: q.questionText,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
        explanation: q.explanation,
        points: q.points,
        orderIndex: q.orderIndex,
      });
    }

    return quizId;
  },
});

export const updateQuizTitle = mutation({
  args: { quizId: v.id("quizzes"), title: v.string(), timeLimit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quizId, { title: args.title, timeLimit: args.timeLimit });
  },
});

export const setQuizSchedule = mutation({
  args: {
    quizId: v.id("quizzes"),
    availableFrom: v.optional(v.string()),
    availableUntil: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).first();
    if (!user || (user.role !== "lecturer" && user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError({ message: "Not authorized", code: "FORBIDDEN" });
    }
    await ctx.db.patch(args.quizId, {
      availableFrom: args.availableFrom,
      availableUntil: args.availableUntil,
    });
  },
});

export const setMaxAttempts = mutation({
  args: {
    quizId: v.id("quizzes"),
    maxAttempts: v.optional(v.number()), // undefined = unlimited
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).first();
    if (!user || (user.role !== "lecturer" && user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError({ message: "Not authorized", code: "FORBIDDEN" });
    }
    await ctx.db.patch(args.quizId, { maxAttempts: args.maxAttempts });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    return await ctx.storage.generateUploadUrl();
  },
});
