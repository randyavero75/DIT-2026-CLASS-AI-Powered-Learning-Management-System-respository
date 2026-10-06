import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel.d.ts";

const seqOf = (indexNumber?: string): number => {
  const n = parseInt(indexNumber?.split("/").pop() ?? "", 10);
  return Number.isNaN(n) ? 0 : n;
};

// Issues the next student ID for an institution. A per-org counter only ever
// goes up, so IDs stay unique even after members are removed.
export async function nextStudentId(ctx: MutationCtx, orgId: Id<"organizations">): Promise<string> {
  const org = await ctx.db.get(orgId);
  if (!org) throw new ConvexError({ message: "Organization not found", code: "NOT_FOUND" });

  let seq = org.studentSeq;
  if (seq === undefined) {
    // First use: start after the highest number already handed out
    const users = await ctx.db.query("users").withIndex("by_org", (q) => q.eq("orgId", orgId)).take(5000);
    const members = await ctx.db.query("orgMemberships").withIndex("by_org", (q) => q.eq("orgId", orgId)).take(5000);
    seq = Math.max(0, ...users.map((u) => seqOf(u.indexNumber)), ...members.map((m) => seqOf(m.indexNumber)));
  }
  const next = seq + 1;
  await ctx.db.patch(orgId, { studentSeq: next });

  // Full slug (unique per org) keeps IDs distinct across institutions too
  const prefix = org.slug.toUpperCase().replace(/[^A-Z0-9]/g, "") || "ORG";
  return `${prefix}/${new Date().getFullYear()}/${String(next).padStart(4, "0")}`;
}
