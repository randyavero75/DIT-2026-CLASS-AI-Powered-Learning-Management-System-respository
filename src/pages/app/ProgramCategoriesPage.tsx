import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { Authenticated } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  FolderKanban,
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  GraduationCap,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Users,
  ArrowRight,
  Clock,
  XCircle,
  User,
  Phone,
  Hash,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { ConvexError } from "convex/values";

// ── Category Form Dialog (admin only) ─────────────────────────────────────────

function CategoryDialog({
  existing,
  onClose,
}: {
  existing?: Doc<"programCategories">;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [loading, setLoading] = useState(false);
  const createCat = useMutation(api.programCategories.create);
  const updateCat = useMutation(api.programCategories.update);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (existing) {
        await updateCat({ categoryId: existing._id, name: name.trim(), description: description.trim() || undefined });
        toast.success("Program category updated");
      } else {
        await createCat({ name: name.trim(), description: description.trim() || undefined });
        toast.success("Program category created");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save category");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-primary" />
            {existing ? "Edit Program Category" : "New Program Category"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="cat-name" className="mb-1.5 block">Category Name <span className="text-destructive">*</span></Label>
            <Input id="cat-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Computer Science" required />
          </div>
          <div>
            <Label htmlFor="cat-desc" className="mb-1.5 block">Description</Label>
            <Textarea id="cat-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of this program..." rows={3} />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="cursor-pointer" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1 cursor-pointer" disabled={loading}>
              {loading ? "Saving..." : existing ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Semester Mode Card (admin only) ────────────────────────────────────────────

function SemesterModeCard() {
  const org = useQuery(api.organizations.getMyOrganization, {});
  const setSemesterMode = useMutation(api.organizations.setSemesterMode);
  const [saving, setSaving] = useState(false);

  const handleChange = async (val: string) => {
    setSaving(true);
    try {
      await setSemesterMode({ semesterMode: val as "two_semester" | "one_term" });
      toast.success("Semester mode updated");
    } catch {
      toast.error("Failed to update semester mode");
    } finally {
      setSaving(false);
    }
  };

  if (!org) return <Skeleton className="h-28 w-full" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="w-4 h-4 text-primary" />
          Academic Structure
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Choose whether your institution runs on two semesters or a single full term.
        </p>
        <Select
          value={org.semesterMode ?? "two_semester"}
          onValueChange={handleChange}
          disabled={saving}
        >
          <SelectTrigger className="w-full cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="two_semester" className="cursor-pointer">First & Second Semester</SelectItem>
            <SelectItem value="one_term" className="cursor-pointer">Full One Term</SelectItem>
          </SelectContent>
        </Select>
        <Badge
          className={
            (org.semesterMode ?? "two_semester") === "two_semester"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs"
              : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs"
          }
        >
          {(org.semesterMode ?? "two_semester") === "two_semester" ? "2-Semester System" : "Single Term System"}
        </Badge>
      </CardContent>
    </Card>
  );
}

// ── Admin/Lecturer: Manage Programs page ────────────────────────────────────────

function ManagePrograms({ isAdmin }: { isAdmin: boolean }) {
  const categories = useQuery(api.programCategories.listForCurrentOrg, {});
  const groupedCourses = useQuery(api.courses.getCoursesGroupedByProgram, {});
  const removeCategory = useMutation(api.programCategories.remove);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCat, setEditCat] = useState<Doc<"programCategories"> | undefined>(undefined);

  const handleDelete = async (id: Id<"programCategories">) => {
    try {
      await removeCategory({ categoryId: id });
      toast.success("Category removed");
    } catch {
      toast.error("Failed to remove category");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FolderKanban className="w-7 h-7 text-primary" />
            Program Categories
          </h1>
          <p className="text-muted-foreground mt-1">
            Organise courses into programs (e.g. Computer Science, Business Admin).
          </p>
        </div>
        {isAdmin && (
          <Button className="cursor-pointer gap-2 shrink-0" onClick={() => { setEditCat(undefined); setDialogOpen(true); }}>
            <Plus className="w-4 h-4" /> New Category
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left: category list */}
        <div className="md:col-span-2 space-y-3">
          {categories === undefined ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[20vh] gap-3 text-center border-2 border-dashed border-border rounded-2xl p-8 text-muted-foreground">
              <FolderKanban className="w-8 h-8 opacity-30" />
              <p className="text-sm">No program categories yet. {isAdmin ? "Create one to start grouping courses." : "Check back soon!"}</p>
            </div>
          ) : (
            categories.map((cat) => {
              const group = groupedCourses?.find((g) => g.category?._id === cat._id.toString());
              const semGroups = group?.semesterGroups;
              const courseCount = semGroups
                ? (semGroups.first?.length ?? 0) + (semGroups.second?.length ?? 0) + (semGroups.full_term?.length ?? 0)
                : 0;
              return (
                <Card key={cat._id} className="border border-border hover:shadow-sm transition-all">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{cat.name}</p>
                        {cat.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{cat.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="secondary" className="text-xs">
                            <BookOpen className="w-3 h-3 mr-1" />
                            {courseCount} course{courseCount !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Button
                            size="sm" variant="secondary"
                            className="h-7 cursor-pointer text-xs gap-1"
                            onClick={() => { setEditCat(cat); setDialogOpen(true); }}
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 cursor-pointer text-destructive hover:text-destructive"
                            onClick={() => handleDelete(cat._id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Right: semester mode (admin only) */}
        {isAdmin && (
          <div>
            <SemesterModeCard />
          </div>
        )}
      </div>

      {dialogOpen && isAdmin && (
        <CategoryDialog
          existing={editCat}
          onClose={() => { setDialogOpen(false); setEditCat(undefined); }}
        />
      )}
    </div>
  );
}

// ── Student: Program Selector & Program View ────────────────────────────────────

type SemGroup = { first: Doc<"courses">[]; second: Doc<"courses">[]; full_term: Doc<"courses">[] };
type ProgramGroup = {
  category: { _id: string; name: string; description?: string } | null;
  semesterGroups: SemGroup;
};

function StudentProgramView() {
  const navigate = useNavigate();
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const categories = useQuery(api.programCategories.listForCurrentOrg, {});
  const groupedCourses = useQuery(api.courses.getCoursesGroupedByProgram, {});
  const myEnrollments = useQuery(api.courses.getMyEnrollments, {});
  const myProgramRequests = useQuery(api.programEnrollments.getMyProgramRequests, {});
  const myApprovedPrograms = useQuery(api.programEnrollments.getMyApprovedPrograms, {});
  const requestProgramEnrollment = useMutation(api.programEnrollments.requestProgramEnrollment);
  const org = useQuery(api.organizations.getMyOrganization, {});
  const [selectedProgram, setSelectedProgram] = useState<Id<"programCategories"> | null>(null);

  // Dialog state
  const [dialogProgram, setDialogProgram] = useState<{ id: Id<"programCategories">; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    indexNumber: "",
    dateOfBirth: "",
    gender: "" as "" | "male" | "female" | "other" | "prefer_not_to_say",
    yearOfStudy: "",
    message: "",
  });

  const openRequestDialog = (id: Id<"programCategories">, name: string) => {
    setForm({
      fullName: currentUser?.name ?? "",
      phone: "",
      indexNumber: "",
      dateOfBirth: "",
      gender: "",
      yearOfStudy: "",
      message: "",
    });
    setDialogProgram({ id, name });
  };

  const handleSubmitRequest = async () => {
    if (!dialogProgram) return;
    if (!form.fullName.trim()) { toast.error("Full name is required"); return; }
    if (!form.phone.trim()) { toast.error("Phone number is required"); return; }
    setSubmitting(true);
    try {
      await requestProgramEnrollment({
        programId: dialogProgram.id,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        indexNumber: form.indexNumber.trim() || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        yearOfStudy: form.yearOfStudy.trim() || undefined,
        message: form.message.trim() || undefined,
      });
      toast.success("Request submitted! Awaiting admin approval.");
      setDialogProgram(null);
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Failed to send request");
    } finally {
      setSubmitting(false);
    }
  };

  if (currentUser === undefined || categories === undefined || myProgramRequests === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  const enrolledIds = new Set((myEnrollments as Doc<"courses">[] | undefined | null)?.map(c => c?._id) ?? []);
  const approvedProgramIds = new Set((myApprovedPrograms ?? []).filter(Boolean).map(p => p!._id.toString()));
  const requestMap = new Map((myProgramRequests ?? []).map(r => [r.programId.toString(), r]));
  if (selectedProgram && approvedProgramIds.has(selectedProgram.toString())) {
    const selectedCat = categories.find(c => c._id.toString() === selectedProgram.toString());
    const programGroup = (groupedCourses as ProgramGroup[] | undefined)?.find(
      g => g.category?._id === selectedProgram.toString()
    );
    const sg = programGroup?.semesterGroups;
    const orgMode = org?.semesterMode;

    const allCoursesInProgram = orgMode === "one_term"
      ? [...(sg?.first ?? []), ...(sg?.second ?? []), ...(sg?.full_term ?? [])]
      : null;

    const SemSection = ({ label, courses, semColor }: { label: string; courses: Doc<"courses">[]; semColor: string }) => {
      if (courses.length === 0) return null;
      return (
        <div>
          <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${semColor}`}>
            <CalendarDays className="w-4 h-4" /> {label}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map(course => {
              const isEnrolled = enrolledIds.has(course._id);
              return (
                <Card key={course._id} className={`border transition-all hover:-translate-y-0.5 hover:shadow-md ${isEnrolled ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{course.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{course.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" />{course.enrollmentCount} students
                        </span>
                        {isEnrolled ? (
                          <Badge className="bg-primary/10 text-primary text-xs gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Enrolled
                          </Badge>
                        ) : (
                          <Button size="sm" variant="secondary" className="h-7 cursor-pointer text-xs gap-1" onClick={() => navigate("/courses")}>
                            <ArrowRight className="w-3 h-3" /> View
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <FolderKanban className="w-3.5 h-3.5" />
              <button className="hover:underline cursor-pointer" onClick={() => setSelectedProgram(null)}>My Programs</button>
              <ChevronRight className="w-3 h-3" />
              <span>{selectedCat?.name}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{selectedCat?.name ?? "Program"}</h1>
            {selectedCat?.description && (
              <p className="text-muted-foreground mt-1">{selectedCat.description}</p>
            )}
          </div>
          <Button variant="secondary" size="sm" className="cursor-pointer gap-2 shrink-0" onClick={() => setSelectedProgram(null)}>
            <ArrowRight className="w-4 h-4" /> Back to Programs
          </Button>
        </div>

        {!sg || (sg.first.length + sg.second.length + sg.full_term.length === 0) ? (
          <div className="flex flex-col items-center justify-center min-h-[25vh] gap-3 text-center border-2 border-dashed border-border rounded-2xl p-8 text-muted-foreground">
            <BookOpen className="w-10 h-10 opacity-30" />
            <p className="font-medium">No courses yet</p>
            <p className="text-sm">No courses have been added to this program yet. Check back soon!</p>
          </div>
        ) : orgMode === "one_term" ? (
          <SemSection label="All Courses" courses={allCoursesInProgram!} semColor="text-green-600" />
        ) : (
          <div className="space-y-6">
            <SemSection label="First Semester" courses={sg?.first ?? []} semColor="text-blue-600" />
            <SemSection label="Second Semester" courses={sg?.second ?? []} semColor="text-purple-600" />
            <SemSection label="Full Term" courses={sg?.full_term ?? []} semColor="text-green-600" />
          </div>
        )}
      </div>
    );
  }

  // Main programs list with request status
  return (
    <>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <FolderKanban className="w-7 h-7 text-primary" />
          Programs
        </h1>
        <p className="text-muted-foreground mt-1">
          Request access to join a program at {org?.name ?? "your institution"}. Once approved, you'll be enrolled in all its courses automatically.
        </p>
      </div>

      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3 text-center border-2 border-dashed border-border rounded-2xl p-8 text-muted-foreground">
          <FolderKanban className="w-10 h-10 opacity-30" />
          <p className="font-medium">No programs available yet</p>
          <p className="text-sm">Your institution hasn't set up any program categories. Check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const group = (groupedCourses as ProgramGroup[] | undefined)?.find(g => g.category?._id === cat._id.toString());
            const sg = group?.semesterGroups;
            const courseCount = sg ? (sg.first?.length ?? 0) + (sg.second?.length ?? 0) + (sg.full_term?.length ?? 0) : 0;
            const req = requestMap.get(cat._id.toString());
            const isApproved = approvedProgramIds.has(cat._id.toString());
            const isPending = req?.status === "pending";
            const isRejected = req?.status === "rejected";

            return (
              <Card
                key={cat._id}
                className={`border-2 transition-all hover:-translate-y-0.5 ${
                  isApproved
                    ? "border-primary/50 bg-primary/5 cursor-pointer hover:shadow-md"
                    : "border-border"
                }`}
                onClick={isApproved ? () => setSelectedProgram(cat._id) : undefined}
              >
                <CardContent className="pt-5 pb-5">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="w-6 h-6 text-primary" />
                      </div>
                      {isApproved && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Enrolled
                        </Badge>
                      )}
                      {isPending && (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs gap-1">
                          <Clock className="w-3 h-3" /> Pending
                        </Badge>
                      )}
                      {isRejected && (
                        <Badge className="bg-destructive/10 text-destructive text-xs gap-1">
                          <XCircle className="w-3 h-3" /> Rejected
                        </Badge>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-base">{cat.name}</p>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cat.description}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        <BookOpen className="w-3 h-3 mr-1" />
                        {courseCount} course{courseCount !== 1 ? "s" : ""}
                      </Badge>
                      {isApproved ? (
                        <Button size="sm" className="cursor-pointer text-xs h-7 gap-1" onClick={() => setSelectedProgram(cat._id)}>
                          <ArrowRight className="w-3 h-3" /> View Courses
                        </Button>
                      ) : isPending ? (
                        <span className="text-xs text-muted-foreground">Awaiting admin review</span>
                      ) : (
                        <Button
                          size="sm"
                          className="cursor-pointer text-xs h-7 gap-1"
                          onClick={(e) => { e.stopPropagation(); openRequestDialog(cat._id, cat.name); }}
                        >
                          <Send className="w-3 h-3" />
                          {isRejected ? "Re-request" : "Request Access"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>

    {/* ── Program Enrollment Request Dialog ── */}
    {dialogProgram && (
      <Dialog open onOpenChange={() => setDialogProgram(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              Request Program Enrollment
            </DialogTitle>
            <DialogDescription>
              Fill in your details to apply for <strong>{dialogProgram.name}</strong>. Your request will be reviewed by your institution{"'"}s admin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="req-fullname" className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="req-fullname"
                placeholder="e.g. John Kwame Asante"
                value={form.fullName}
                onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))}
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="req-phone" className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Phone Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="req-phone"
                placeholder="e.g. +233 24 000 0000"
                value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>

            {/* Index Number */}
            <div className="space-y-1.5">
              <Label htmlFor="req-index" className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" /> Index / Student Number
              </Label>
              <Input
                id="req-index"
                placeholder="e.g. UG/123456/21"
                value={form.indexNumber}
                onChange={(e) => setForm(f => ({ ...f, indexNumber: e.target.value }))}
              />
            </div>

            {/* Date of Birth & Gender row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="req-dob">Date of Birth</Label>
                <Input
                  id="req-dob"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select
                  value={form.gender}
                  onValueChange={(v) => setForm(f => ({ ...f, gender: v as typeof form.gender }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Year of Study */}
            <div className="space-y-1.5">
              <Label htmlFor="req-year">Year / Level of Study</Label>
              <Input
                id="req-year"
                placeholder="e.g. Year 1, Level 100, Form 2"
                value={form.yearOfStudy}
                onChange={(e) => setForm(f => ({ ...f, yearOfStudy: e.target.value }))}
              />
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <Label htmlFor="req-msg">Additional Message (optional)</Label>
              <Textarea
                id="req-msg"
                placeholder="Any additional information you'd like the admin to know..."
                rows={3}
                value={form.message}
                onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1 cursor-pointer" onClick={() => setDialogProgram(null)} disabled={submitting}>
                Cancel
              </Button>
              <Button className="flex-1 cursor-pointer gap-2" onClick={handleSubmitRequest} disabled={submitting}>
                <Send className="w-4 h-4" />
                {submitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}

// ── Lecturer: Assigned Programs & Access Request ──────────────────────────────

function LecturerProgramView() {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const categories = useQuery(api.programCategories.listForCurrentOrg, {});
  const assignedPrograms = useQuery(api.programLecturers.getMyAssignedPrograms, {});
  const myRequests = useQuery(api.programLecturers.getMyAccessRequests, {});
  const requestAccess = useMutation(api.programLecturers.requestProgramAccess);
  const org = useQuery(api.organizations.getMyOrganization, {});

  const [requesting, setRequesting] = useState<string | null>(null);

  if (currentUser === undefined || categories === undefined || assignedPrograms === undefined) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  const assignedIds = new Set((assignedPrograms ?? []).map(p => p?._id?.toString()));
  const requestMap = new Map((myRequests ?? []).map(r => [r.programId.toString(), r]));

  const handleRequest = async (programId: Id<"programCategories">) => {
    setRequesting(programId);
    try {
      await requestAccess({ programId });
      toast.success("Access request sent to admin");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Failed to send request");
    } finally {
      setRequesting(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <FolderKanban className="w-7 h-7 text-primary" />
          Programs
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage content for programs you're assigned to, or request access to additional programs at {org?.name ?? "your institution"}.
        </p>
      </div>

      {/* Assigned Programs */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600" /> My Assigned Programs
        </h2>
        {(assignedPrograms ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[15vh] gap-3 text-center border-2 border-dashed border-border rounded-2xl p-6 text-muted-foreground">
            <GraduationCap className="w-8 h-8 opacity-30" />
            <p className="text-sm">You haven't been assigned to any program yet. You can request access below.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(assignedPrograms ?? []).map(p => p && (
              <Card key={p._id} className="border-2 border-primary/30 bg-primary/5">
                <CardContent className="pt-5 pb-5">
                  <div className="flex flex-col gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm">{p.name}</p>
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                      </div>
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                      )}
                    </div>
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs w-fit">
                      Full Access
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* All Programs — request access to others */}
      {(categories ?? []).filter(c => !assignedIds.has(c._id.toString())).length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-muted-foreground" /> Other Programs
          </h2>
          <div className="space-y-3">
            {(categories ?? []).filter(c => !assignedIds.has(c._id.toString())).map(cat => {
              const req = requestMap.get(cat._id.toString());
              return (
                <Card key={cat._id} className="border border-border">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{cat.name}</p>
                        {cat.description && <p className="text-xs text-muted-foreground line-clamp-1">{cat.description}</p>}
                      </div>
                      <div className="flex-shrink-0">
                        {req?.status === "pending" ? (
                          <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            Pending Request
                          </Badge>
                        ) : req?.status === "rejected" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="cursor-pointer text-xs h-7"
                            onClick={() => handleRequest(cat._id)}
                            disabled={requesting === cat._id}
                          >
                            {requesting === cat._id ? "Requesting..." : "Re-request Access"}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="cursor-pointer text-xs h-7 gap-1"
                            onClick={() => handleRequest(cat._id)}
                            disabled={requesting === cat._id}
                          >
                            <ArrowRight className="w-3 h-3" />
                            {requesting === cat._id ? "Requesting..." : "Request Access"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function ProgramCategoriesInner() {
  const currentUser = useQuery(api.users.getCurrentUser, {});

  if (currentUser === undefined || currentUser === null) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  const isAdmin = currentUser.role === "admin" || currentUser.role === "superadmin";
  const isLecturer = currentUser.role === "lecturer";
  const isStudent = currentUser.role === "student" || (!isAdmin && !isLecturer);

  if (isStudent) {
    return <StudentProgramView />;
  }

  if (isLecturer) {
    return <LecturerProgramView />;
  }

  // Admins see the management view
  return <ManagePrograms isAdmin={isAdmin} />;
}

export default function ProgramCategoriesPage() {
  return (
    <Authenticated>
      <ProgramCategoriesInner />
    </Authenticated>
  );
}
