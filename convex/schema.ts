import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ── Organizations ────────────────────────────────────────────────────────────
  organizations: defineTable({
    name: v.string(),
    // Last student ID number issued (only ever increases, keeps IDs unique)
    studentSeq: v.optional(v.number()),
    slug: v.string(), // unique URL-friendly identifier e.g. "mit", "greenwood-high"
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    website: v.optional(v.string()),
    type: v.optional(v.union(
      v.literal("university"),
      v.literal("school"),
      v.literal("senior_high_school"),
      v.literal("junior_high_school"),
      v.literal("bible_school"),
      v.literal("polytechnic"),
      v.literal("technical"),
      v.literal("nursing"),
      v.literal("vocational"),
      v.literal("business"),
      v.literal("other"),
    )),
    // Invite code for users to join this org
    inviteCode: v.string(),
    createdAt: v.string(),
    isActive: v.optional(v.boolean()), // false = deactivated by superadmin
    // Subscription
    plan: v.optional(v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise"))),
    paystackCustomerCode: v.optional(v.string()),
    planExpiresAt: v.optional(v.string()),
    // Theme customization by org admin (CSS variable overrides as JSON)
    theme: v.optional(v.string()),
    // Academic structure settings
    semesterMode: v.optional(v.union(
      v.literal("two_semester"),  // First + Second semester
      v.literal("one_term"),      // Single full term
    )),
  })
    .index("by_slug", ["slug"])
    .index("by_invite_code", ["inviteCode"]),

  // ── Multi-org memberships (users can belong to multiple orgs) ────────────────
  orgMemberships: defineTable({
    userId: v.id("users"),
    orgId: v.id("organizations"),
    role: v.union(v.literal("admin"), v.literal("lecturer"), v.literal("student")),
    joinedAt: v.string(),
    // Student ID for this specific institution
    indexNumber: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"])
    .index("by_user_and_org", ["userId", "orgId"]),

  // ── Users ────────────────────────────────────────────────────────────────────
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    avatar: v.optional(v.string()),
    phone: v.optional(v.string()),
    // Roles: "superadmin" = platform owner, "admin" = org admin, "lecturer", "student"
    role: v.optional(v.union(
      v.literal("superadmin"),
      v.literal("admin"),
      v.literal("lecturer"),
      v.literal("student"),
    )),
    lecturerApproved: v.optional(v.boolean()),
    // Primary org this user belongs to
    orgId: v.optional(v.id("organizations")),
    // Currently active org when user has multiple memberships
    activeOrgId: v.optional(v.id("organizations")),
    // Auto-assigned index number when accepted into an institution (students only)
    indexNumber: v.optional(v.string()),
    // Academic level: 100, 200, 300, 400 (set by admin on enrollment)
    level: v.optional(v.number()),
    // Student's self-selected program of study (programCategories._id)
    enrolledProgramId: v.optional(v.id("programCategories")),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_role", ["role"])
    .index("by_org", ["orgId"]),

  // ── Program categories (groupings under an org) ──────────────────────────────
  programCategories: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),          // e.g. "Computer Science", "Business Administration"
    description: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_org", ["orgId"]),

  // ── Courses ──────────────────────────────────────────────────────────────────
  courses: defineTable({
    title: v.string(),
    description: v.string(),
    category: v.string(),        // legacy plain-text category
    programCategoryId: v.optional(v.id("programCategories")), // new structured grouping
    // Semester this course belongs to
    semester: v.optional(v.union(
      v.literal("first"),
      v.literal("second"),
      v.literal("full_term"),
    )),
    coverImage: v.optional(v.string()),
    lecturerId: v.id("users"),
    orgId: v.optional(v.id("organizations")),
    published: v.boolean(),
    enrollmentCount: v.number(),
  })
    .index("by_lecturer", ["lecturerId"])
    .index("by_published", ["published"])
    .index("by_org", ["orgId"])
    .index("by_program_category", ["programCategoryId"]),

  // ── Enrollments ──────────────────────────────────────────────────────────────
  enrollments: defineTable({
    studentId: v.id("users"),
    courseId: v.id("courses"),
    enrolledAt: v.string(),
  })
    .index("by_student", ["studentId"])
    .index("by_course", ["courseId"])
    .index("by_student_and_course", ["studentId", "courseId"]),

  // ── Course access requests ───────────────────────────────────────────────────
  courseRequests: defineTable({
    studentId: v.id("users"),
    courseId: v.id("courses"),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    requestedAt: v.string(),
    reviewedAt: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
  })
    .index("by_student", ["studentId"])
    .index("by_course", ["courseId"])
    .index("by_status", ["status"])
    .index("by_student_and_course", ["studentId", "courseId"]),

  // ── Quizzes ──────────────────────────────────────────────────────────────────
  quizzes: defineTable({
    title: v.string(),
    courseId: v.id("courses"),
    createdBy: v.id("users"),
    orgId: v.optional(v.id("organizations")), // org-scoped quiz ownership
    published: v.boolean(),
    timeLimit: v.optional(v.number()),
    retryAllowed: v.optional(v.boolean()),
    maxAttempts: v.optional(v.number()), // null/undefined = unlimited
    availableFrom: v.optional(v.string()), // ISO datetime for scheduling
    availableUntil: v.optional(v.string()), // ISO datetime for scheduling
    sourcePdfName: v.optional(v.string()),
    sourcePdfStorageId: v.optional(v.id("_storage")),
    totalPoints: v.number(),
    questionCount: v.number(),
  })
    .index("by_course", ["courseId"])
    .index("by_creator", ["createdBy"])
    .index("by_org", ["orgId"]),

  // ── Questions ────────────────────────────────────────────────────────────────
  questions: defineTable({
    quizId: v.id("quizzes"),
    questionText: v.string(),
    options: v.array(v.string()),
    correctOptionIndex: v.number(),
    explanation: v.optional(v.string()),
    points: v.number(),
    orderIndex: v.number(),
  }).index("by_quiz", ["quizId"]),

  // ── Quiz Attempts ────────────────────────────────────────────────────────────
  quizAttempts: defineTable({
    quizId: v.id("quizzes"),
    studentId: v.id("users"),
    courseId: v.id("courses"),
    startedAt: v.string(),
    completedAt: v.optional(v.string()),
    answers: v.array(v.object({ questionId: v.id("questions"), selectedOption: v.number() })),
    score: v.optional(v.number()),
    totalPoints: v.optional(v.number()),
    percentage: v.optional(v.number()),
    passed: v.optional(v.boolean()),
    status: v.optional(v.union(v.literal("in_progress"), v.literal("completed"))),
  })
    .index("by_student", ["studentId"])
    .index("by_quiz", ["quizId"])
    .index("by_student_and_quiz", ["studentId", "quizId"]),
  // ── Assignments ──────────────────────────────────────────────────────────────
  assignments: defineTable({
    orgId: v.id("organizations"),
    courseId: v.id("courses"),
    createdBy: v.id("users"),
    title: v.string(),
    instructions: v.optional(v.string()),
    dueAt: v.string(), // ISO UTC
    maxScore: v.number(),
    // Lowercase extensions lecturers accept, e.g. ["pdf","docx","png"]
    allowedFormats: v.array(v.string()),
    createdAt: v.string(),
  })
    .index("by_course", ["courseId"])
    .index("by_org", ["orgId"]),

  assignmentSubmissions: defineTable({
    assignmentId: v.id("assignments"),
    studentId: v.id("users"),
    files: v.array(v.object({
      storageId: v.id("_storage"),
      fileName: v.string(),
      size: v.number(),
    })),
    note: v.optional(v.string()),
    submittedAt: v.string(),
    isLate: v.boolean(),
    score: v.optional(v.number()),
    feedback: v.optional(v.string()),
    gradedAt: v.optional(v.string()),
  })
    .index("by_assignment", ["assignmentId"])
    .index("by_student", ["studentId"])
    .index("by_assignment_and_student", ["assignmentId", "studentId"]),

  // ── Org invite code requests ─────────────────────────────────────────────────
  orgInviteRequests: defineTable({
    userId: v.id("users"),
    orgId: v.id("organizations"),
    // Contact details submitted by the user
    fullName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    message: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    createdAt: v.string(),
    reviewedAt: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"])
    .index("by_status", ["status"])
    .index("by_user_and_org", ["userId", "orgId"]),

  // ── Forum posts ──────────────────────────────────────────────────────────────
  forumThreads: defineTable({
    orgId: v.id("organizations"),
    authorId: v.id("users"),
    title: v.string(),
    body: v.string(),
    category: v.optional(v.string()),
    upvotes: v.number(),
    replyCount: v.number(),
    isPinned: v.optional(v.boolean()),
    createdAt: v.string(),
  })
    .index("by_org", ["orgId"])
    .index("by_author", ["authorId"]),

  forumReplies: defineTable({
    threadId: v.id("forumThreads"),
    authorId: v.id("users"),
    body: v.string(),
    upvotes: v.number(),
    createdAt: v.string(),
  })
    .index("by_thread", ["threadId"])
    .index("by_author", ["authorId"]),

  // One vote per user per thread/reply
  forumVotes: defineTable({
    userId: v.id("users"),
    threadId: v.optional(v.id("forumThreads")),
    replyId: v.optional(v.id("forumReplies")),
  })
    .index("by_user_and_thread", ["userId", "threadId"])
    .index("by_user_and_reply", ["userId", "replyId"]),

  // ── Course materials ─────────────────────────────────────────────────────────
  courseMaterials: defineTable({
    courseId: v.id("courses"),
    uploadedBy: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    // type determines what kind of material this is
    type: v.optional(v.union(v.literal("file"), v.literal("link"), v.literal("video"))),
    // For file type
    fileStorageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    // For link/video type
    url: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_course", ["courseId"])
    .index("by_uploader", ["uploadedBy"]),

  // ── Platform billing config (superadmin controlled) ──────────────────────────
  platformConfig: defineTable({
    key: v.string(), // e.g. "plan_prices"
    value: v.string(), // JSON encoded value
    updatedAt: v.string(),
  }).index("by_key", ["key"]),

  // ── Payments ─────────────────────────────────────────────────────────────────
  payments: defineTable({
    orgId: v.id("organizations"),
    reference: v.string(),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    amountGHS: v.number(),
    // Currency the customer actually paid in, and the amount in that currency
    currency: v.optional(v.string()),
    amountPaid: v.optional(v.number()),
    status: v.union(v.literal("success"), v.literal("failed"), v.literal("pending")),
    paidAt: v.string(),
  })
    .index("by_org", ["orgId"])
    .index("by_reference", ["reference"]),

  // ── Push notification identity mapping ───────────────────────────────────────
  pushIdentities: defineTable({
    secret: v.string(),
    visitorId: v.string(),
  })
    .index("by_secret", ["secret"])
    .index("by_visitorId", ["visitorId"]),

  // ── Superadmin invitations ────────────────────────────────────────────────────
  superadminInvites: defineTable({
    email: v.string(),
    invitedBy: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("expired")),
    token: v.string(),
    createdAt: v.string(),
    expiresAt: v.string(),
  })
    .index("by_email", ["email"])
    .index("by_token", ["token"])
    .index("by_status", ["status"]),

  // ── Student → Program enrollment requests ───────────────────────────────────
  programEnrollmentRequests: defineTable({
    studentId: v.id("users"),
    programId: v.id("programCategories"),
    orgId: v.id("organizations"),
    // Personal details submitted by student
    fullName: v.string(),
    phone: v.string(),
    indexNumber: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("other"), v.literal("prefer_not_to_say"))),
    yearOfStudy: v.optional(v.string()),
    message: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    requestedAt: v.string(),
    reviewedAt: v.optional(v.string()),
  })
    .index("by_student", ["studentId"])
    .index("by_program", ["programId"])
    .index("by_org", ["orgId"])
    .index("by_status", ["status"])
    .index("by_student_and_program", ["studentId", "programId"]),

  // ── Lecturer ↔ Program assignments ──────────────────────────────────────────
  programLecturers: defineTable({
    programId: v.id("programCategories"),
    lecturerId: v.id("users"),
    orgId: v.id("organizations"),
    assignedAt: v.string(),
  })
    .index("by_program", ["programId"])
    .index("by_lecturer", ["lecturerId"])
    .index("by_org", ["orgId"])
    .index("by_program_and_lecturer", ["programId", "lecturerId"]),

  // ── Lecturer requests to access a program ────────────────────────────────────
  programAccessRequests: defineTable({
    programId: v.id("programCategories"),
    lecturerId: v.id("users"),
    orgId: v.id("organizations"),
    message: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    requestedAt: v.string(),
    reviewedAt: v.optional(v.string()),
  })
    .index("by_program", ["programId"])
    .index("by_lecturer", ["lecturerId"])
    .index("by_org", ["orgId"])
    .index("by_status", ["status"])
    .index("by_program_and_lecturer", ["programId", "lecturerId"]),

  // ── Content library ──────────────────────────────────────────────────────────
  libraryItems: defineTable({
    orgId: v.optional(v.id("organizations")), // null = global/platform item
    addedBy: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    type: v.union(v.literal("pdf"), v.literal("video"), v.literal("link"), v.literal("document")),
    url: v.optional(v.string()), // for links/videos
    fileStorageId: v.optional(v.id("_storage")), // for uploaded files
    fileName: v.optional(v.string()),
    tags: v.array(v.string()),
    createdAt: v.string(),
  })
    .index("by_org", ["orgId"])
    .index("by_category", ["category"])
    .index("by_type", ["type"])
    .index("by_adder", ["addedBy"]),

  // ── Live classes (WebRTC signaling via Convex) ───────────────────────────────
  liveSessions: defineTable({
    orgId: v.id("organizations"),
    hostId: v.id("users"),
    title: v.string(),
    mode: v.union(v.literal("video"), v.literal("audio")),
    status: v.union(v.literal("live"), v.literal("ended")),
    startedAt: v.string(),
    endedAt: v.optional(v.string()),
    // Audience: course students, program students, or (neither) the whole institution
    courseId: v.optional(v.id("courses")),
    programId: v.optional(v.id("programCategories")),
    isRecording: v.optional(v.boolean()),
  }).index("by_org_and_status", ["orgId", "status"]),

  liveParticipants: defineTable({
    sessionId: v.id("liveSessions"),
    userId: v.id("users"),
    peerId: v.string(),
    name: v.string(),
    joinedAt: v.number(),
    lastSeen: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_and_peer", ["sessionId", "peerId"]),

  // Chat inside a live class. No recipientId = visible to everyone; with recipientId = private
  liveMessages: defineTable({
    sessionId: v.id("liveSessions"),
    senderId: v.id("users"),
    senderName: v.string(),
    recipientId: v.optional(v.id("users")),
    body: v.string(),
    createdAt: v.string(),
  }).index("by_session", ["sessionId"]),

  liveSignals: defineTable({
    sessionId: v.id("liveSessions"),
    fromPeer: v.string(),
    toPeer: v.string(),
    kind: v.union(v.literal("offer"), v.literal("answer"), v.literal("candidate")),
    payload: v.string(),
  }).index("by_session_and_to", ["sessionId", "toPeer"]),
});
