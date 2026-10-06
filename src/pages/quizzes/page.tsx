import { useState } from "react";
import StaffAssignments from "@/pages/assignments/_components/staff-assignments.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Brain,
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  Eye,
  EyeOff,
  Trash2,
  BookOpen,
  Sparkles,
  ListChecks,
  RotateCcw,
  Lock,
  Users,
  Trophy,
  BarChart3,
  PenLine,
  Minus,
  Download,
  Calendar,
  Hash,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import AiQuizGenerator from "./_components/AiQuizGenerator.tsx";
import QuizPreview from "./_components/QuizPreview.tsx";
import { cn } from "@/lib/utils.ts";
import { format } from "date-fns";
import type { Id, Doc } from "@/convex/_generated/dataModel.d.ts";
import * as XLSX from "xlsx";

// ── Manual Quiz Creator ───────────────────────────────────────────────────────

type OptionStyle = "alpha" | "roman" | "numeric";

const OPTION_LABELS: Record<OptionStyle, (i: number) => string> = {
  alpha: (i) => String.fromCharCode(65 + i),
  roman: (i) => ["i", "ii", "iii", "iv", "v"][i] ?? String(i + 1),
  numeric: (i) => String(i + 1),
};

type ManualQuestion = {
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  points: number;
};

function ManualQuizCreator({
  onSuccess,
  onCancel,
  courses,
}: {
  onSuccess: (id: Id<"quizzes">) => void;
  onCancel: () => void;
  courses: Doc<"courses">[];
}) {
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<Id<"courses"> | "">("");
  const [timeLimit, setTimeLimit] = useState<string>("");
  const [optionStyle, setOptionStyle] = useState<OptionStyle>("alpha");
  const [questions, setQuestions] = useState<ManualQuestion[]>([
    { questionText: "", options: ["", "", "", ""], correctOptionIndex: 0, explanation: "", points: 1 },
  ]);
  const [loading, setLoading] = useState(false);
  const createManualQuiz = useMutation(api.quizzes.createManualQuiz);

  const addQuestion = () => {
    setQuestions([...questions, { questionText: "", options: ["", "", "", ""], correctOptionIndex: 0, explanation: "", points: 1 }]);
  };

  const removeQuestion = (i: number) => {
    if (questions.length <= 1) { toast.error("Quiz must have at least 1 question"); return; }
    setQuestions(questions.filter((_, idx) => idx !== i));
  };

  const addOption = (qi: number) => {
    const q = questions[qi];
    if (q.options.length >= 5) { toast.error("Maximum 5 options per question"); return; }
    setQuestions(questions.map((q, idx) => idx === qi ? { ...q, options: [...q.options, ""] } : q));
  };

  const removeOption = (qi: number, oi: number) => {
    const q = questions[qi];
    if (q.options.length <= 2) { toast.error("Minimum 2 options per question"); return; }
    const newOptions = q.options.filter((_, i) => i !== oi);
    const newCorrect = q.correctOptionIndex >= newOptions.length ? newOptions.length - 1 : q.correctOptionIndex;
    setQuestions(questions.map((q, idx) => idx === qi ? { ...q, options: newOptions, correctOptionIndex: newCorrect } : q));
  };

  const updateQuestion = (i: number, field: keyof ManualQuestion, value: ManualQuestion[keyof ManualQuestion]) => {
    setQuestions(questions.map((q, idx) => idx === i ? { ...q, [field]: value } : q));
  };

  const updateOption = (qi: number, oi: number, value: string) => {
    const updated = [...questions];
    updated[qi] = { ...updated[qi], options: updated[qi].options.map((o, idx) => idx === oi ? value : o) };
    setQuestions(updated);
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error("Quiz title is required"); return; }
    if (!courseId) { toast.error("Please select a course"); return; }
    const invalid = questions.findIndex(q => !q.questionText.trim() || q.options.some(o => !o.trim()));
    if (invalid >= 0) { toast.error(`Question ${invalid + 1} is incomplete`); return; }

    setLoading(true);
    try {
      const quizId = await createManualQuiz({
        title,
        courseId: courseId as Id<"courses">,
        timeLimit: timeLimit ? parseInt(timeLimit) : undefined,
        questions: questions.map((q, i) => ({ ...q, orderIndex: i, explanation: q.explanation || undefined })),
      });
      toast.success("Quiz created!");
      onSuccess(quizId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create quiz");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
      {/* Quiz meta */}
      <div className="space-y-3">
        <Input placeholder="Quiz title *" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value as Id<"courses"> | "")}
          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground cursor-pointer"
        >
          <option value="">Select a course *</option>
          {courses.map(c => {
            const sem = c.semester === "first" ? "1st Sem" : c.semester === "second" ? "2nd Sem" : c.semester === "full_term" ? "Full Term" : "";
            const label = `${c.title}${sem ? ` [${sem}]` : ""}${c.category ? ` — ${c.category}` : ""}`;
            return <option key={c._id} value={c._id}>{label}</option>;
          })}
        </select>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Input
            type="number"
            placeholder="Time limit (minutes, optional)"
            value={timeLimit}
            onChange={(e) => setTimeLimit(e.target.value)}
            min={1}
            max={300}
          />
        </div>
        {/* Option label style */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Option labels:</span>
          {(["alpha", "roman", "numeric"] as OptionStyle[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setOptionStyle(s)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer",
                optionStyle === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
              )}
            >
              {s === "alpha" ? "A, B, C" : s === "roman" ? "i, ii, iii" : "1, 2, 3"}
            </button>
          ))}
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Questions ({questions.length})</p>
        {questions.map((q, qi) => (
          <div key={qi} className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-primary">Q{qi + 1}</span>
              <button onClick={() => removeQuestion(qi)} className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer">
                <Minus className="w-4 h-4" />
              </button>
            </div>
            <Textarea
              placeholder="Question text *"
              value={q.questionText}
              onChange={(e) => updateQuestion(qi, "questionText", e.target.value)}
              rows={2}
            />
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuestion(qi, "correctOptionIndex", oi)}
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors cursor-pointer",
                      q.correctOptionIndex === oi
                        ? "border-primary bg-primary"
                        : "border-border hover:border-primary/50"
                    )}
                  />
                  <span className="text-xs font-semibold text-muted-foreground w-6 flex-shrink-0">
                    {OPTION_LABELS[optionStyle](oi)}.
                  </span>
                  <Input
                    placeholder={`Option ${OPTION_LABELS[optionStyle](oi)} *`}
                    value={opt}
                    onChange={(e) => updateOption(qi, oi, e.target.value)}
                    className="flex-1"
                  />
                  {q.options.length > 2 && (
                    <button onClick={() => removeOption(qi, oi)} className="text-muted-foreground hover:text-destructive cursor-pointer">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">Click the circle to mark the correct answer</p>
                {q.options.length < 5 && (
                  <button onClick={() => addOption(qi)} className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add option
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Explanation (optional)"
                value={q.explanation}
                onChange={(e) => updateQuestion(qi, "explanation", e.target.value)}
                className="flex-1"
              />
              <Input
                type="number"
                placeholder="Pts"
                value={q.points}
                onChange={(e) => updateQuestion(qi, "points", parseInt(e.target.value) || 1)}
                className="w-20"
                min={1}
              />
            </div>
          </div>
        ))}

        <Button variant="secondary" size="sm" onClick={addQuestion} className="cursor-pointer gap-1.5 w-full">
          <Plus className="w-4 h-4" /> Add Question
        </Button>
      </div>

      <div className="flex gap-2 justify-end pt-2 border-t border-border sticky bottom-0 bg-background py-3">
        <Button variant="ghost" onClick={onCancel} disabled={loading} className="cursor-pointer">Cancel</Button>
        <Button onClick={handleSubmit} disabled={loading} className="cursor-pointer gap-1">
          <PenLine className="w-3.5 h-3.5" />
          {loading ? "Creating..." : `Create Quiz (${questions.length} Q${questions.length !== 1 ? "s" : ""})`}
        </Button>
      </div>
    </div>
  );
}

// ── Score viewer dialog with export ──────────────────────────────────────────

type AttemptWithStudent = Doc<"quizAttempts"> & { student: Doc<"users"> | null };

function ScoresDialog({ quiz, onClose }: { quiz: Doc<"quizzes">; onClose: () => void }) {
  const attempts = useQuery(api.attempts.getAttemptsByQuiz, { quizId: quiz._id });
  const allAttempts = useQuery(api.attempts.getAllAttemptsByQuiz, { quizId: quiz._id });

  const sorted = attempts
    ? [...(attempts as AttemptWithStudent[])].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))
    : [];

  const passCount = sorted.filter(a => a.passed).length;
  const avgPct = sorted.length > 0
    ? Math.round(sorted.reduce((s, a) => s + (a.percentage ?? 0), 0) / sorted.length)
    : 0;

  const handleExport = () => {
    if (!allAttempts) return;
    const rows = (allAttempts as (Doc<"quizAttempts"> & { studentName: string; studentEmail: string })[]).map((a) => ({
      "Student Name": a.studentName,
      "Email": a.studentEmail,
      "Score": a.score ?? 0,
      "Total Points": a.totalPoints ?? 0,
      "Percentage": `${a.percentage ?? 0}%`,
      "Passed": a.passed ? "Yes" : "No",
      "Started": a.startedAt ? format(new Date(a.startedAt), "yyyy-MM-dd HH:mm") : "",
      "Completed": a.completedAt ? format(new Date(a.completedAt), "yyyy-MM-dd HH:mm") : "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");
    XLSX.writeFile(wb, `${quiz.title.replace(/[^a-z0-9]/gi, "_")}_results.xlsx`);
    toast.success("Results exported to Excel");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4 text-primary" />
              Student Scores — {quiz.title}
            </DialogTitle>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs gap-1 cursor-pointer flex-shrink-0"
              onClick={handleExport}
              disabled={!allAttempts || allAttempts.length === 0}
            >
              <Download className="w-3.5 h-3.5" /> Export Excel
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Summary stats */}
          {sorted.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Students", value: sorted.length, color: "text-primary" },
                { label: "Passed", value: passCount, color: "text-green-600" },
                { label: "Avg Score", value: `${avgPct}%`, color: "text-foreground" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center p-3 rounded-xl bg-muted/50 border border-border">
                  <p className={cn("text-xl font-bold", color)}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground italic">Showing each student's latest attempt (latest result is accepted).</p>

          {attempts === undefined ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[20vh] gap-2 text-center text-muted-foreground">
              <Users className="w-8 h-8 opacity-30" />
              <p className="text-sm">No students have attempted this quiz yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map((attempt, idx) => (
                <div key={attempt._id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-center">{idx + 1}</span>
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={attempt.student?.avatar} />
                    <AvatarFallback className="text-xs">{attempt.student?.name?.charAt(0) ?? "S"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{attempt.student?.name ?? "Unknown"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Progress value={attempt.percentage ?? 0} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground tabular-nums">{attempt.percentage ?? 0}%</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge className={cn("text-xs", attempt.passed
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    )}>
                      {attempt.passed ? "Passed" : "Failed"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{attempt.score}/{attempt.totalPoints} pts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Quiz Settings Dialog (schedule + max attempts) ────────────────────────────

function QuizSettingsDialog({ quiz, onClose }: { quiz: Doc<"quizzes">; onClose: () => void }) {
  const setSchedule = useMutation(api.quizzes.setQuizSchedule);
  const setMaxAttempts = useMutation(api.quizzes.setMaxAttempts);

  // Convert ISO to datetime-local string (strip seconds)
  const toLocal = (iso?: string) => iso ? iso.slice(0, 16) : "";
  const [from, setFrom] = useState(toLocal(quiz.availableFrom));
  const [until, setUntil] = useState(toLocal(quiz.availableUntil));
  const [maxAttempts, setMaxAttempts_] = useState<string>(quiz.maxAttempts ? String(quiz.maxAttempts) : "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setSchedule({
        quizId: quiz._id,
        availableFrom: from ? new Date(from).toISOString() : undefined,
        availableUntil: until ? new Date(until).toISOString() : undefined,
      });
      const max = maxAttempts ? parseInt(maxAttempts) : undefined;
      await setMaxAttempts({ quizId: quiz._id, maxAttempts: max });
      toast.success("Quiz settings saved");
      onClose();
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const now = new Date().toISOString().slice(0, 16);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            Quiz Settings — {quiz.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* Schedule */}
          <div className="space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Availability Window</p>
            <p className="text-xs text-muted-foreground">Leave blank to make the quiz available anytime (while published).</p>
            <div className="space-y-2">
              <Label className="text-xs">Opens at (optional)</Label>
              <Input type="datetime-local" min={now} value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Closes at (optional)</Label>
              <Input type="datetime-local" min={from || now} value={until} onChange={(e) => setUntil(e.target.value)} />
            </div>
          </div>

          {/* Max attempts */}
          <div className="space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2"><Hash className="w-4 h-4 text-primary" /> Attempt Limit</p>
            <p className="text-xs text-muted-foreground">How many times a student can take this quiz. Leave blank for unlimited.</p>
            <Input
              type="number"
              min={1}
              placeholder="Unlimited"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts_(e.target.value)}
            />
            <p className="text-xs text-muted-foreground italic">The student's latest attempt is always the accepted score.</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2 border-t border-border">
          <Button variant="ghost" onClick={onClose} disabled={saving} className="cursor-pointer">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Quiz list item ────────────────────────────────────────────────────────────

function QuizListItem({
  quiz,
  courseTitle,
  onPreview,
  onViewScores,
  onSettings,
}: {
  quiz: Doc<"quizzes">;
  courseTitle: string;
  onPreview: () => void;
  onViewScores: () => void;
  onSettings: () => void;
}) {
  const publishQuiz = useMutation(api.quizzes.publishQuiz);
  const deleteQuiz = useMutation(api.quizzes.deleteQuiz);
  const setRetryAllowed = useMutation(api.quizzes.setRetryAllowed);

  const hasSchedule = quiz.availableFrom || quiz.availableUntil;
  const maxAttempts = quiz.maxAttempts;

  return (
    <Card className="border border-border hover:shadow-sm transition-shadow">
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm truncate">{quiz.title}</p>
              <Badge className={quiz.published
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs"
                : "bg-muted text-muted-foreground text-xs"}>
                {quiz.published ? "Published" : "Draft"}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{courseTitle}</span>
              <span className="flex items-center gap-1"><ListChecks className="w-3 h-3" />{quiz.questionCount} questions</span>
              {quiz.timeLimit && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{quiz.timeLimit} min</span>}
              {maxAttempts && <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{maxAttempts} attempt{maxAttempts !== 1 ? "s" : ""}</span>}
              {quiz.sourcePdfName && <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{quiz.sourcePdfName}</span>}
            </div>
            {/* Schedule info */}
            {hasSchedule && (
              <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3 text-primary flex-shrink-0" />
                {quiz.availableFrom && <span>Opens: {format(new Date(quiz.availableFrom), "MMM d, yyyy HH:mm")}</span>}
                {quiz.availableFrom && quiz.availableUntil && <span>·</span>}
                {quiz.availableUntil && <span>Closes: {format(new Date(quiz.availableUntil), "MMM d, yyyy HH:mm")}</span>}
              </div>
            )}
            {/* Retry toggle */}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={async () => {
                  await setRetryAllowed({ quizId: quiz._id, retryAllowed: !quiz.retryAllowed });
                  toast.success(quiz.retryAllowed ? "Retry disabled" : "Retry enabled");
                }}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer",
                  quiz.retryAllowed
                    ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400"
                    : "border-border bg-muted text-muted-foreground hover:border-primary/40"
                )}
              >
                {quiz.retryAllowed ? <RotateCcw className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {quiz.retryAllowed ? "Retry: On" : "Retry: Off"}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
            <Button size="sm" variant="secondary" className="h-8 cursor-pointer gap-1 text-xs" onClick={onPreview}>
              <Eye className="w-3.5 h-3.5" /> Preview
            </Button>
            <Button size="sm" variant="secondary" className="h-8 cursor-pointer gap-1 text-xs" onClick={onViewScores}>
              <Trophy className="w-3.5 h-3.5" /> Scores
            </Button>
            <Button size="sm" variant="secondary" className="h-8 cursor-pointer gap-1 text-xs" onClick={onSettings}>
              <Settings2 className="w-3.5 h-3.5" /> Settings
            </Button>
            <Button
              size="sm" variant="secondary" className="h-8 cursor-pointer gap-1 text-xs"
              onClick={async () => {
                await publishQuiz({ quizId: quiz._id, published: !quiz.published });
                toast.success(quiz.published ? "Quiz unpublished" : "Quiz published to students");
              }}
            >
              {quiz.published ? <EyeOff className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {quiz.published ? "Unpublish" : "Publish"}
            </Button>
            <Button
              size="sm" variant="ghost" className="h-8 cursor-pointer text-destructive hover:text-destructive"
              onClick={async () => { await deleteQuiz({ quizId: quiz._id }); toast.success("Quiz deleted"); }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function SectionTabs({ value, onChange }: { value: "quizzes" | "assignments"; onChange: (v: "quizzes" | "assignments") => void }) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as "quizzes" | "assignments")}>
      <TabsList>
        <TabsTrigger value="quizzes" className="cursor-pointer">Quizzes</TabsTrigger>
        <TabsTrigger value="assignments" className="cursor-pointer">Assignments</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function QuizBankInner() {
  const [section, setSection] = useState<"quizzes" | "assignments">("quizzes");
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const quizzes = useQuery(api.quizzes.getAllQuizzesForLecturer, {});
  const courses = useQuery(api.courses.getAllCoursesForLecturer, {});

  const [showGenerator, setShowGenerator] = useState(false);
  const [showManualCreator, setShowManualCreator] = useState(false);
  const [previewQuizId, setPreviewQuizId] = useState<Id<"quizzes"> | null>(null);
  const [scoresQuizId, setScoresQuizId] = useState<Id<"quizzes"> | null>(null);
  const [settingsQuizId, setSettingsQuizId] = useState<Id<"quizzes"> | null>(null);

  const isLecturerOrAdmin = currentUser?.role === "lecturer" || currentUser?.role === "admin";
  const isApproved = currentUser?.role === "admin" || currentUser?.lecturerApproved;

  if (currentUser === undefined || quizzes === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }

  if (!isLecturerOrAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
        <Brain className="w-12 h-12 text-muted-foreground opacity-30" />
        <h2 className="text-xl font-bold">Restricted Access</h2>
        <p className="text-muted-foreground">Only lecturers and admins can access the Quiz Bank.</p>
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center max-w-sm mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
          <Brain className="w-7 h-7 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold">Awaiting Approval</h2>
        <p className="text-muted-foreground text-sm">
          Your lecturer account is pending admin approval. Once approved, you can generate AI quizzes and manage your quiz bank.
        </p>
      </div>
    );
  }

  const getCourseTitle = (courseId: Id<"courses">) =>
    (courses as Doc<"courses">[] | undefined)?.find(c => c._id === courseId)?.title ?? "Unknown Course";

  const getCourse = (courseId: Id<"courses">) =>
    (courses as Doc<"courses">[] | undefined)?.find(c => c._id === courseId);

  const scoresQuiz = scoresQuizId ? (quizzes as Doc<"quizzes">[]).find(q => q._id === scoresQuizId) : null;
  const settingsQuiz = settingsQuizId ? (quizzes as Doc<"quizzes">[]).find(q => q._id === settingsQuizId) : null;

  // Group quizzes by course, attach course + program info
  const semLabel = (s?: string) => s === "first" ? "1st Sem" : s === "second" ? "2nd Sem" : s === "full_term" ? "Full Term" : "";

  // Group quizzes by courseId for display
  const quizzesByCourse: Record<string, { course: Doc<"courses"> | undefined; quizList: Doc<"quizzes">[] }> = {};
  for (const quiz of quizzes as Doc<"quizzes">[]) {
    const cid = quiz.courseId.toString();
    if (!quizzesByCourse[cid]) {
      quizzesByCourse[cid] = { course: getCourse(quiz.courseId), quizList: [] };
    }
    quizzesByCourse[cid].quizList.push(quiz);
  }

  if (section === "assignments") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Assignments</h1>
          <p className="text-muted-foreground mt-1">Set deadlines, collect uploads and record scores.</p>
        </div>
        <SectionTabs value={section} onChange={setSection} />
        <StaffAssignments />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Quiz Bank</h1>
          <p className="text-muted-foreground mt-1">Generate AI quizzes, manage settings, and view student scores.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" className="cursor-pointer gap-2 shrink-0" onClick={() => setShowManualCreator(true)}>
            <PenLine className="w-4 h-4" /> Create Manually
          </Button>
          <Button className="cursor-pointer gap-2 shrink-0" onClick={() => setShowGenerator(true)}>
            <Sparkles className="w-4 h-4" /> Generate with AI
          </Button>
        </div>
      </div>

      <SectionTabs value={section} onChange={setSection} />

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Quizzes", value: quizzes.length, icon: ListChecks, color: "text-primary" },
          { label: "Published", value: (quizzes as Doc<"quizzes">[]).filter(q => q.published).length, icon: CheckCircle2, color: "text-green-500" },
          { label: "Draft", value: (quizzes as Doc<"quizzes">[]).filter(q => !q.published).length, icon: FileText, color: "text-muted-foreground" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border border-border">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <Icon className={`w-5 h-5 ${color}`} />
              <div>
                <p className="text-xl font-bold leading-none">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quiz list */}
      {quizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-4 text-center border-2 border-dashed border-border rounded-2xl p-8">
          <Brain className="w-10 h-10 text-muted-foreground opacity-30" />
          <div>
            <p className="font-semibold">No quizzes yet</p>
            <p className="text-sm text-muted-foreground mt-1">Upload a PDF and let AI generate your first quiz.</p>
          </div>
          <Button size="sm" className="cursor-pointer gap-2" onClick={() => setShowGenerator(true)}>
            <Plus className="w-4 h-4" /> Generate First Quiz
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(quizzesByCourse).map(([cid, { course, quizList }]) => (
            <div key={cid} className="border border-border rounded-2xl overflow-hidden">
              {/* Course header */}
              <div className="px-4 py-3 bg-muted/40 flex items-center gap-2 flex-wrap">
                <BookOpen className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="font-semibold text-sm">{course?.title ?? "Unknown Course"}</span>
                {course?.category && (
                  <Badge variant="secondary" className="text-xs">{course.category}</Badge>
                )}
                {course?.semester && (
                  <Badge className={
                    course.semester === "first"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs"
                      : course.semester === "second"
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs"
                      : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs"
                  }>{semLabel(course.semester)}</Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground">{quizList.length} quiz{quizList.length !== 1 ? "zes" : ""}</span>
              </div>
              <div className="p-3 space-y-2">
                {quizList.map(quiz => (
                  <QuizListItem
                    key={quiz._id}
                    quiz={quiz}
                    courseTitle={getCourseTitle(quiz.courseId)}
                    onPreview={() => setPreviewQuizId(quiz._id)}
                    onViewScores={() => setScoresQuizId(quiz._id)}
                    onSettings={() => setSettingsQuizId(quiz._id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual Quiz Creator Dialog */}
      <Dialog open={showManualCreator} onOpenChange={setShowManualCreator}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="w-5 h-5 text-primary" /> Create Quiz Manually
            </DialogTitle>
          </DialogHeader>
          <ManualQuizCreator
            courses={(courses as Doc<"courses">[] | undefined) ?? []}
            onSuccess={(quizId) => { setShowManualCreator(false); setPreviewQuizId(quizId); }}
            onCancel={() => setShowManualCreator(false)}
          />
        </DialogContent>
      </Dialog>

      {/* AI Generator Dialog */}
      <Dialog open={showGenerator} onOpenChange={setShowGenerator}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> AI Quiz Generator
            </DialogTitle>
          </DialogHeader>
          <AiQuizGenerator
            onSuccess={(quizId) => { setShowGenerator(false); setPreviewQuizId(quizId); }}
            onCancel={() => setShowGenerator(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Quiz Preview Dialog */}
      {previewQuizId && (
        <Dialog open={!!previewQuizId} onOpenChange={() => setPreviewQuizId(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Quiz Preview</DialogTitle></DialogHeader>
            <QuizPreview quizId={previewQuizId} onClose={() => setPreviewQuizId(null)} />
          </DialogContent>
        </Dialog>
      )}

      {/* Scores Dialog */}
      {scoresQuiz && (
        <ScoresDialog quiz={scoresQuiz} onClose={() => setScoresQuizId(null)} />
      )}

      {/* Quiz Settings Dialog */}
      {settingsQuiz && (
        <QuizSettingsDialog quiz={settingsQuiz} onClose={() => setSettingsQuizId(null)} />
      )}
    </div>
  );
}

export default function QuizBankPage() {
  return (
    <Authenticated>
      <QuizBankInner />
    </Authenticated>
  );
}
