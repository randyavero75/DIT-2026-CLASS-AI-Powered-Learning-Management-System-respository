import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate upload URL for course material
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    return await ctx.storage.generateUploadUrl();
  },
});

// Save a file material after upload
export const saveMaterial = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.string(),
    description: v.optional(v.string()),
    fileStorageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    const isAdminRole = user.role === "admin" || user.role === "superadmin";
    const isLecturer = user.role === "lecturer";
    if (!isAdminRole && !isLecturer) {
      throw new ConvexError({ message: "Only lecturers and admins can upload materials", code: "FORBIDDEN" });
    }
    // For lecturers, verify they are assigned to the course's program or are the course creator
    if (isLecturer) {
      const course = await ctx.db.get(args.courseId);
      if (!course) throw new ConvexError({ message: "Course not found", code: "NOT_FOUND" });
      const isCreator = course.lecturerId.toString() === user._id.toString();
      if (!isCreator && course.programCategoryId) {
        const assignment = await ctx.db
          .query("programLecturers")
          .withIndex("by_program_and_lecturer", (q) =>
            q.eq("programId", course.programCategoryId!).eq("lecturerId", user._id)
          )
          .unique();
        if (!assignment) {
          throw new ConvexError({ message: "You are not assigned to this course's program", code: "FORBIDDEN" });
        }
      }
    }

    return await ctx.db.insert("courseMaterials", {
      courseId: args.courseId,
      uploadedBy: user._id,
      title: args.title,
      description: args.description,
      type: "file",
      fileStorageId: args.fileStorageId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      createdAt: new Date().toISOString(),
    });
  },
});

// Save a link or video material (no file upload needed)
export const saveLinkMaterial = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.string(),
    description: v.optional(v.string()),
    type: v.union(v.literal("link"), v.literal("video")),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    const isAdminRole2 = user.role === "admin" || user.role === "superadmin";
    const isLecturer2 = user.role === "lecturer";
    if (!isAdminRole2 && !isLecturer2) {
      throw new ConvexError({ message: "Only lecturers and admins can add materials", code: "FORBIDDEN" });
    }

    // Verify the course exists and belongs to the same org
    const course = await ctx.db.get(args.courseId);
    if (!course) throw new ConvexError({ message: "Course not found", code: "NOT_FOUND" });

    // For lecturers, verify they are assigned to the course's program or are the course creator
    if (isLecturer2) {
      const isCreator = course.lecturerId.toString() === user._id.toString();
      if (!isCreator && course.programCategoryId) {
        const assignment = await ctx.db
          .query("programLecturers")
          .withIndex("by_program_and_lecturer", (q) =>
            q.eq("programId", course.programCategoryId!).eq("lecturerId", user._id)
          )
          .unique();
        if (!assignment) {
          throw new ConvexError({ message: "You are not assigned to this course's program", code: "FORBIDDEN" });
        }
      }
    }

    return await ctx.db.insert("courseMaterials", {
      courseId: args.courseId,
      uploadedBy: user._id,
      title: args.title,
      description: args.description,
      type: args.type,
      url: args.url,
      createdAt: new Date().toISOString(),
    });
  },
});

// Get materials for a course — enrolled students, lecturers, and admins can access
export const getMaterials = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) return [];

    // Verify this user has access: admin/lecturer always can, students must be enrolled
    const isAdminOrLecturer =
      user.role === "admin" || user.role === "superadmin" || user.role === "lecturer";
    if (!isAdminOrLecturer) {
      const enrollment = await ctx.db
        .query("enrollments")
        .withIndex("by_student_and_course", (q) =>
          q.eq("studentId", user._id).eq("courseId", args.courseId)
        )
        .unique();
      if (!enrollment) return []; // Not enrolled, no access
    }

    const materials = await ctx.db
      .query("courseMaterials")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .order("desc")
      .collect();

    return await Promise.all(
      materials.map(async (m) => {
        let url: string | null = null;
        if (m.type === "file" || (!m.type && m.fileStorageId)) {
          // file type — get from Convex storage
          url = m.fileStorageId ? await ctx.storage.getUrl(m.fileStorageId) : null;
        } else {
          // link/video type — url is stored directly
          url = m.url ?? null;
        }
        return { ...m, url };
      })
    );
  },
});

// Delete material (uploader, admin, or lecturer)
export const deleteMaterial = mutation({
  args: { materialId: v.id("courseMaterials") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    const mat = await ctx.db.get(args.materialId);
    if (!mat) throw new ConvexError({ message: "Material not found", code: "NOT_FOUND" });
    const isUploader = mat.uploadedBy === user?._id;
    const isAdmin = user?.role === "admin" || user?.role === "superadmin";
    if (!isUploader && !isAdmin) {
      throw new ConvexError({ message: "Not authorized", code: "FORBIDDEN" });
    }
    // Delete file from storage if applicable
    if (mat.fileStorageId) {
      await ctx.storage.delete(mat.fileStorageId);
    }
    await ctx.db.delete(args.materialId);
  },
});
