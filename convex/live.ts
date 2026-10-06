import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";

const STALE_MS = 60_000;

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

const HOST_ROLES = ["admin", "lecturer", "superadmin"];

// Audience check: hosts always get in; students need the course enrollment or program match
async function canAccessSession(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  session: Doc<"liveSessions">,
): Promise<boolean> {
  if (!user.orgId || user.orgId !== session.orgId) return false;
  if (user._id === session.hostId || (user.role && HOST_ROLES.includes(user.role))) return true;
  if (session.courseId) {
    const courseId = session.courseId;
    const enr = await ctx.db
      .query("enrollments")
      .withIndex("by_student_and_course", (q) => q.eq("studentId", user._id).eq("courseId", courseId))
      .first();
    return !!enr;
  }
  if (session.programId) return user.enrolledProgramId === session.programId;
  return true;
}

// Session must belong to the user's currently active institution
async function requireSessionAccess(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  sessionId: Id<"liveSessions">,
): Promise<Doc<"liveSessions">> {
  const session = await ctx.db.get(sessionId);
  if (!session) throw new ConvexError({ message: "Class not found", code: "NOT_FOUND" });
  if (!(await canAccessSession(ctx, user, session))) {
    throw new ConvexError({ message: "You are not part of this class audience", code: "FORBIDDEN" });
  }
  return session;
}

async function requireOwnPeer(
  ctx: MutationCtx | QueryCtx,
  user: Doc<"users">,
  sessionId: Id<"liveSessions">,
  peerId: string,
): Promise<Doc<"liveParticipants">> {
  const p = await ctx.db
    .query("liveParticipants")
    .withIndex("by_session_and_peer", (q) => q.eq("sessionId", sessionId).eq("peerId", peerId))
    .first();
  if (!p || p.userId !== user._id) {
    throw new ConvexError({ message: "Not part of this class", code: "FORBIDDEN" });
  }
  return p;
}

export const startSession = mutation({
  args: {
    title: v.string(),
    mode: v.union(v.literal("video"), v.literal("audio")),
    courseId: v.optional(v.id("courses")),
    programId: v.optional(v.id("programCategories")),
  },
  handler: async (ctx, args): Promise<Id<"liveSessions">> => {
    const user = await requireUser(ctx);
    const canHost = user.role === "admin" || user.role === "lecturer" || user.role === "superadmin";
    if (!canHost || !user.orgId) {
      throw new ConvexError({ message: "Only lecturers and admins can host live classes", code: "FORBIDDEN" });
    }
    const title = args.title.trim();
    if (!title) throw new ConvexError({ message: "Title is required", code: "BAD_REQUEST" });
    if (args.courseId) {
      const course = await ctx.db.get(args.courseId);
      if (!course || course.orgId !== user.orgId) {
        throw new ConvexError({ message: "Course not found in your institution", code: "BAD_REQUEST" });
      }
    }
    if (args.programId) {
      const program = await ctx.db.get(args.programId);
      if (!program || program.orgId !== user.orgId) {
        throw new ConvexError({ message: "Program not found in your institution", code: "BAD_REQUEST" });
      }
    }
    return await ctx.db.insert("liveSessions", {
      courseId: args.courseId,
      programId: args.programId,
      orgId: user.orgId,
      hostId: user._id,
      title,
      mode: args.mode,
      status: "live",
      startedAt: new Date().toISOString(),
    });
  },
});

export const endSession = mutation({
  args: { sessionId: v.id("liveSessions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const session = await requireSessionAccess(ctx, user, args.sessionId);
    if (session.hostId !== user._id && user.role !== "admin" && user.role !== "superadmin") {
      throw new ConvexError({ message: "Only the host can end this class", code: "FORBIDDEN" });
    }
    await ctx.db.patch(session._id, { status: "ended", endedAt: new Date().toISOString() });
  },
});

export const listActiveSessions = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user?.orgId) return [];
    const orgId = user.orgId;
    const sessions = await ctx.db
      .query("liveSessions")
      .withIndex("by_org_and_status", (q) => q.eq("orgId", orgId).eq("status", "live"))
      .order("desc")
      .take(30);
    const visible: Doc<"liveSessions">[] = [];
    for (const s of sessions) {
      if (await canAccessSession(ctx, user, s)) visible.push(s);
    }
    return await Promise.all(
      visible.map(async (s) => {
        const host = await ctx.db.get(s.hostId);
        const course = s.courseId ? await ctx.db.get(s.courseId) : null;
        const program = s.programId ? await ctx.db.get(s.programId) : null;
        return {
          ...s,
          hostName: host?.name ?? "Host",
          isHost: s.hostId === user._id,
          audience: course ? course.title : program ? program.name : "Everyone",
        };
      }),
    );
  },
});

export const getSession = query({
  args: { sessionId: v.id("liveSessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    const session = await ctx.db.get(args.sessionId);
    if (!user || !session || !(await canAccessSession(ctx, user, session))) return null;
    const host = await ctx.db.get(session.hostId);
    const canEnd = session.hostId === user._id || user.role === "admin" || user.role === "superadmin";
    // Only admins and lecturers may record
    const canRecord = !!user.role && HOST_ROLES.includes(user.role);
    return { ...session, hostName: host?.name ?? "Host", canEnd, canRecord };
  },
});

export const join = mutation({
  args: { sessionId: v.id("liveSessions"), peerId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const session = await requireSessionAccess(ctx, user, args.sessionId);
    if (session.status !== "live") {
      throw new ConvexError({ message: "This class has ended", code: "BAD_REQUEST" });
    }
    // One connection per account: drop any older tab of the same user
    const existing = await ctx.db
      .query("liveParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .take(100);
    for (const p of existing) {
      if (p.userId === user._id) await ctx.db.delete(p._id);
    }
    const now = Date.now();
    await ctx.db.insert("liveParticipants", {
      sessionId: args.sessionId,
      userId: user._id,
      peerId: args.peerId,
      name: user.name ?? "Guest",
      joinedAt: now,
      lastSeen: now,
    });
  },
});

export const leave = mutation({
  args: { sessionId: v.id("liveSessions"), peerId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const p = await ctx.db
      .query("liveParticipants")
      .withIndex("by_session_and_peer", (q) => q.eq("sessionId", args.sessionId).eq("peerId", args.peerId))
      .first();
    if (p && p.userId === user._id) await ctx.db.delete(p._id);
  },
});

export const heartbeat = mutation({
  args: { sessionId: v.id("liveSessions"), peerId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const p = await requireOwnPeer(ctx, user, args.sessionId, args.peerId);
    await ctx.db.patch(p._id, { lastSeen: Date.now() });
  },
});

export const listParticipants = query({
  args: { sessionId: v.id("liveSessions"), peerId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) return [];
    const me = await ctx.db
      .query("liveParticipants")
      .withIndex("by_session_and_peer", (q) => q.eq("sessionId", args.sessionId).eq("peerId", args.peerId))
      .first();
    if (!me || me.userId !== user._id) return [];
    const all = await ctx.db
      .query("liveParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .take(50);
    // Client clocks drive staleness; keep rows whose heartbeat is recent relative to the newest one
    const newest = Math.max(...all.map((p) => p.lastSeen));
    return all
      .filter((p) => newest - p.lastSeen < STALE_MS)
      .map((p) => ({ peerId: p.peerId, name: p.name, joinedAt: p.joinedAt }));
  },
});

export const sendSignal = mutation({
  args: {
    sessionId: v.id("liveSessions"),
    fromPeer: v.string(),
    toPeer: v.string(),
    kind: v.union(v.literal("offer"), v.literal("answer"), v.literal("candidate")),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwnPeer(ctx, user, args.sessionId, args.fromPeer);
    await ctx.db.insert("liveSignals", {
      sessionId: args.sessionId,
      fromPeer: args.fromPeer,
      toPeer: args.toPeer,
      kind: args.kind,
      payload: args.payload,
    });
  },
});

export const mySignals = query({
  args: { sessionId: v.id("liveSessions"), peerId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) return [];
    const me = await ctx.db
      .query("liveParticipants")
      .withIndex("by_session_and_peer", (q) => q.eq("sessionId", args.sessionId).eq("peerId", args.peerId))
      .first();
    if (!me || me.userId !== user._id) return [];
    return await ctx.db
      .query("liveSignals")
      .withIndex("by_session_and_to", (q) => q.eq("sessionId", args.sessionId).eq("toPeer", args.peerId))
      .take(100);
  },
});

export const consumeSignals = mutation({
  args: {
    sessionId: v.id("liveSessions"),
    peerId: v.string(),
    ids: v.array(v.id("liveSignals")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwnPeer(ctx, user, args.sessionId, args.peerId);
    for (const id of args.ids) {
      const s = await ctx.db.get(id);
      if (s && s.toPeer === args.peerId) await ctx.db.delete(id);
    }
  },
});

export const setRecording = mutation({
  args: { sessionId: v.id("liveSessions"), isRecording: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const session = await requireSessionAccess(ctx, user, args.sessionId);
    if (!user.role || !HOST_ROLES.includes(user.role)) {
      throw new ConvexError({ message: "Only admins and lecturers can record", code: "FORBIDDEN" });
    }
    await ctx.db.patch(session._id, { isRecording: args.isRecording });
  },
});

// ── Chat ─────────────────────────────────────────────────────────────────────

export const sendMessage = mutation({
  args: {
    sessionId: v.id("liveSessions"),
    body: v.string(),
    // Set for private messages: student -> host, or host -> student (reply)
    recipientId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const session = await requireSessionAccess(ctx, user, args.sessionId);
    const body = args.body.trim();
    if (!body || body.length > 1000) {
      throw new ConvexError({ message: "Message must be 1-1000 characters", code: "BAD_REQUEST" });
    }
    const isStaff = !!user.role && HOST_ROLES.includes(user.role);
    if (args.recipientId) {
      // Students may only message the host; staff may reply to anyone in the class
      if (!isStaff && args.recipientId !== session.hostId) {
        throw new ConvexError({ message: "You can only message the host privately", code: "FORBIDDEN" });
      }
    }
    await ctx.db.insert("liveMessages", {
      sessionId: args.sessionId,
      senderId: user._id,
      senderName: user.name ?? "Guest",
      recipientId: args.recipientId,
      body,
      createdAt: new Date().toISOString(),
    });
  },
});

export const listMessages = query({
  args: { sessionId: v.id("liveSessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    const session = await ctx.db.get(args.sessionId);
    if (!user || !session || !(await canAccessSession(ctx, user, session))) return [];
    const recent = await ctx.db
      .query("liveMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(200);
    // Private messages are only visible to the sender and the recipient
    return recent
      .filter((m) => !m.recipientId || m.senderId === user._id || m.recipientId === user._id)
      .reverse()
      .map((m) => ({
        _id: m._id,
        senderId: m.senderId,
        senderName: m.senderName,
        recipientId: m.recipientId,
        body: m.body,
        createdAt: m.createdAt,
        mine: m.senderId === user._id,
      }));
  },
});
