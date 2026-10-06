import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
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
  BookOpen,
  Plus,
  Users,
  Eye,
  EyeOff,
  Trash2,
  GraduationCap,
  CheckCircle2,
  Clock,
  XCircle,
  Send,
  FolderOpen,
  FolderKanban,
  ChevronDown,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";

type SemesterKey = "first" | "second" | "full_term";
type SemGroup = { first: Doc<"courses">[]; second: Doc<"courses">[]; full_term: Doc<"courses">[] };

const SEMESTER_LABELS: Record<SemesterKey, string> = {
  first: "First Semester",
  second: "Second Semester",
  full_term: "Full Term",
};

// ── Create Course Dialog ─────────────────────────────────────────────────────

function CreateCourseDialog({ open, onClose, orgMode }: { open: boolean; onClose: () => void; orgMode?: string }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [programCategoryId, setProgramCategoryId] = useState<string>("");
  const [semester, setSemester] = useState<SemesterKey>(orgMode === "one_term" ? "full_term" : "first");
  const [loading, setLoading] = useState(false);
  const createCourse = useMutation(api.courses.createCourse);
  const programCategories = useQuery(api.programCategories.listForCurrentOrg, {});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;
    if (!programCategoryId) {
      toast.error("Choose the program this course belongs to");
      return;
    }
    setLoading(true);
    try {
      await createCourse({
        title,
        description,
        category: programCategories?.find((c) => c._id === programCategoryId)?.name ?? category,
        programCategoryId: programCategoryId as Id<"programCategories">,
        semester,
      });
      toast.success("Course created!");
      setTitle(""); setDescription(""); setCategory(""); setProgramCategoryId(""); setSemester("first");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create course");
    } finally {
      setLoading(false);
    }
  };

  const semesterOptions: { value: SemesterKey; label: string }[] = orgMode === "one_term"
    ? [{ value: "full_term", label: "Full Term" }]
    : [
        { value: "first", label: "First Semester" },
        { value: "second", label: "Second Semester" },
      ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" /> New Course
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="course-title" className="mb-1.5 block">Course Title <span className="text-destructive">*</span></Label>
            <Input id="course-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Introduction to Biology" required />
          </div>
          <div>
            <Label htmlFor="course-desc" className="mb-1.5 block">Description <span className="text-destructive">*</span></Label>
            <Textarea id="course-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what students will learn..." rows={3} required />
          </div>
          <div>
            <Label htmlFor="prog-cat" className="mb-1.5 block">Program <span className="text-destructive">*</span></Label>
            {programCategories && programCategories.length > 0 ? (
              <Select value={programCategoryId} onValueChange={setProgramCategoryId}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Select a program..." />
                </SelectTrigger>
                <SelectContent>
                  {programCategories.map((pc) => (
                    <SelectItem key={pc._id} value={pc._id} className="cursor-pointer">{pc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">
                Courses must belong to a program. <a href="/programs" className="text-primary underline">Create a program</a> first.
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="course-sem" className="mb-1.5 block">Semester / Term</Label>
            <Select value={semester} onValueChange={(v) => setSemester(v as SemesterKey)}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {semesterOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="cursor-pointer">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="cursor-pointer" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1 cursor-pointer" disabled={loading}>
              {loading ? "Creating..." : "Create Course"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Semester Badge ────────────────────────────────────────────────────────────

function SemesterBadge({ semester }: { semester?: string }) {
  if (!semester) return null;
  const label = SEMESTER_LABELS[semester as SemesterKey] ?? semester;
  const colorClass = semester === "first"
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
    : semester === "second"
    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
    : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  return <Badge className={`text-xs ${colorClass}`}>{label}</Badge>;
}

// ── Lecturer Course Card ────────────────────────────────────────────────────

function LecturerCourseCard({ course }: { course: Doc<"courses"> }) {
  const navigate = useNavigate();
  const publishCourse = useMutation(api.courses.publishCourse);
  const deleteCourse = useMutation(api.courses.deleteCourse);

  return (
    <Card className="border border-border hover:shadow-sm transition-all">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm">{course.title}</p>
              <Badge className={course.published
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs"
                : "bg-muted text-muted-foreground text-xs"}>
                {course.published ? "Published" : "Draft"}
              </Badge>
              <SemesterBadge semester={course.semester} />
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{course.description}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{course.enrollmentCount} enrolled</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button size="sm" variant="secondary" className="h-7 cursor-pointer text-xs gap-1" onClick={() => navigate(`/courses/${course._id}`)}>
              <FolderOpen className="w-3 h-3" /> Materials
            </Button>
            <Button size="sm" variant="secondary" className="h-7 cursor-pointer text-xs gap-1"
              onClick={async () => {
                await publishCourse({ courseId: course._id, published: !course.published });
                toast.success(course.published ? "Course unpublished" : "Course published");
              }}>
              {course.published ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {course.published ? "Unpublish" : "Publish"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 cursor-pointer text-destructive hover:text-destructive"
              onClick={async () => { await deleteCourse({ courseId: course._id }); toast.success("Course deleted"); }}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Student Course Card ─────────────────────────────────────────────────────

type RequestMap = Record<string, "pending" | "approved" | "rejected">;

function StudentCourseCard({
  course, enrolled, requestStatus,
}: {
  course: Doc<"courses">;
  enrolled: boolean;
  requestStatus?: "pending" | "approved" | "rejected" | null;
}) {
  const navigate = useNavigate();
  const requestAccess = useMutation(api.courseRequests.requestAccess);
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    setLoading(true);
    try {
      await requestAccess({ courseId: course._id });
      toast.success(`Access requested for "${course.title}". Awaiting admin approval.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send request");
    } finally {
      setLoading(false);
    }
  };

  const renderAction = () => {
    if (enrolled) {
      return (
        <div className="flex flex-col items-end gap-1.5">
          <Button size="sm" className="h-7 cursor-pointer text-xs gap-1" onClick={() => navigate(`/courses/${course._id}`)}>
            <FolderOpen className="w-3.5 h-3.5" /> View Materials
          </Button>
          <span className="flex items-center gap-1 text-xs font-medium text-green-600">
            <CheckCircle2 className="w-3 h-3" /> Enrolled
          </span>
        </div>
      );
    }
    if (requestStatus === "pending") {
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
          <Clock className="w-3.5 h-3.5" /> Pending Approval
        </span>
      );
    }
    if (requestStatus === "rejected") {
      return (
        <div className="flex flex-col items-end gap-1">
          <span className="flex items-center gap-1 text-xs font-medium text-destructive">
            <XCircle className="w-3.5 h-3.5" /> Request Rejected
          </span>
          <Button size="sm" variant="secondary" className="h-6 text-xs cursor-pointer gap-1" onClick={handleRequest} disabled={loading}>
            <Send className="w-3 h-3" /> Re-request
          </Button>
        </div>
      );
    }
    return (
      <Button size="sm" className="h-7 cursor-pointer text-xs gap-1" onClick={handleRequest} disabled={loading}>
        <Send className="w-3.5 h-3.5" />
        {loading ? "Requesting..." : "Request Access"}
      </Button>
    );
  };

  return (
    <Card className="border border-border hover:shadow-md transition-all hover:-translate-y-0.5">
      <CardContent className="pt-5 pb-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{course.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <Badge variant="secondary" className="text-xs">{course.category}</Badge>
                <SemesterBadge semester={course.semester} />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{course.description}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" />{course.enrollmentCount} students
            </span>
            {renderAction()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Semester Section ──────────────────────────────────────────────────────────

function SemesterSection({
  label, courses, enrolledIds, requestMap, isAdmin, semKey,
}: {
  label: string;
  semKey: SemesterKey;
  courses: Doc<"courses">[];
  enrolledIds: Set<Id<"courses">>;
  requestMap: RequestMap;
  isAdmin: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  if (courses.length === 0) return null;

  const colorClass = semKey === "first"
    ? "border-blue-300/50 bg-blue-50/50 dark:bg-blue-950/20"
    : semKey === "second"
    ? "border-purple-300/50 bg-purple-50/50 dark:bg-purple-950/20"
    : "border-green-300/50 bg-green-50/50 dark:bg-green-950/20";

  return (
    <div className={`border rounded-xl overflow-hidden ${colorClass}`}>
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <CalendarDays className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <p className="font-medium text-sm flex-1">{label}</p>
        <Badge variant="secondary" className="text-xs mr-1">{courses.length} course{courses.length !== 1 ? "s" : ""}</Badge>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="p-3 pt-1">
          {isAdmin ? (
            <div className="space-y-2">
              {courses.map((c) => <LecturerCourseCard key={c._id} course={c} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {courses.map((c) => (
                <StudentCourseCard
                  key={c._id}
                  course={c}
                  enrolled={enrolledIds.has(c._id)}
                  requestStatus={requestMap[c._id] ?? null}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Program Group Accordion ─────────────────────────────────────────────────

type GroupType = {
  category: { _id: string; name: string; description?: string } | null;
  semesterGroups: SemGroup;
};

function ProgramGroup({
  group, enrolledIds, requestMap, isAdmin, orgMode,
}: {
  group: GroupType;
  enrolledIds: Set<Id<"courses">>;
  requestMap: RequestMap;
  isAdmin: boolean;
  orgMode?: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const label = group.category?.name ?? "General / Uncategorized";
  const { semesterGroups } = group;
  const totalCourses = semesterGroups.first.length + semesterGroups.second.length + semesterGroups.full_term.length;

  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-5 py-4 bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <FolderKanban className="w-5 h-5 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{label}</p>
          {group.category?.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{group.category.description}</p>
          )}
        </div>
        <Badge variant="secondary" className="text-xs mr-2">
          {totalCourses} course{totalCourses !== 1 ? "s" : ""}
        </Badge>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {totalCourses === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-4">No courses in this category yet.</p>
          ) : orgMode === "one_term" ? (
            <SemesterSection
              label="Full Term"
              semKey="full_term"
              courses={[...semesterGroups.first, ...semesterGroups.second, ...semesterGroups.full_term]}
              enrolledIds={enrolledIds}
              requestMap={requestMap}
              isAdmin={isAdmin}
            />
          ) : (
            <>
              <SemesterSection
                label="First Semester"
                semKey="first"
                courses={semesterGroups.first}
                enrolledIds={enrolledIds}
                requestMap={requestMap}
                isAdmin={isAdmin}
              />
              <SemesterSection
                label="Second Semester"
                semKey="second"
                courses={semesterGroups.second}
                enrolledIds={enrolledIds}
                requestMap={requestMap}
                isAdmin={isAdmin}
              />
              <SemesterSection
                label="Full Term"
                semKey="full_term"
                courses={semesterGroups.full_term}
                enrolledIds={enrolledIds}
                requestMap={requestMap}
                isAdmin={isAdmin}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

function CoursesPageInner() {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const org = useQuery(api.organizations.getMyOrganization, {});
  const [showCreate, setShowCreate] = useState(false);

  const isAdminOrSuper =
    currentUser?.role === "admin" ||
    currentUser?.role === "superadmin";
  const isLecturerOrAdmin =
    currentUser?.role === "lecturer" ||
    isAdminOrSuper;
  const isStudent = !isLecturerOrAdmin;

  const groupedCourses = useQuery(api.courses.getCoursesGroupedByProgram, {});
  const myEnrollments = useQuery(api.courses.getMyEnrollments, isStudent ? {} : "skip");
  const myRequests = useQuery(api.courseRequests.getMyRequests, isStudent ? {} : "skip");

  if (currentUser === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  const enrolledIds = new Set((myEnrollments as Doc<"courses">[] | undefined | null)?.map(c => c?._id) ?? []);

  const requestMap: RequestMap = {};
  myRequests?.forEach((r) => {
    if (r.courseId) requestMap[r.courseId] = r.status;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Courses</h1>
          <p className="text-muted-foreground mt-1">
            {isLecturerOrAdmin
              ? "Manage courses organised by program and semester."
              : "Browse courses in your program and request access. The admin approves each request."}
          </p>
        </div>
        {isAdminOrSuper && (
          <div className="flex gap-2">
            <Button variant="secondary" className="cursor-pointer gap-2 shrink-0" onClick={() => window.location.assign("/programs")}>
              <FolderKanban className="w-4 h-4" /> Manage Programs
            </Button>
            <Button className="cursor-pointer gap-2 shrink-0" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" /> New Course
            </Button>
          </div>
        )}
      </div>

      {/* Enrolled courses (student only) */}
      {isStudent && myEnrollments && myEnrollments.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" /> My Enrolled Courses
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(myEnrollments as Doc<"courses">[] | null | undefined)
              ?.filter(Boolean)
              .map((course) => course && (
                <StudentCourseCard
                  key={course._id}
                  course={course as Doc<"courses">}
                  enrolled={true}
                  requestStatus="approved"
                />
              ))}
          </div>
        </div>
      )}

      {/* Grouped by program category & semester */}
      {groupedCourses === undefined ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : groupedCourses.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-4 text-center border-2 border-dashed border-border rounded-2xl p-8">
          <BookOpen className="w-10 h-10 text-muted-foreground opacity-30" />
          <div>
            <p className="font-semibold">No courses yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              {isAdminOrSuper ? "Create your first course to get started." : "No courses are available yet. Check back soon!"}
            </p>
          </div>
          {isAdminOrSuper && (
            <Button size="sm" className="cursor-pointer gap-2" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" /> Create Course
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-primary" />
            {isStudent ? "Available Courses by Program" : "All Courses by Program & Semester"}
          </h2>
          {(groupedCourses as GroupType[]).map((group, i) => (
            <ProgramGroup
              key={group.category?._id ?? `uncategorized-${i}`}
              group={group}
              enrolledIds={enrolledIds as Set<Id<"courses">>}
              requestMap={requestMap}
              isAdmin={isLecturerOrAdmin}
              orgMode={org?.semesterMode}
            />
          ))}
        </div>
      )}

      <CreateCourseDialog open={showCreate} onClose={() => setShowCreate(false)} orgMode={org?.semesterMode} />
    </div>
  );
}

export default function CoursesPage() {
  return (
    <Authenticated>
      <CoursesPageInner />
    </Authenticated>
  );
}
