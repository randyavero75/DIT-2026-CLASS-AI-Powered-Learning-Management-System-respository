import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  ShieldCheck,
  GraduationCap,
  BookOpen,
  Users,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  UserPlus,
  UserMinus,
  Eye,
  PowerOff,
  Power,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";

const ROLE_BADGE: Record<string, string> = {
  superadmin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  admin: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  lecturer: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  student: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

// ── Org Members Modal ─────────────────────────────────────────────────────────

function OrgMembersModal({
  org,
  onClose,
}: {
  org: { _id: Id<"organizations">; name: string };
  onClose: () => void;
}) {
  const members = useQuery(api.organizations.getOrgMembersById, { orgId: org._id });
  const setRole = useMutation(api.organizations.superadminSetUserRole);

  const handleRoleChange = async (userId: Id<"users">, role: "admin" | "lecturer" | "student") => {
    try {
      await setRole({ userId, role });
      toast.success("Role updated");
    } catch {
      toast.error("Failed to update role");
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Members of {org.name}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {members === undefined ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-8">No members yet.</p>
          ) : (
            members.map((member) => (
              <div key={member._id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                <Avatar className="w-9 h-9 flex-shrink-0">
                  <AvatarImage src={member.avatar} />
                  <AvatarFallback>{member.name?.charAt(0) ?? "U"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{member.name ?? "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground truncate">{member.email ?? "—"}</p>
                  {member.role === "student" && (member as typeof member & { indexNumber?: string }).indexNumber && (
                    <p className="text-[10px] text-primary font-mono mt-0.5">
                      Index: {(member as typeof member & { indexNumber?: string }).indexNumber}
                    </p>
                  )}
                </div>
                <Badge className={`text-xs capitalize flex-shrink-0 ${ROLE_BADGE[member.role ?? "student"]}`}>
                  {member.role ?? "student"}
                </Badge>
                {member.role !== "superadmin" && (
                  <Select
                    value={member.role ?? "student"}
                    onValueChange={(v) => handleRoleChange(member._id, v as "admin" | "lecturer" | "student")}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="lecturer">Lecturer</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Org Row ────────────────────────────────────────────────────────────────────

type OrgWithStats = Doc<"organizations"> & {
  memberCount: number;
  adminCount: number;
  admins: { _id: Id<"users">; name?: string; email?: string }[];
};

function OrgRow({ org }: { org: OrgWithStats }) {
  const setActive = useMutation(api.organizations.setOrgActive);
  const [viewMembers, setViewMembers] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isActive = org.isActive !== false; // default true if undefined

  const handleToggleActive = async () => {
    try {
      await setActive({ orgId: org._id, isActive: !isActive });
      toast.success(isActive ? `${org.name} deactivated` : `${org.name} activated`);
    } catch {
      toast.error("Failed to update institution status");
    }
  };

  return (
    <>
      <div className={`rounded-xl border border-border bg-card p-4 space-y-3 transition-opacity ${!isActive ? "opacity-60" : ""}`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm">{org.name}</p>
              <Badge className={isActive
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs"
              }>
                {isActive ? "Active" : "Deactivated"}
              </Badge>
              {org.type && (
                <Badge variant="secondary" className="text-xs capitalize">{org.type}</Badge>
              )}
              {org.plan && org.plan !== "free" && (
                <Badge className="bg-primary/10 text-primary text-xs capitalize">{org.plan}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {org.memberCount} member{org.memberCount !== 1 ? "s" : ""} · {org.adminCount} admin{org.adminCount !== 1 ? "s" : ""}
              {org.description && ` · ${org.description}`}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
            <Button
              size="sm"
              variant="secondary"
              className="h-8 text-xs cursor-pointer gap-1"
              onClick={() => setViewMembers(true)}
            >
              <Eye className="w-3.5 h-3.5" /> Members
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className={`h-8 text-xs cursor-pointer gap-1 ${isActive ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-600"}`}
              onClick={handleToggleActive}
            >
              {isActive ? <><PowerOff className="w-3.5 h-3.5" /> Deactivate</> : <><Power className="w-3.5 h-3.5" /> Activate</>}
            </Button>
            {org.admins.length > 0 && (
              <Button size="sm" variant="ghost" className="h-8 text-xs cursor-pointer gap-1" onClick={() => setExpanded(e => !e)}>
                Admins {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            )}
          </div>
        </div>

        {/* Admin list */}
        {expanded && org.admins.length > 0 && (
          <div className="pt-2 border-t border-border space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Org Admins</p>
            {org.admins.map((a) => (
              <div key={a._id} className="flex items-center gap-2 text-sm">
                <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs font-bold text-amber-700">
                  {a.name?.charAt(0) ?? "A"}
                </div>
                <span className="font-medium">{a.name ?? "Admin"}</span>
                <span className="text-xs text-muted-foreground">{a.email}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewMembers && (
        <OrgMembersModal org={org} onClose={() => setViewMembers(false)} />
      )}
    </>
  );
}

// ── Pending course access requests (org-scoped for superadmin) ─────────────────

function AdminPageInner() {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const allUsers = useQuery(api.users.getAllUsers, {});
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "superadmin";
  const isSuperadmin = currentUser?.role === "superadmin";
  const allOrgs = useQuery(api.organizations.getAllOrganizations, isSuperadmin ? {} : "skip");
  const allCourses = useQuery(api.courses.getAllCoursesForLecturer, isAdmin ? {} : "skip");
  const pendingRequests = useQuery(api.courseRequests.getPendingRequests, isAdmin ? {} : "skip");
  const reviewRequest = useMutation(api.courseRequests.reviewRequest);

  const handleReview = async (
    requestId: Parameters<typeof reviewRequest>[0]["requestId"],
    decision: "approved" | "rejected",
    studentName: string,
    courseTitle: string
  ) => {
    try {
      await reviewRequest({ requestId, decision });
      toast.success(
        decision === "approved"
          ? `${studentName} approved for "${courseTitle}"`
          : `${studentName}'s request rejected`
      );
    } catch {
      toast.error("Failed to process request");
    }
  };

  if (currentUser === undefined || allUsers === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
        <ShieldCheck className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className="text-muted-foreground">Only administrators can access this panel.</p>
      </div>
    );
  }

  const lecturers = allUsers.filter(u => u.role === "lecturer");
  const students = allUsers.filter(u => u.role === "student");
  const admins = allUsers.filter(u => u.role === "admin");

  // Filter out the placeholder KNUST org
  const realOrgs = (allOrgs ?? []).filter(o => o.name.toLowerCase() !== "knust") as (OrgWithStats & { isActive?: boolean })[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          {isSuperadmin ? "Platform Admin" : "Admin Panel"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isSuperadmin
            ? "Manage all institutions, members, and platform settings."
            : "Manage users, roles, and course enrollments."}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Institutions", value: isSuperadmin ? realOrgs.length : 1, icon: Building2, color: "text-purple-500", show: true },
          { label: "Admins", value: admins.length, icon: ShieldCheck, color: "text-amber-500", show: true },
          { label: "Lecturers", value: lecturers.length, icon: BookOpen, color: "text-primary", show: true },
          { label: "Students", value: students.length, icon: GraduationCap, color: "text-accent", show: true },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between pt-0">
              <span className="text-3xl font-bold">{value}</span>
              <Icon className={`w-7 h-7 ${color}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Institutions (superadmin only) */}
      {isSuperadmin && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">All Institutions</h2>
            <Badge variant="secondary">{realOrgs.length}</Badge>
          </div>
          {allOrgs === undefined ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : realOrgs.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No institutions registered yet.</p>
          ) : (
            <div className="space-y-3">
              {realOrgs.map(org => (
                <OrgRow key={org._id} org={org as OrgWithStats} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pending Access Requests */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold">Access Requests</h2>
          {pendingRequests && pendingRequests.length > 0 && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
              {pendingRequests.length} pending
            </Badge>
          )}
        </div>
        {pendingRequests === undefined ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : pendingRequests.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-border text-muted-foreground text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-green-500" />
            No pending access requests — you're all caught up!
          </div>
        ) : (
          <div className="space-y-2">
            {pendingRequests.map((req) => {
              const student = req.student;
              const course = req.course;
              if (!student || !course) return null;
              return (
                <div key={req._id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={student.avatar} />
                    <AvatarFallback>{student.name?.charAt(0) ?? "S"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{student.name ?? "Unknown Student"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Requesting access to <span className="font-medium text-foreground">{course.title}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(req.requestedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1 cursor-pointer bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleReview(req._id, "approved", student.name ?? "Student", course.title)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 text-xs gap-1 cursor-pointer text-destructive hover:text-destructive"
                      onClick={() => handleReview(req._id, "rejected", student.name ?? "Student", course.title)}
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Course Enrollment Management */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Course Enrollments</h2>
          <Badge variant="secondary">{allCourses?.length ?? 0}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Click a course to assign or remove students.</p>
        {allCourses === undefined ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : allCourses.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No courses yet.</p>
        ) : (
          <div className="space-y-2">
            {allCourses.map(course => (
              <CourseEnrollmentRow
                key={course._id}
                course={course as Doc<"courses">}
                allStudents={students as Doc<"users">[]}
              />
            ))}
          </div>
        )}
      </div>

      {/* All Users */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">
            {isSuperadmin ? "All Users (Platform)" : "Org Members"}
          </h2>
          <Badge variant="secondary">{allUsers.length}</Badge>
        </div>
        <div className="space-y-2">
          {allUsers.map(user => (
            <UserRow key={user._id} user={user} currentUserId={currentUser.tokenIdentifier} isSuperadmin={isSuperadmin} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── User row with role management ─────────────────────────────────────────────

function UserRow({ user, currentUserId, isSuperadmin }: { user: Doc<"users">; currentUserId: string; isSuperadmin: boolean }) {
  const updateRole = useMutation(api.users.updateUserRole);
  const isSelf = user.tokenIdentifier === currentUserId;

  const handleRoleChange = async (role: "admin" | "lecturer" | "student") => {
    try {
      await updateRole({ userId: user._id, role });
      toast.success(`Role updated to ${role}`);
    } catch {
      toast.error("Failed to update role");
    }
  };

  if (user.role === "superadmin" && isSelf) return null; // don't show superadmin's own row in members list

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
      <Avatar className="w-10 h-10 flex-shrink-0">
        <AvatarImage src={user.avatar} />
        <AvatarFallback>{user.name?.charAt(0) ?? "U"}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{user.name ?? "Unnamed User"}</p>
        <p className="text-xs text-muted-foreground truncate">{user.email ?? "—"}</p>
      </div>
      <Badge className={`text-xs capitalize ${ROLE_BADGE[user.role ?? "student"]}`}>
        {user.role ?? "student"}
      </Badge>
      {!isSelf && user.role !== "superadmin" && (
        <Select
          value={user.role ?? "student"}
          onValueChange={(v) => handleRoleChange(v as "admin" | "lecturer" | "student")}
        >
          <SelectTrigger className="h-8 w-32 text-xs cursor-pointer flex-shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {isSuperadmin && <SelectItem value="admin">Admin</SelectItem>}
            {!isSuperadmin && <SelectItem value="admin">Admin</SelectItem>}
            <SelectItem value="lecturer">Lecturer</SelectItem>
            <SelectItem value="student">Student</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// ── Course Enrollment Modal ───────────────────────────────────────────────────

function CourseEnrollmentModal({
  course,
  allStudents,
  onClose,
}: {
  course: Doc<"courses">;
  allStudents: Doc<"users">[];
  onClose: () => void;
}) {
  const enrollments = useQuery(api.courses.getCourseEnrollments, { courseId: course._id });
  const adminEnroll = useMutation(api.courses.adminEnrollStudent);
  const adminUnenroll = useMutation(api.courses.adminUnenrollStudent);

  const enrolledStudentIds = new Set(enrollments?.map((e) => e?._id) ?? []);
  const unenrolledStudents = allStudents.filter((s) => !enrolledStudentIds.has(s._id));

  const handleEnroll = async (studentId: Id<"users">, name: string) => {
    try {
      await adminEnroll({ courseId: course._id, studentId });
      toast.success(`${name} enrolled successfully`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to enroll");
    }
  };

  const handleUnenroll = async (studentId: Id<"users">, name: string) => {
    try {
      await adminUnenroll({ courseId: course._id, studentId });
      toast.success(`${name} removed from course`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-primary" />
            Manage Enrollments — {course.title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Enrolled Students ({enrollments?.length ?? 0})
            </p>
            {enrollments === undefined ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : enrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No students enrolled yet.</p>
            ) : (
              <div className="space-y-2">
                {enrollments.map((e) => {
                  const student = e as Doc<"users"> & { enrollmentId: Id<"enrollments">; enrolledAt: string };
                  return (
                    <div key={student._id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={student.avatar} />
                        <AvatarFallback>{student.name?.charAt(0) ?? "S"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{student.name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground truncate">{student.email ?? "—"}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive hover:text-destructive cursor-pointer gap-1"
                        onClick={() => handleUnenroll(student._id, student.name ?? "Student")}
                      >
                        <UserMinus className="w-3.5 h-3.5" /> Remove
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Add Students ({unenrolledStudents.length} available)
            </p>
            {unenrolledStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">All students are already enrolled.</p>
            ) : (
              <div className="space-y-2">
                {unenrolledStudents.map((student) => (
                  <div key={student._id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={student.avatar} />
                      <AvatarFallback>{student.name?.charAt(0) ?? "S"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{student.name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground truncate">{student.email ?? "—"}</p>
                    </div>
                    <Button
                      size="sm"
                      className="h-7 text-xs cursor-pointer gap-1"
                      onClick={() => handleEnroll(student._id, student.name ?? "Student")}
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Assign
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CourseEnrollmentRow({ course, allStudents }: { course: Doc<"courses">; allStudents: Doc<"users">[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{course.title}</p>
          <p className="text-xs text-muted-foreground">{course.category}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Badge variant="secondary" className="text-xs gap-1">
            <Users className="w-3 h-3" /> {course.enrollmentCount} enrolled
          </Badge>
          <Badge className={course.published
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs"
            : "bg-muted text-muted-foreground text-xs"}>
            {course.published ? "Published" : "Draft"}
          </Badge>
          <Button size="sm" variant="secondary" className="h-7 text-xs cursor-pointer gap-1">
            <UserPlus className="w-3.5 h-3.5" /> Manage
          </Button>
        </div>
      </div>
      {open && (
        <CourseEnrollmentModal course={course} allStudents={allStudents} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

export default function AdminPage() {
  return (
    <Authenticated>
      <AdminPageInner />
    </Authenticated>
  );
}
