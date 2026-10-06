import { useState, useRef } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { toast } from "sonner";
import { Upload, FileText, Brain, Sparkles, X, Wand2 } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";

type Props = {
  onSuccess: (quizId: Id<"quizzes">) => void;
  onCancel: () => void;
};

export default function AiQuizGenerator({ onSuccess, onCancel }: Props) {
  const [step, setStep] = useState<"form" | "generating">("form");
  const [mode, setMode] = useState<"pdf" | "topic">("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);
  const [timeLimit, setTimeLimit] = useState<number | undefined>(undefined);
  const [courseId, setCourseId] = useState<Id<"courses"> | "">("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionStyle, setQuestionStyle] = useState<"standard" | "true_false" | "mixed">("standard");
  const [focusTopic, setFocusTopic] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const courses = useQuery(api.courses.getAllCoursesForLecturer, {});
  const generateUploadUrl = useMutation(api.quizzes.generateUploadUrl);
  const generateQuiz = useAction(api.ai.quizGenerator.generateQuizFromPdf as never);
  const generateQuizFromTopic = useAction(api.ai.topicQuizGenerator.generateQuizFromTopic);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
      if (!title) setTitle(selected.name.replace(".pdf", "").replace(/_/g, " "));
    } else if (selected) {
      toast.error("Please select a PDF file");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === "application/pdf") {
      setFile(dropped);
      if (!title) setTitle(dropped.name.replace(".pdf", "").replace(/_/g, " "));
    } else {
      toast.error("Please drop a PDF file");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !courseId) {
      toast.error("Please fill all required fields");
      return;
    }
    if (mode === "pdf" && !file) {
      toast.error("Please upload a PDF file");
      return;
    }
    if (mode === "topic" && !topic.trim()) {
      toast.error("Please enter a topic");
      return;
    }

    setStep("generating");
    try {
      let quizId: Id<"quizzes">;

      if (mode === "pdf") {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": "application/pdf" },
          body: file!,
        });
        const { storageId } = await result.json() as { storageId: Id<"_storage"> };

        quizId = await (generateQuiz as unknown as (args: Record<string, unknown>) => Promise<Id<"quizzes">>)({
          storageId,
          pdfName: file!.name,
          courseId: courseId as Id<"courses">,
          quizTitle: title,
          numQuestions,
          timeLimit: timeLimit ?? undefined,
          difficulty,
          questionStyle,
          focusTopic: focusTopic.trim() || undefined,
        });
      } else {
        quizId = await generateQuizFromTopic({
          courseId: courseId as Id<"courses">,
          quizTitle: title,
          topic: topic.trim(),
          numQuestions,
          timeLimit: timeLimit ?? undefined,
          difficulty,
          questionStyle,
        });
      }

      toast.success("Quiz generated successfully!");
      onSuccess(quizId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate quiz";
      toast.error(msg);
      setStep("form");
    }
  };

  if (step === "generating") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Brain className="w-8 h-8 text-primary animate-pulse" />
        </div>
        <div>
          <p className="font-bold text-lg">AI is generating your quiz...</p>
          <p className="text-muted-foreground text-sm mt-1">Generating {numQuestions} quiz questions. This may take 15–30 seconds.</p>
        </div>
        <Spinner />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("pdf")}
          className={cn(
            "flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer",
            mode === "pdf" ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"
          )}
        >
          <FileText className="w-4 h-4" />
          From PDF
        </button>
        <button
          type="button"
          onClick={() => setMode("topic")}
          className={cn(
            "flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer",
            mode === "topic" ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"
          )}
        >
          <Wand2 className="w-4 h-4" />
          From Topic
        </button>
      </div>

      {/* PDF Upload or Topic Input */}
      {mode === "pdf" ? (
        <div>
          <Label className="mb-2 block">Upload PDF <span className="text-destructive">*</span></Label>
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors",
              file ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"
            )}
          >
            {file ? (
              <>
                <FileText className="w-8 h-8 text-primary" />
                <div className="text-center">
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-muted-foreground cursor-pointer"
                  onClick={e => { e.stopPropagation(); setFile(null); }}
                >
                  <X className="w-3 h-3 mr-1" /> Remove
                </Button>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="font-medium text-sm">Drop your PDF here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Lecture notes, textbook chapters, research papers</p>
                </div>
              </>
            )}
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
          </div>
        </div>
      ) : (
        <div>
          <Label htmlFor="topic-input" className="mb-1.5 block">Topic / Subject <span className="text-destructive">*</span></Label>
          <Input
            id="topic-input"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. Photosynthesis, World War II causes, Algebra basics..."
          />
          <p className="text-xs text-muted-foreground mt-1">AI will generate questions based on this topic without needing a PDF.</p>
        </div>
      )}

      {/* Quiz title */}
      <div>
        <Label htmlFor="quiz-title" className="mb-1.5 block">Quiz Title <span className="text-destructive">*</span></Label>
        <Input
          id="quiz-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Chapter 3: Cell Biology Quiz"
          required
        />
      </div>

      {/* Course */}
      <div>
        <Label htmlFor="course-select" className="mb-1.5 block">Assign to Course <span className="text-destructive">*</span></Label>
        <select
          id="course-select"
          value={courseId}
          onChange={e => setCourseId(e.target.value as Id<"courses">)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          required
        >
          <option value="">Select a course...</option>
          {courses?.map((c: { _id: Id<"courses">; title: string; semester?: string; category?: string }) => {
            const sem = c.semester === "first" ? "1st Sem" : c.semester === "second" ? "2nd Sem" : c.semester === "full_term" ? "Full Term" : "";
            const label = `${c.title}${sem ? ` [${sem}]` : ""}${c.category ? ` — ${c.category}` : ""}`;
            return <option key={c._id} value={c._id}>{label}</option>;
          })}
        </select>
        {courses?.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">No courses yet. Create a course first.</p>
        )}
      </div>

      {/* Number of questions */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="num-questions" className="mb-1.5 block">Number of Questions</Label>
          <Input
            id="num-questions"
            type="number"
            min={3}
            max={30}
            value={numQuestions}
            onChange={e => setNumQuestions(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="time-limit" className="mb-1.5 block">Time Limit (minutes, optional)</Label>
          <Input
            id="time-limit"
            type="number"
            min={5}
            placeholder="No limit"
            value={timeLimit ?? ""}
            onChange={e => setTimeLimit(e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      {/* AI options */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-1.5 block">Difficulty</Label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm cursor-pointer"
          >
            <option value="easy">Easy (Recall)</option>
            <option value="medium">Medium (Comprehension)</option>
            <option value="hard">Hard (Analysis)</option>
          </select>
        </div>
        <div>
          <Label className="mb-1.5 block">Question Style</Label>
          <select
            value={questionStyle}
            onChange={(e) => setQuestionStyle(e.target.value as typeof questionStyle)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm cursor-pointer"
          >
            <option value="standard">Standard MCQ (4 options)</option>
            <option value="true_false">True / False</option>
            <option value="mixed">Mixed (MCQ + T/F)</option>
          </select>
        </div>
      </div>

      {mode === "pdf" && (
        <div>
          <Label className="mb-1.5 block">Focus Topic (optional)</Label>
          <Input
            placeholder="e.g. Cell division, World War II causes..."
            value={focusTopic}
            onChange={(e) => setFocusTopic(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">Ask the AI to focus on a specific topic within the PDF</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" className="cursor-pointer" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1 cursor-pointer gap-2"
          disabled={
            !title || !courseId ||
            (mode === "pdf" ? !file : !topic.trim())
          }
        >
          <Sparkles className="w-4 h-4" />
          Generate Quiz with AI
        </Button>
      </div>
    </form>
  );
}
