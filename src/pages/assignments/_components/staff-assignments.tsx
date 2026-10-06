import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { toast } from "sonner";
import { ClipboardList, Plus, Trash2, Paperclip, Clock } from "lucide-react";
import { format } from "date-fns";
import { FORMAT_OPTIONS } from "../_lib/formats.ts";
import { cn } from "@/lib/utils.ts";

const errMsg = (e: unknown, fallback: string) =>
  e instanceof ConvexError ? (e.data as { message: string }).message : fallback;

function CreateDialog({ onClose }: { onClose: () => void }) {
  const courses = useQuery(api.courses.getAllCoursesForLecturer, {});
  const create = useMutation(api.assignments.create);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [formats, setFormats] = useState<string[]>(["pdf", "docx"]);
  const [extra, setExtra] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (f: string) =>
    setFormats((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  const handleSave = async () => {
    if (!courseId || !title.trim() || !dueLocal) {
      toast.error("Choose a course, add a title and set a due date");
      return;
    }
    const all = [...formats, ...extra.split(",").map((s) => s.trim()).filter(Boolean)];
    setSaving(true);
    try {
      await create({
        courseId: courseId as Id<"courses">,
        title,
        instructions,
        // datetime-local is in the lecturer's timezone; store as UTC
        dueAt: new Date(dueLocal).toISOString(),
        maxScore: Number(maxScore),
        allowedFormats: all,
      });
      toast.success("Assignment created");
      onClose();
    } catch (e) {
      toast.error(errMsg(e, "Could not create assignment"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New assignment</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger>
              <SelectContent>
                {(courses ?? []).map((c) => <SelectItem key={c._id} value={c._id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-title">Title</Label>
            <Input id="as-title" placeholder="e.g. Week 3 Case Study" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-inst">Instructions</Label>
            <Textarea id="as-inst" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="as-due">Due date and time</Label>
              <Input id="as-due" type="datetime-local" value={dueLocal} onChange={(e) => setDueLocal(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-max">Max score</Label>
              <Input id="as-max" type="number" min={1} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Accepted file formats</Label>
            <div className="flex flex-wrap gap-2">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggle(f)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs border cursor-pointer",
                    formats.includes(f) ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border",
                  )}
                >
                  .{f}
                </button>
              ))}
            </div>
            <Input placeholder="Other extensions, comma separated (e.g. py, csv)" value={extra} onChange={(e) => setExtra(e.target.value)} />
          </div>
          <Button className="w-full cursor-pointer" disabled={saving} onClick={handleSave}>
            {saving ? "Saving..." : "Create assignment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SubmissionsDialog({
  assignmentId,
  title,
  maxScore,
  onClose,
}: {
  assignmentId: Id<"assignments">;
  title: string;
  maxScore: number;
  onClose: () => void;
}) {
  const subs = useQuery(api.assignments.listSubmissions, { assignmentId });
  const grade = useMutation(api.assignments.grade);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const handleGrade = async (id: Id<"assignmentSubmissions">, current?: number, currentFb?: string) => {
    const raw = scores[id] ?? (current !== undefined ? String(current) : "");
    if (raw === "") {
      toast.error("Enter a score");
      return;
    }
    try {
      await grade({ submissionId: id, score: Number(raw), feedback: feedback[id] ?? currentFb });
      toast.success("Score saved");
    } catch (e) {
      toast.error(errMsg(e, "Could not save score"));
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {subs === undefined ? (
          <Skeleton className="h-24 w-full" />
        ) : subs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No submissions yet.</p>
        ) : (
          <div className="space-y-3">
            {subs.map((s) => (
              <div key={s._id} className="border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold">{s.studentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.indexNumber ? `${s.indexNumber} · ` : ""}
                      {format(new Date(s.submittedAt), "MMM d, h:mm a")}
                    </p>
                  </div>
                  {s.isLate && <Badge variant="destructive">Late</Badge>}
                </div>
                {s.note && <p className="text-sm text-muted-foreground">{s.note}</p>}
                <div className="flex flex-wrap gap-2">
                  {s.files.map((f) => (
                    <a
                      key={f.storageId}
                      href={f.url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/70 cursor-pointer"
                    >
                      <Paperclip className="w-3 h-3" /> {f.fileName}
                    </a>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    type="number"
                    className="w-24"
                    min={0}
                    max={maxScore}
                    placeholder="Score"
                    value={scores[s._id] ?? (s.score !== undefined ? String(s.score) : "")}
                    onChange={(e) => setScores((cur) => ({ ...cur, [s._id]: e.target.value }))}
                  />
                  <span className="text-xs text-muted-foreground">/ {maxScore}</span>
                  <Input
                    className="flex-1 min-w-32"
                    placeholder="Feedback (optional)"
                    value={feedback[s._id] ?? s.feedback ?? ""}
                    onChange={(e) => setFeedback((cur) => ({ ...cur, [s._id]: e.target.value }))}
                  />
                  <Button size="sm" className="cursor-pointer" onClick={() => handleGrade(s._id, s.score, s.feedback)}>
                    Save
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function StaffAssignments() {
  const list = useQuery(api.assignments.listForStaff, {});
  const remove = useMutation(api.assignments.remove);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<{ id: Id<"assignments">; title: string; maxScore: number } | null>(null);

  const handleDelete = async (id: Id<"assignments">) => {
    if (!confirm("Delete this assignment and all submissions?")) return;
    try {
      await remove({ assignmentId: id });
      toast.success("Assignment deleted");
    } catch (e) {
      toast.error(errMsg(e, "Could not delete"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="cursor-pointer gap-2" onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4" /> New assignment
        </Button>
      </div>
      {list === undefined ? (
        <Skeleton className="h-24 w-full" />
      ) : list.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><ClipboardList /></EmptyMedia>
            <EmptyTitle>No assignments yet</EmptyTitle>
            <EmptyDescription>Create one with a due date and the file formats you accept.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        list.map((a) => (
          <Card key={a._id}>
            <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {a.courseTitle} · Due {format(new Date(a.dueAt), "MMM d, yyyy h:mm a")} · Accepts {a.allowedFormats.join(", ")}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {a.submissionCount} submitted · {a.gradedCount} graded
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => setViewing({ id: a._id, title: a.title, maxScore: a.maxScore })}
                >
                  Submissions and scores
                </Button>
                <Button size="icon" variant="ghost" className="cursor-pointer text-destructive" onClick={() => handleDelete(a._id)} aria-label="Delete">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
      {creating && <CreateDialog onClose={() => setCreating(false)} />}
      {viewing && (
        <SubmissionsDialog
          assignmentId={viewing.id}
          title={viewing.title}
          maxScore={viewing.maxScore}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

export function DueBadge({ dueAt }: { dueAt: string }) {
  const overdue = Date.now() > Date.parse(dueAt);
  return (
    <Badge variant={overdue ? "destructive" : "secondary"} className="gap-1">
      <Clock className="w-3 h-3" /> {overdue ? "Closed" : "Open"} · {format(new Date(dueAt), "MMM d, h:mm a")}
    </Badge>
  );
}
