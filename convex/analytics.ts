import { query } from "./_generated/server";

// Admin: org-scoped stats
export const getAdminStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return null;
    }

    // Only show data for the admin's own org
    const orgId = user.orgId;

    const allUsers = orgId
      ? await ctx.db.query("users").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect()
      : [];
    const allCourses = orgId
      ? await ctx.db.query("courses").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect()
      : [];
    const allCourseIds = new Set(allCourses.map((c) => c._id.toString()));

    const allQuizzesRaw = await ctx.db.query("quizzes").collect();
    const allQuizzes = allQuizzesRaw.filter((q) => allCourseIds.has(q.courseId.toString()));
    const allQuizIds = new Set(allQuizzes.map((q) => q._id.toString()));

    const allAttemptsRaw = await ctx.db.query("quizAttempts").collect();
    const allAttempts = allAttemptsRaw.filter((a) => allQuizIds.has(a.quizId.toString()));

    const allEnrollmentsRaw = await ctx.db.query("enrollments").collect();
    const allEnrollments = allEnrollmentsRaw.filter((e) => allCourseIds.has(e.courseId.toString()));

    const studentCount = allUsers.filter((u) => u.role === "student").length;
    const lecturerCount = allUsers.filter((u) => u.role === "lecturer").length;
    const publishedCourses = allCourses.filter((c) => c.published).length;
    const publishedQuizzes = allQuizzes.filter((q) => q.published).length;

    const avgScore =
      allAttempts.length > 0
        ? Math.round(allAttempts.reduce((acc, a) => acc + (a.percentage ?? 0), 0) / allAttempts.length)
        : 0;

    const passCount = allAttempts.filter((a) => a.passed).length;
    const passRate = allAttempts.length > 0 ? Math.round((passCount / allAttempts.length) * 100) : 0;

    // Recent attempts scoped to this org's quizzes (not all platform attempts)
    const recentAttempts = allAttempts
      .sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime())
      .slice(0, 8);
    const recentWithDetails = await Promise.all(
      recentAttempts.map(async (attempt) => {
        const student = await ctx.db.get(attempt.studentId);
        const quiz = await ctx.db.get(attempt.quizId);
        const course = await ctx.db.get(attempt.courseId);
        return { ...attempt, studentName: student?.name ?? "Unknown", quizTitle: quiz?.title ?? "Quiz", courseTitle: course?.title ?? "Course" };
      })
    );

    // Course performance
    const coursePerformance = await Promise.all(
      allCourses.slice(0, 6).map(async (course) => {
        const courseAttempts = allAttempts.filter((a) => a.courseId === course._id);
        const avgCourseScore =
          courseAttempts.length > 0
            ? Math.round(courseAttempts.reduce((acc, a) => acc + (a.percentage ?? 0), 0) / courseAttempts.length)
            : 0;
        return { name: course.title, attempts: courseAttempts.length, avgScore: avgCourseScore };
      })
    );

    return {
      totalUsers: allUsers.length,
      studentCount,
      lecturerCount,
      totalCourses: allCourses.length,
      publishedCourses,
      totalQuizzes: allQuizzes.length,
      publishedQuizzes,
      totalAttempts: allAttempts.length,
      totalEnrollments: allEnrollments.length,
      avgScore,
      passRate,
      recentAttempts: recentWithDetails,
      coursePerformance,
    };
  },
});

// Lecturer: stats for their courses and quizzes
export const getLecturerStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || (user.role !== "lecturer" && user.role !== "admin")) return null;

    const myCourses = await ctx.db
      .query("courses")
      .withIndex("by_lecturer", (q) => q.eq("lecturerId", user._id))
      .collect();

    const myCourseIds = myCourses.map((c) => c._id);

    const allQuizzes = await ctx.db.query("quizzes").collect();
    const myQuizzes = allQuizzes.filter((q) => myCourseIds.includes(q.courseId));
    const myQuizIds = myQuizzes.map((q) => q._id);

    const allAttempts = await ctx.db.query("quizAttempts").collect();
    const myAttempts = allAttempts.filter((a) => myQuizIds.includes(a.quizId));

    const allEnrollments = await ctx.db.query("enrollments").collect();
    const myEnrollments = allEnrollments.filter((e) => myCourseIds.includes(e.courseId));
    const uniqueStudents = new Set(myEnrollments.map((e) => e.studentId.toString())).size;

    const avgScore =
      myAttempts.length > 0
        ? Math.round(myAttempts.reduce((acc, a) => acc + (a.percentage ?? 0), 0) / myAttempts.length)
        : 0;

    const passRate =
      myAttempts.length > 0
        ? Math.round((myAttempts.filter((a) => a.passed).length / myAttempts.length) * 100)
        : 0;

    // Quiz performance breakdown
    const quizPerformance = await Promise.all(
      myQuizzes.slice(0, 6).map(async (quiz) => {
        const quizAttempts = myAttempts.filter((a) => a.quizId === quiz._id);
        const avgQuizScore =
          quizAttempts.length > 0
            ? Math.round(quizAttempts.reduce((acc, a) => acc + (a.percentage ?? 0), 0) / quizAttempts.length)
            : 0;
        return { name: quiz.title.length > 20 ? quiz.title.slice(0, 20) + "…" : quiz.title, attempts: quizAttempts.length, avgScore: avgQuizScore };
      })
    );

    // Recent attempts on my quizzes
    const recentAttempts = myAttempts
      .sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime())
      .slice(0, 8);

    const recentWithDetails = await Promise.all(
      recentAttempts.map(async (attempt) => {
        const student = await ctx.db.get(attempt.studentId);
        const quiz = await ctx.db.get(attempt.quizId);
        return { ...attempt, studentName: student?.name ?? "Unknown", quizTitle: quiz?.title ?? "Quiz" };
      })
    );

    return {
      courseCount: myCourses.length,
      publishedCourses: myCourses.filter((c) => c.published).length,
      quizCount: myQuizzes.length,
      publishedQuizzes: myQuizzes.filter((q) => q.published).length,
      totalStudents: uniqueStudents,
      totalAttempts: myAttempts.length,
      avgScore,
      passRate,
      quizPerformance,
      recentAttempts: recentWithDetails,
    };
  },
});

// Student: their personal progress stats — scoped to current org only
export const getStudentStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) return null;

    // Get all enrollments for this student
    const allEnrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .collect();

    // Only include enrollments for courses in the student's current org
    const orgEnrollments = user.orgId
      ? (
          await Promise.all(
            allEnrollments.map(async (e) => {
              const course = await ctx.db.get(e.courseId);
              if (!course) return null;
              if (course.orgId?.toString() !== user.orgId!.toString()) return null;
              return e;
            })
          )
        ).filter(Boolean)
      : allEnrollments;

    const orgCourseIds = new Set(orgEnrollments.map((e) => e!.courseId.toString()));

    // Get all quiz attempts for this student
    const allAttempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .collect();

    // Only include attempts on quizzes belonging to the current org
    const myAttempts = user.orgId
      ? (
          await Promise.all(
            allAttempts.map(async (a) => {
              const quiz = await ctx.db.get(a.quizId);
              if (!quiz) return null;
              if (quiz.orgId?.toString() !== user.orgId!.toString()) return null;
              return a;
            })
          )
        ).filter(Boolean)
      : allAttempts;

    const avgScore =
      myAttempts.length > 0
        ? Math.round(myAttempts.reduce((acc, a) => acc + (a!.percentage ?? 0), 0) / myAttempts.length)
        : 0;

    const bestScore = myAttempts.length > 0 ? Math.max(...myAttempts.map((a) => a!.percentage ?? 0)) : 0;
    const passCount = myAttempts.filter((a) => a!.passed).length;

    // Recent attempts (org-scoped) with quiz+course info
    const recentAttempts = [...myAttempts]
      .sort((a, b) => new Date(b!.completedAt ?? 0).getTime() - new Date(a!.completedAt ?? 0).getTime())
      .slice(0, 6);

    const recentWithDetails = await Promise.all(
      recentAttempts.map(async (attempt) => {
        const quiz = await ctx.db.get(attempt!.quizId);
        const course = await ctx.db.get(attempt!.courseId);
        return { ...attempt!, quizTitle: quiz?.title ?? "Quiz", courseTitle: course?.title ?? "Course" };
      })
    );

    // Score trend (last 6 attempts oldest first, org-scoped)
    const scoreTrend = [...myAttempts]
      .sort((a, b) => new Date(a!.completedAt ?? 0).getTime() - new Date(b!.completedAt ?? 0).getTime())
      .slice(-6)
      .map((a, i) => ({ name: `#${i + 1}`, score: a!.percentage ?? 0 }));

    // Per course progress — only courses in current org
    const courseProgress = await Promise.all(
      orgEnrollments.slice(0, 6).map(async (e) => {
        const course = await ctx.db.get(e!.courseId);
        if (!course) return null;
        const quizzes = await ctx.db
          .query("quizzes")
          .withIndex("by_course", (q) => q.eq("courseId", e!.courseId))
          .filter((q) => q.eq(q.field("published"), true))
          .collect();
        const attempted = myAttempts.filter((a) => a!.courseId === e!.courseId).length;
        const total = quizzes.length;
        return { name: course.title.length > 18 ? course.title.slice(0, 18) + "…" : course.title, attempted, total };
      })
    );

    return {
      enrolledCourses: orgEnrollments.length,
      quizzesTaken: myAttempts.length,
      avgScore,
      bestScore,
      passCount,
      recentAttempts: recentWithDetails,
      scoreTrend,
      courseProgress: courseProgress.filter(Boolean),
      // Show welcome hint if this is a brand-new member (no enrollments in current org)
      isFreshMember: orgEnrollments.length === 0 && orgCourseIds.size === 0,
    };
  },
});
