import { v, ConvexError } from "convex/values";
import { nextStudentId } from "./lib/studentId.ts";
import { mutation, query } from "./_generated/server";

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Create org ────────────────────────────────────────────────────────────────

export const createOrganization = mutation({
  args: {
    name: v.string(),
    type: v.union(
      v.literal("university"), v.literal("school"), v.literal("senior_high_school"),
      v.literal("junior_high_school"), v.literal("bible_school"), v.literal("polytechnic"),
      v.literal("technical"), v.literal("nursing"), v.literal("vocational"),
      v.literal("business"), v.literal("other")
    ),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    // Generate a unique slug
    const baseSlug = generateSlug(args.name);
    let slug = baseSlug;
    let suffix = 2;
    while (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique()) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const inviteCode = generateInviteCode();
    const orgId = await ctx.db.insert("organizations", {
      name: args.name,
      slug,
      type: args.type,
      description: args.description,
      website: args.website,
      inviteCode,
      createdAt: new Date().toISOString(),
    });

    // Make the creator an admin of this org
    await ctx.db.patch(user._id, { orgId, role: "admin", lecturerApproved: false });

    // Also record in orgMemberships so multi-org switching works for the creator
    await ctx.db.insert("orgMemberships", {
      userId: user._id,
      orgId,
      role: "admin",
      joinedAt: new Date().toISOString(),
    });

    return { orgId, slug, inviteCode };
  },
});

// ── Join org via invite code ──────────────────────────────────────────────────
// Submits a pending invite request — admin must approve before access is granted.

export const joinOrganization = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", args.inviteCode.toUpperCase()))
      .unique();
    if (!org) throw new ConvexError({ message: "Invalid invite code", code: "NOT_FOUND" });

    // Prevent joining if already an active member of this org
    if (user.orgId?.toString() === org._id.toString()) {
      throw new ConvexError({ message: "You are already a member of this organization", code: "CONFLICT" });
    }
    const existingMembership = await ctx.db
      .query("orgMemberships")
      .withIndex("by_user_and_org", (q) => q.eq("userId", user._id).eq("orgId", org._id))
      .first();
    if (existingMembership) {
      throw new ConvexError({ message: "You are already a member of this organization", code: "CONFLICT" });
    }

    // Check for an existing pending request for this org
    const existing = await ctx.db
      .query("orgInviteRequests")
      .withIndex("by_user_and_org", (q) => q.eq("userId", user._id).eq("orgId", org._id))
      .first();
    if (existing && existing.status === "pending") {
      throw new ConvexError({ message: "You already have a pending request for this organization", code: "CONFLICT" });
    }
    // Remove stale rejected/approved entries before re-submitting
    if (existing) {
      const allPrev = await ctx.db
        .query("orgInviteRequests")
        .withIndex("by_user_and_org", (q) => q.eq("userId", user._id).eq("orgId", org._id))
        .collect();
      for (const r of allPrev) await ctx.db.delete(r._id);
    }

    // Submit pending request — access granted only after admin approval
    await ctx.db.insert("orgInviteRequests", {
      userId: user._id,
      orgId: org._id,
      message: "Joined via invite code",
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    return { orgId: org._id, orgName: org.name, pending: true };
  },
});

// ── Get my org ────────────────────────────────────────────────────────────────

export const getMyOrganization = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user?.orgId) return null;
    return await ctx.db.get(user.orgId);
  },
});

// ── Get org by slug ───────────────────────────────────────────────────────────

export const getOrganizationBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", args.slug)).unique();
  },
});

// ── Superadmin: list all orgs with member stats ───────────────────────────────

export const getAllOrganizations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || user.role !== "superadmin") return [];

    const orgs = await ctx.db.query("organizations").collect();

    return await Promise.all(
      orgs.map(async (org) => {
        const members = await ctx.db
          .query("users")
          .withIndex("by_org", (q) => q.eq("orgId", org._id))
          .collect();
        const admins = members.filter((m) => m.role === "admin");
        return {
          ...org,
          memberCount: members.length,
          adminCount: admins.length,
          admins: admins.map((a) => ({ _id: a._id, name: a.name, email: a.email })),
          // Superadmin's own org flag
          isSuperadminOrg: user.orgId?.toString() === org._id.toString(),
        };
      })
    );
  },
});

// ── Superadmin: get members of any org ────────────────────────────────────────

export const getOrgMembersById = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || user.role !== "superadmin") return [];
    return await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

// ── Superadmin: activate / deactivate org ─────────────────────────────────────

export const setOrgActive = mutation({
  args: { orgId: v.id("organizations"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || user.role !== "superadmin") {
      throw new ConvexError({ message: "Only superadmin can activate/deactivate institutions", code: "FORBIDDEN" });
    }
    await ctx.db.patch(args.orgId, { isActive: args.isActive });
  },
});

// ── Superadmin: assign role to any user ───────────────────────────────────────

export const superadminSetUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("lecturer"), v.literal("student")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const me = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!me || me.role !== "superadmin") {
      throw new ConvexError({ message: "Only superadmin can assign roles", code: "FORBIDDEN" });
    }
    await ctx.db.patch(args.userId, {
      role: args.role,
      lecturerApproved: args.role === "lecturer",
    });
  },
});

// ── Org admin: get org members (all users currently in this org) ─────────────

export const getOrgMembers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || !user.orgId || (user.role !== "admin" && user.role !== "superadmin")) return [];

    // Primary org members (users whose orgId = this org)
    const primary = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", user.orgId))
      .collect();

    // Also include users from orgMemberships for this org (multi-org members)
    const memberships = await ctx.db
      .query("orgMemberships")
      .withIndex("by_org", (q) => q.eq("orgId", user.orgId!))
      .collect();

    const primaryIds = new Set(primary.map((u) => u._id.toString()));
    const extra: typeof primary = [];
    for (const m of memberships) {
      if (!primaryIds.has(m.userId.toString())) {
        const u = await ctx.db.get(m.userId);
        if (u) extra.push(u);
      }
    }

    return [...primary, ...extra];
  },
});

// ── Org admin: update member role ─────────────────────────────────────────────

export const updateMemberRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("lecturer"), v.literal("student")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!admin || (admin.role !== "admin" && admin.role !== "superadmin")) {
      throw new ConvexError({ message: "Only admins can change roles", code: "FORBIDDEN" });
    }

    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    if (!admin.orgId) throw new ConvexError({ message: "No org found", code: "BAD_REQUEST" });
    const adminOrgId = admin.orgId;

    // Org-scoped check: the target must belong to this org (primary or via membership)
    const targetMemberships = await ctx.db
      .query("orgMemberships")
      .withIndex("by_user_and_org", (q) => q.eq("userId", args.userId).eq("orgId", adminOrgId))
      .collect();
    const inOrg = target.orgId?.toString() === adminOrgId.toString() || targetMemberships.length > 0;
    if (admin.role === "admin" && !inOrg) {
      throw new ConvexError({ message: "Cannot modify users outside your org", code: "FORBIDDEN" });
    }

    // Keep the per-institution membership in sync (lecturer lists read from it)
    if (targetMemberships.length > 0) {
      for (const m of targetMemberships) await ctx.db.patch(m._id, { role: args.role });
    } else {
      await ctx.db.insert("orgMemberships", {
        userId: args.userId,
        orgId: adminOrgId,
        role: args.role,
        joinedAt: new Date().toISOString(),
      });
    }

    // Only change the live role if this is the institution they are currently in
    if (target.orgId?.toString() === adminOrgId.toString()) {
      await ctx.db.patch(args.userId, {
        role: args.role,
        lecturerApproved: args.role === "lecturer",
      });
    }
  },
});

// ── Org admin: remove member ──────────────────────────────────────────────────

export const removeMember = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!admin || (admin.role !== "admin" && admin.role !== "superadmin")) {
      throw new ConvexError({ message: "Only admins can remove members", code: "FORBIDDEN" });
    }

    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    // Remove the user from orgMemberships table for this org too
    if (admin.orgId) {
      const memberships = await ctx.db
        .query("orgMemberships")
        .withIndex("by_user_and_org", (q) => q.eq("userId", args.userId).eq("orgId", admin.orgId!))
        .collect();
      for (const m of memberships) await ctx.db.delete(m._id);

      // Delete any existing invite requests for this org so the user can rejoin fresh
      const oldRequests = await ctx.db
        .query("orgInviteRequests")
        .withIndex("by_user_and_org", (q) => q.eq("userId", args.userId).eq("orgId", admin.orgId!))
        .collect();
      for (const r of oldRequests) await ctx.db.delete(r._id);

      // Drop course enrollments and program requests tied to this institution
      const orgId = admin.orgId;
      const enrollments = await ctx.db
        .query("enrollments")
        .withIndex("by_student", (q) => q.eq("studentId", args.userId))
        .take(500);
      for (const e of enrollments) {
        const course = await ctx.db.get(e.courseId);
        if (course?.orgId === orgId) await ctx.db.delete(e._id);
      }
      const programReqs = await ctx.db
        .query("programEnrollmentRequests")
        .withIndex("by_student", (q) => q.eq("studentId", args.userId))
        .take(200);
      for (const r of programReqs) {
        if (r.orgId === orgId) await ctx.db.delete(r._id);
      }
    }

    // Re-fetch target after deletions to get fresh state
    const freshTarget = await ctx.db.get(args.userId);
    if (!freshTarget) return;

    const removingOrgId = admin.orgId;

    if (freshTarget.orgId?.toString() !== removingOrgId?.toString()) {
      // Primary org is elsewhere: keep it, but drop any stale pointer to the removed org
      if (freshTarget.activeOrgId?.toString() === removingOrgId?.toString()) {
        await ctx.db.patch(args.userId, { activeOrgId: freshTarget.orgId });
      }
      return;
    }

    // This IS the user's primary org — try to switch them to another org they belong to
    const otherMemberships = await ctx.db
      .query("orgMemberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const fallback = otherMemberships.find(
      (m) => m.orgId.toString() !== removingOrgId?.toString()
    );

    if (fallback) {
      // Switch user to the other org
      await ctx.db.patch(args.userId, {
        orgId: fallback.orgId,
        activeOrgId: fallback.orgId,
        role: fallback.role as "admin" | "lecturer" | "student" | "superadmin",
        indexNumber: fallback.indexNumber,
        enrolledProgramId: undefined,
        level: undefined,
      });
    } else {
      // No other memberships — fully clear
      await ctx.db.patch(args.userId, {
        orgId: undefined,
        activeOrgId: undefined,
        role: "student",
        indexNumber: undefined,
        level: undefined,
        enrolledProgramId: undefined,
      });
    }
  },
});

// ── Update org settings ───────────────────────────────────────────────────────

export const updateOrganization = mutation({
  args: {
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    type: v.optional(v.union(
      v.literal("university"), v.literal("school"), v.literal("senior_high_school"),
      v.literal("junior_high_school"), v.literal("bible_school"), v.literal("polytechnic"),
      v.literal("technical"), v.literal("nursing"), v.literal("vocational"),
      v.literal("business"), v.literal("other")
    )),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || !user.orgId || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError({ message: "Only org admins can update settings", code: "FORBIDDEN" });
    }
    type OrgType = "university" | "school" | "senior_high_school" | "junior_high_school" | "bible_school" | "polytechnic" | "technical" | "nursing" | "vocational" | "business" | "other";
    const updates: Partial<{ name: string; description: string; website: string; logoUrl: string; type: OrgType }> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.website !== undefined) updates.website = args.website;
    if (args.logoUrl !== undefined) updates.logoUrl = args.logoUrl;
    if (args.type !== undefined) updates.type = args.type;
    await ctx.db.patch(user.orgId, updates);
  },
});

// ── Generate upload URL for org logo ─────────────────────────────────────────

export const generateLogoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveLogoStorageId = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || !user.orgId || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError({ message: "Only org admins can update logo", code: "FORBIDDEN" });
    }
    const logoUrl = await ctx.storage.getUrl(args.storageId);
    if (!logoUrl) throw new ConvexError({ message: "Could not get logo URL", code: "NOT_FOUND" });
    await ctx.db.patch(user.orgId, { logoUrl });
    return logoUrl;
  },
});

// ── Regenerate invite code ────────────────────────────────────────────────────

export const regenerateInviteCode = mutation({
  args: { customCode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || !user.orgId || user.role !== "admin") {
      throw new ConvexError({ message: "Only org admins can regenerate the code", code: "FORBIDDEN" });
    }
    let newCode: string;
    if (args.customCode !== undefined) {
      newCode = args.customCode.trim().toUpperCase();
      if (!/^[A-Z0-9]{4,12}$/.test(newCode)) {
        throw new ConvexError({ message: "Code must be 4-12 letters or numbers", code: "BAD_REQUEST" });
      }
    } else {
      newCode = generateInviteCode();
    }
    // Codes must be unique across institutions
    const taken = await ctx.db
      .query("organizations")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", newCode))
      .first();
    if (taken && taken._id !== user.orgId) {
      throw new ConvexError({ message: "That code is already in use", code: "CONFLICT" });
    }
    await ctx.db.patch(user.orgId, { inviteCode: newCode });
    return newCode;
  },
});

// ── Org admin: save theme ─────────────────────────────────────────────────────

export const updateOrgTheme = mutation({
  args: { theme: v.string() }, // JSON string of CSS variable overrides
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || !user.orgId || user.role !== "admin") {
      throw new ConvexError({ message: "Only org admins can change the theme", code: "FORBIDDEN" });
    }
    await ctx.db.patch(user.orgId, { theme: args.theme });
  },
});

// ── Multi-org: get all my memberships ─────────────────────────────────────────

export const getMyMemberships = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) return [];

    // Collect all orgs from orgMemberships table
    const memberships = await ctx.db
      .query("orgMemberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const membershipOrgIds = new Set(memberships.map((m) => m.orgId.toString()));

    const result: { orgId: string; orgName: string; orgType?: string; orgIsActive: boolean; role: string; joinedAt: string }[] = [];

    // Add all orgs from memberships table
    const listed = new Set<string>();
    for (const m of memberships) {
      if (listed.has(m.orgId.toString())) continue;
      listed.add(m.orgId.toString());
      const org = await ctx.db.get(m.orgId);
      if (org) {
        result.push({
          orgId: m.orgId,
          orgName: org.name,
          orgType: org.type,
          orgIsActive: org.isActive !== false,
          role: m.role,
          joinedAt: m.joinedAt,
        });
      }
    }

    // Also include the primary org if not already in memberships
    if (user.orgId && !membershipOrgIds.has(user.orgId.toString())) {
      const primaryOrg = await ctx.db.get(user.orgId);
      if (primaryOrg) {
        result.unshift({
          orgId: user.orgId,
          orgName: primaryOrg.name,
          orgType: primaryOrg.type,
          orgIsActive: primaryOrg.isActive !== false,
          role: user.role ?? "student",
          joinedAt: "",
        });
      }
    }

    return result;
  },
});

// ── Multi-org: switch active org ─────────────────────────────────────────────

export const switchActiveOrg = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    // Verify they're a member of the target org (via primary orgId or orgMemberships)
    const isPrimary = user.orgId?.toString() === args.orgId.toString();
    // .first() so a duplicate row can never make switching fail
    const membership = await ctx.db
      .query("orgMemberships")
      .withIndex("by_user_and_org", (q) => q.eq("userId", user._id).eq("orgId", args.orgId))
      .first();

    if (!isPrimary && !membership) {
      throw new ConvexError({ message: "You are not a member of this organization", code: "FORBIDDEN" });
    }

    // Before switching, ensure the current org is saved in orgMemberships so we can come back
    if (user.orgId && user.orgId.toString() !== args.orgId.toString()) {
      const currentMembership = await ctx.db
        .query("orgMemberships")
        .withIndex("by_user_and_org", (q) => q.eq("userId", user._id).eq("orgId", user.orgId!))
        .first();
      if (!currentMembership) {
        await ctx.db.insert("orgMemberships", {
          userId: user._id,
          orgId: user.orgId,
          role: user.role as "admin" | "lecturer" | "student",
          joinedAt: new Date().toISOString(),
        });
      }
    }

    // Determine the role in the target org
    const targetRole = membership?.role ?? user.role ?? "student";

    // Update both orgId (active context) and activeOrgId, and role to match target org.
    // The student ID is per institution, so swap it along with the context.
    await ctx.db.patch(user._id, {
      orgId: args.orgId,
      activeOrgId: args.orgId,
      role: targetRole as "admin" | "lecturer" | "student" | "superadmin",
      indexNumber: membership?.indexNumber ?? (isPrimary ? user.indexNumber : undefined),
      enrolledProgramId: undefined,
      lecturerApproved: targetRole === "lecturer" ? true : user.lecturerApproved,
    });
    return { orgId: args.orgId };
  },
});

export const setSemesterMode = mutation({
  args: {
    semesterMode: v.union(v.literal("two_semester"), v.literal("one_term")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError({ message: "Only admins can change semester mode", code: "FORBIDDEN" });
    }
    if (!user.orgId) throw new ConvexError({ message: "No org found", code: "BAD_REQUEST" });
    await ctx.db.patch(user.orgId, { semesterMode: args.semesterMode });
  },
});

export const listPublicOrganizations = query({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();
    return orgs.filter((o) => o.isActive !== false && o.name !== "KNUST");
  },
});

// Check if current user is a member of a specific org (for institutions page)
export const getMyOrgMembership = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) return null;

    // Check if this is their primary org
    if (user.orgId?.toString() === args.orgId.toString()) {
      return { isMember: true, role: user.role ?? "student", isActive: true };
    }

    // Check orgMemberships table
    const membership = await ctx.db
      .query("orgMemberships")
      .withIndex("by_user_and_org", (q) => q.eq("userId", user._id).eq("orgId", args.orgId))
      .first();

    if (membership) {
      return { isMember: true, role: membership.role, isActive: false };
    }

    return null;
  },
});

// ── Org admin: give every student a unique ID (repairs older duplicates) ──────
export const fixDuplicateStudentIds = mutation({
  args: {},
  handler: async (ctx): Promise<{ fixed: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!admin?.orgId || (admin.role !== "admin" && admin.role !== "superadmin")) {
      throw new ConvexError({ message: "Only admins can do this", code: "FORBIDDEN" });
    }
    const orgId = admin.orgId;
    const members = await ctx.db.query("orgMemberships").withIndex("by_org", (q) => q.eq("orgId", orgId)).take(5000);
    const students = members.filter((m) => m.role === "student");
    const seen = new Set<string>();
    let fixed = 0;
    for (const m of students) {
      const user = await ctx.db.get(m.userId);
      const current = m.indexNumber ?? (user?.orgId?.toString() === orgId.toString() ? user?.indexNumber : undefined);
      if (current && !seen.has(current)) {
        seen.add(current);
        if (m.indexNumber !== current) await ctx.db.patch(m._id, { indexNumber: current });
        continue;
      }
      const fresh = await nextStudentId(ctx, orgId);
      seen.add(fresh);
      await ctx.db.patch(m._id, { indexNumber: fresh });
      if (user && user.orgId?.toString() === orgId.toString()) await ctx.db.patch(user._id, { indexNumber: fresh });
      fixed++;
    }
    return { fixed };
  },
});
