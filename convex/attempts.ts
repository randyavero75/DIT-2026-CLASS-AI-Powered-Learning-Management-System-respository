import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

// Helper: grade answers against quiz questions
async function gradeAnswers(
  ctx: MutationCtx,
  quizId: Id<"quizzes">,
  answers: { questionId: Id<"questions">; selectedOption: number }[]
) {
  const questions = await ctx.db
    .query("questions")
    .withIndex("by_quiz", (q) => q.eq("quizId", quizId))
    .collect();

  let score = 0;
  let totalPoints = 0;
  for (const q of questions) {
    totalPoints += q.points;
    const answer = answers.find((a) => a.questionId === q._id);
    if (answer && answer.selectedOption === q.correctOptionIndex) {
      score += q.points;
    }
  }
  const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
  return { score, totalPoints, percentage, passed: percentage >= 50 };
}

// Helper: check quiz availability window
function checkQuizAvailability(quiz: { availableFrom?: string; availableUntil?: string; published: boolean }) {
  if (!quiz.published) return { available: false, reason: "Quiz is not published" };
  const now = new Date();
  if (quiz.availableFrom && new Date(quiz.availableFrom) > now) {
    return { available: false, reason: `Quiz opens on ${new Date(quiz.availableFrom).toLocaleString()}` };
  }
  if (quiz.availableUntil && new Date(quiz.availableUntil) < now) {
    return { available: false, reason: "Quiz window has closed" };
  }
  return { available: true, reason: "" };
}

// Start or resume an in-progress attempt. Returns attemptId and whether it is a fresh start.
export const startAttempt = mutation({
  args: {
    quizId: v.id("quizzes"),
    courseId: v.id("courses"),
  },
  handler: async (ctx, args): Promise<{ attemptId: Id<"quizAttempts">; isNew: boolean; startedAt: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) throw new ConvexError({ message: "Quiz not found", code: "NOT_FOUND" });

    // Check availability window
    const avail = checkQuizAvailability(quiz);
    if (!avail.available) {
      throw new ConvexError({ message: avail.reason, code: "FORBIDDEN" });
    }

    // Count completed attempts for this student
    const completedAttempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_student_and_quiz", (q) =>
        q.eq("studentId", user._id).eq("quizId", args.quizId)
      )
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    const maxAttempts = quiz.maxAttempts ?? (quiz.retryAllowed ? 999 : 1);
    if (completedAttempts.length >= maxAttempts) {
      throw new ConvexError({
        message: maxAttempts === 1
          ? "You have already completed this quiz and retry is not allowed"
          : `You have used all ${maxAttempts} allowed attempts`,
        code: "FORBIDDEN"
      });
    }

    // Check for existing in-progress attempt
    const inProgress = await ctx.db
      .query("quizAttempts")
      .withIndex("by_student_and_quiz", (q) =>
        q.eq("studentId", user._id).eq("quizId", args.quizId)
      )
      .filter((q) => q.eq(q.field("status"), "in_progress"))
      .first();

    if (inProgress) {
      return { attemptId: inProgress._id, isNew: false, startedAt: inProgress.startedAt };
    }

    const now = new Date().toISOString();
    const attemptId = await ctx.db.insert("quizAttempts", {
      quizId: args.quizId,
      studentId: user._id,
      courseId: args.courseId,
      startedAt: now,
      answers: [],
      status: "in_progress",
    });

    return { attemptId, isNew: true, startedAt: now };
  },
});

// Save answers as the student progresses
export const saveProgress = mutation({
  args: {
    attemptId: v.id("quizAttempts"),
    answers: v.array(v.object({ questionId: v.id("questions"), selectedOption: v.number() })),
  },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.status === "completed") return;
    await ctx.db.patch(args.attemptId, { answers: args.answers });
  },
});

// Submit and grade a quiz attempt — latest attempt result is always accepted
export const submitQuizAttempt = mutation({
  args: {
    quizId: v.id("quizzes"),
    courseId: v.id("courses"),
    answers: v.array(v.object({
      questionId: v.id("questions"),
      selectedOption: v.number(),
    })),
    attemptId: v.optional(v.id("quizAttempts")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) throw new ConvexError({ message: "Quiz not found", code: "NOT_FOUND" });

    const graded = await gradeAnswers(ctx, args.quizId, args.answers);
    const now = new Date().toISOString();

    // Update the existing in-progress attempt if provided
    if (args.attemptId) {
      const existing = await ctx.db.get(args.attemptId);
      if (existing && existing.status !== "completed") {
        await ctx.db.patch(args.attemptId, {
          answers: args.answers,
          completedAt: now,
          status: "completed",
          ...graded,
        });
        return { attemptId: args.attemptId, ...graded };
      }
    }

    // Fallback: create a new completed record
    const attemptId = await ctx.db.insert("quizAttempts", {
      quizId: args.quizId,
      studentId: user._id,
      courseId: args.courseId,
      startedAt: now,
      completedAt: now,
      answers: args.answers,
      status: "completed",
      ...graded,
    });

    return { attemptId, ...graded };
  },
});

// Auto-submit in-progress attempt when student navigates away
export const autoSubmitIfInProgress = mutation({
  args: {
    attemptId: v.id("quizAttempts"),
    answers: v.array(v.object({ questionId: v.id("questions"), selectedOption: v.number() })),
  },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.status === "completed") return null;

    const graded = await gradeAnswers(ctx, attempt.quizId, args.answers);
    const now = new Date().toISOString();

    await ctx.db.patch(args.attemptId, {
      answers: args.answers,
      completedAt: now,
      status: "completed",
      ...graded,
    });

    return graded;
  },
});

// Returns quiz attempts scoped to the student's current org only
export const getMyAttempts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) return [];
    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .collect();
    if (!user.orgId) return attempts;
    // Filter to only attempts on quizzes belonging to the current org
    const filtered = await Promise.all(
      attempts.map(async (a) => {
        const quiz = await ctx.db.get(a.quizId);
        if (!quiz) return null;
        if (quiz.orgId?.toString() !== user.orgId!.toString()) return null;
        return a;
      })
    );
    return filtered.filter(Boolean);
  },
});

export const getAttemptsByQuiz = query({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "lecturer" && currentUser.role !== "superadmin")) return [];

    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_quiz", (q) => q.eq("quizId", args.quizId))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    // Only keep each student's LATEST attempt (latest result is accepted)
    const latestByStudent = new Map<string, typeof attempts[number]>();
    for (const a of attempts) {
      const key = a.studentId.toString();
      const existing = latestByStudent.get(key);
      if (!existing || new Date(a.completedAt ?? 0) > new Date(existing.completedAt ?? 0)) {
        latestByStudent.set(key, a);
      }
    }

    return await Promise.all(
      Array.from(latestByStudent.values()).map(async (attempt) => {
        const student = await ctx.db.get(attempt.studentId);
        return { ...attempt, student };
      })
    );
  },
});

// Get all attempts for a quiz (including all retries) for export
export const getAllAttemptsByQuiz = query({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "lecturer" && currentUser.role !== "superadmin")) return [];

    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_quiz", (q) => q.eq("quizId", args.quizId))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    return await Promise.all(
      attempts.map(async (attempt) => {
        const student = await ctx.db.get(attempt.studentId);
        return { ...attempt, studentName: student?.name ?? "Unknown", studentEmail: student?.email ?? "" };
      })
    );
  },
});

// Count completed attempts for a student on a quiz — only if quiz belongs to current org
export const getMyAttemptCountForQuiz = query({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) return 0;
    // Verify quiz belongs to user's current org
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) return 0;
    if (user.orgId && quiz.orgId?.toString() !== user.orgId.toString()) return 0;
    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_student_and_quiz", (q) => q.eq("studentId", user._id).eq("quizId", args.quizId))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();
    return attempts.length;
  },
});

export const getAttemptById = query({
  args: { attemptId: v.id("quizAttempts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.attemptId);
  },
});

export const getMyAttemptForQuiz = query({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) return null;
    // Return the most recent completed attempt (latest is accepted)
    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_student_and_quiz", (q) => q.eq("studentId", user._id).eq("quizId", args.quizId))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();
    if (attempts.length === 0) return null;
    return attempts.sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime())[0];
  },
});

