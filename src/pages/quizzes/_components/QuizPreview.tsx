import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { CheckCircle2, XCircle, Clock, FileText, ListChecks } from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";

type Props = { quizId: Id<"quizzes">; onClose: () => void };

export default function QuizPreview({ quizId, onClose }: Props) {
  const quiz = useQuery(api.quizzes.getQuizWithQuestions, { quizId });

  if (quiz === undefined) {
    return (
      <div className="space-y-4 py-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }
  if (!quiz) return <p className="text-muted-foreground py-4">Quiz not found.</p>;

  return (
    <div className="space-y-5">
      {/* Meta */}
      <div className="flex flex-wrap gap-2 items-center">
        <Badge variant="secondary" className="gap-1"><ListChecks className="w-3 h-3" />{quiz.questionCount} questions</Badge>
        <Badge variant="secondary" className="gap-1"><CheckCircle2 className="w-3 h-3" />{quiz.totalPoints} pts</Badge>
        {quiz.timeLimit && <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />{quiz.timeLimit} min</Badge>}
        {quiz.sourcePdfName && <Badge variant="secondary" className="gap-1"><FileText className="w-3 h-3" />{quiz.sourcePdfName}</Badge>}
        <Badge className={quiz.published ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}>
          {quiz.published ? "Published" : "Draft"}
        </Badge>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {(quiz.questions as Doc<"questions">[]).map((q, i) => (
          <div key={q._id} className="border border-border rounded-xl p-4 space-y-3">
            <div className="flex gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <p className="font-medium text-sm leading-snug">{q.questionText}</p>
            </div>
            <div className="space-y-1.5 pl-8">
              {(q.options as string[]).map((opt, oi) => (
                <div
                  key={oi}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                    oi === q.correctOptionIndex
                      ? "bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800"
                      : "bg-muted/40"
                  }`}
                >
                  {oi === q.correctOptionIndex
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />}
                  {opt}
                </div>
              ))}
            </div>
            {q.explanation && (
              <p className="pl-8 text-xs text-muted-foreground italic">{q.explanation}</p>
            )}
          </div>
        ))}
      </div>

      <Button variant="secondary" className="w-full cursor-pointer" onClick={onClose}>Close Preview</Button>
    </div>
  );
}
