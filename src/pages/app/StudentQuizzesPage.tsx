import { useState, useEffect, useRef, useCallback } from "react";
import StudentAssignments from "@/pages/assignments/_components/student-assignments.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Brain,
  BookOpen,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Trophy,
  RotateCcw,
  ArrowLeft,
  AlertTriangle,
  Lock,
  Calendar,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import type { Id, Doc } from "@/convex/_generated/dataModel.d.ts";

// ── Types ────────────────────────────────────────────────────────────────────

type Answer = { questionId: Id<"questions">; selectedOption: number };

type QuizWithQuestions = Doc<"quizzes"> & {
  questions: Doc<"questions">[];
};

// ── Countdown timer hook ─────────────────────────────────────────────────────

function useCountdown(
  totalSeconds: number,
  onExpire: () => void,
  onFiveMinuteWarning: () => void,
) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const onExpireRef = useRef(onExpire);
  const onFiveMinRef = useRef(onFiveMinuteWarning);
  onExpireRef.current = onExpire;
  onFiveMinRef.current = onFiveMinuteWarning;
  const fiveMinFiredRef = useRef(false);

  useEffect(() => {
    if (totalSeconds <= 0) return;
    setRemaining(totalSeconds);
    fiveMinFiredRef.current = false;
    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        // Fire 5-minute warning exactly once
        if (next === 300 && !fiveMinFiredRef.current) {
          fiveMinFiredRef.current = true;
          onFiveMinRef.current();
        }
        if (next <= 0) {
          clearInterval(interval);
          onExpireRef.current();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [totalSeconds]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isCritical = remaining <= 60;
  const isWarning = remaining <= 300; // 5 min
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return { remaining, formatted, isCritical, isWarning };
}

// ── Result screen ────────────────────────────────────────────────────────────

function QuizResultScreen({
  quiz,
  result,
  canRetry,
  onRetry,
  onBack,
  timedOut,
}: {
  quiz: QuizWithQuestions;
  result: { score: number; totalPoints: number; percentage: number; passed: boolean };
  canRetry: boolean;
  onRetry: () => void;
  onBack: () => void;
  timedOut?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center max-w-sm mx-auto">
      <div className={cn(
        "w-20 h-20 rounded-full flex items-center justify-center",
        result.passed ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"
      )}>
        {result.passed
          ? <Trophy className="w-10 h-10 text-green-600 dark:text-green-400" />
          : <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />}
      </div>
      <div>
        <h2 className="text-2xl font-bold">{result.passed ? "Well done!" : "Keep Practising"}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {timedOut
            ? "Time ran out — your answers were automatically submitted."
            : result.passed ? "You passed the quiz." : "You didn't reach the passing score of 50%."}
        </p>
      </div>
      <div className="w-full bg-muted rounded-2xl p-6 space-y-3">
        <div className="text-5xl font-black">{result.percentage}%</div>
        <Progress value={result.percentage} className="h-3" />
        <p className="text-sm text-muted-foreground">{result.score} / {result.totalPoints} points</p>
      </div>
      <div className="flex gap-3 w-full">
        <Button variant="secondary" className="flex-1 cursor-pointer gap-2" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        {canRetry ? (
          <Button className="flex-1 cursor-pointer gap-2" onClick={onRetry}>
            <RotateCcw className="w-4 h-4" /> Retry
          </Button>
        ) : (
          <Button variant="secondary" className="flex-1 gap-2" disabled>
            <Lock className="w-4 h-4" /> Retry Disabled
          </Button>
        )}
      </div>
      {!canRetry && (
        <p className="text-xs text-muted-foreground">
          Retry is not enabled for this quiz. Contact your lecturer or admin.
        </p>
      )}
    </div>
  );
}

// ── Quiz taker ────────────────────────────────────────────────────────────────

function QuizTaker({
  quiz,
  onDone,
  onBack,
}: {
  quiz: QuizWithQuestions;
  onDone: () => void;
  onBack: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; totalPoints: number; percentage: number; passed: boolean } | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [attemptId, setAttemptId] = useState<Id<"quizAttempts"> | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  // retrying = true means we are in a fresh attempt after clicking Retry
  const [retrying, setRetrying] = useState(false);
  const [locked, setLocked] = useState(false);

  const submitAttempt = useMutation(api.attempts.submitQuizAttempt);
  const startAttemptMut = useMutation(api.attempts.startAttempt);
  const saveProgressMut = useMutation(api.attempts.saveProgress);
  const autoSubmitMut = useMutation(api.attempts.autoSubmitIfInProgress);
  const previousAttempt = useQuery(api.attempts.getMyAttemptForQuiz, { quizId: quiz._id });

  const questions = quiz.questions;
  const totalQ = questions.length;
  const currentQ = questions[currentIndex];
  const selectedOption = answers.find(a => a.questionId === currentQ?._id)?.selectedOption ?? -1;
  const timeLimitSeconds = (quiz.timeLimit ?? 0) * 60;

  // Start or resume an attempt on mount (only when quiz is active)
  const hasStarted = useRef(false);
  useEffect(() => {
    if (hasStarted.current || (previousAttempt !== undefined && !retrying)) return;
    hasStarted.current = true;
    startAttemptMut({ quizId: quiz._id, courseId: quiz.courseId })
      .then((res) => {
        setAttemptId(res.attemptId);
        setStartedAt(res.startedAt);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to start quiz");
        onBack();
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retrying]);

  // Compute remaining time from the server-recorded startedAt when resuming
  const effectiveTimeLimit = (() => {
    if (timeLimitSeconds <= 0 || !startedAt) return timeLimitSeconds;
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    const left = timeLimitSeconds - elapsed;
    return Math.max(0, left);
  })();

  // Submit with whatever answers are currently recorded
  const doSubmit = useCallback(async (currentAnswers: Answer[], wasTimedOut = false) => {
    if (locked) return;
    setSubmitting(true);
    setLocked(true);
    try {
      const filledAnswers = questions.map(q => {
        const found = currentAnswers.find(a => a.questionId === q._id);
        return found ?? { questionId: q._id, selectedOption: 0 };
      });
      const res = await submitAttempt({
        quizId: quiz._id,
        courseId: quiz.courseId,
        answers: filledAnswers,
        attemptId: attemptId ?? undefined,
      });
      if (wasTimedOut) toast.warning("Time's up! Your quiz was automatically submitted.");
      setResult(res);
      setTimedOut(wasTimedOut);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit quiz");
      setLocked(false);
    } finally {
      setSubmitting(false);
    }
  }, [locked, questions, submitAttempt, quiz._id, quiz.courseId, attemptId]);

  // Auto-submit on timer expire
  const handleTimerExpire = useCallback(() => {
    setTimedOut(true);
  }, []);

  // 5-minute warning toast
  const handleFiveMinWarning = useCallback(() => {
    toast.warning("⏰ 5 minutes remaining! Wrap up and submit your quiz.", { duration: 8000 });
  }, []);

  const { formatted, isCritical, isWarning } = useCountdown(
    startedAt ? effectiveTimeLimit : 0,
    handleTimerExpire,
    handleFiveMinWarning,
  );

  // Trigger auto-submit when timer expires
  useEffect(() => {
    if (timedOut && !submitting && !result) {
      doSubmit(answers, true);
    }
  }, [timedOut, submitting, result, answers, doSubmit]);

  // Auto-save progress every time answers change
  useEffect(() => {
    if (!attemptId || answers.length === 0) return;
    saveProgressMut({ attemptId, answers }).catch(() => {/* silent */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);

  // Submit in-progress attempt when the student navigates away (page visibility / beforeunload)
  useEffect(() => {
    if (!attemptId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && !locked) {
        // Fire-and-forget auto-submit with current answers
        autoSubmitMut({ attemptId, answers }).catch(() => {/* silent */});
      }
    };

    const handleBeforeUnload = () => {
      if (!locked) {
        autoSubmitMut({ attemptId, answers }).catch(() => {/* silent */});
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [attemptId, answers, locked, autoSubmitMut]);

  const handleSelect = (optionIdx: number) => {
    if (locked) return;
    setAnswers(prev => {
      const filtered = prev.filter(a => a.questionId !== currentQ._id);
      return [...filtered, { questionId: currentQ._id, selectedOption: optionIdx }];
    });
  };

  const handleSubmit = async () => {
    if (answers.length < totalQ) {
      toast.error("Please answer all questions before submitting.");
      return;
    }
    await doSubmit(answers, false);
  };

  if (result) {
    return (
      <QuizResultScreen
        quiz={quiz}
        result={result}
        canRetry={!!quiz.retryAllowed}
        timedOut={timedOut}
        onRetry={() => {
          setResult(null);
          setAnswers([]);
          setCurrentIndex(0);
          setTimedOut(false);
          setLocked(false);
          setAttemptId(null);
          setStartedAt(null);
          hasStarted.current = false;
          setRetrying(true);
        }}
        onBack={onDone}
      />
    );
  }

  // Show previous completed attempt screen (but not while actively retrying or mid-attempt)
  if (previousAttempt && answers.length === 0 && !retrying && !attemptId) {
    const canRetry = !!quiz.retryAllowed;
    return (
      <div className="space-y-4 max-w-xl mx-auto">
        <Button variant="ghost" size="sm" className="cursor-pointer gap-1 -ml-1" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" /> Back to Courses
        </Button>
        <Card className="border border-border">
          <CardContent className="pt-6 pb-6 text-center space-y-4">
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center mx-auto",
              previousAttempt.passed ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"
            )}>
              {previousAttempt.passed
                ? <Trophy className="w-8 h-8 text-green-600" />
                : <XCircle className="w-8 h-8 text-red-600" />}
            </div>
            <div>
              <h3 className="font-bold text-lg">{quiz.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">Your last attempt</p>
            </div>
            <div className="text-4xl font-black">{previousAttempt.percentage}%</div>
            <Progress value={previousAttempt.percentage ?? 0} className="h-3" />
            <p className="text-sm text-muted-foreground">{previousAttempt.score} / {previousAttempt.totalPoints} points</p>
            <Badge className={cn("text-xs", previousAttempt.passed
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
              {previousAttempt.passed ? "Passed" : "Failed"}
            </Badge>
            {canRetry ? (
              <Button className="cursor-pointer gap-2 w-full" onClick={() => { hasStarted.current = false; setRetrying(true); }}>
                <RotateCcw className="w-4 h-4" /> Attempt Again
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <Button variant="secondary" className="w-full gap-2" disabled>
                  <Lock className="w-4 h-4" /> Retry Disabled
                </Button>
                <p className="text-xs text-muted-foreground">Contact your lecturer or admin to enable retries.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const answeredCount = answers.length;

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer gap-1 -ml-1"
          onClick={() => {
            // Auto-submit when navigating back mid-quiz
            if (attemptId && !locked) {
              autoSubmitMut({ attemptId, answers }).then((res) => {
                if (res) {
                  toast.info(`Quiz auto-submitted. Score: ${res.percentage}%`);
                }
              }).catch(() => {/* silent */});
            }
            onBack();
          }}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-lg truncate">{quiz.title}</h2>
          <p className="text-xs text-muted-foreground">Question {currentIndex + 1} of {totalQ}</p>
        </div>
        {/* Live countdown timer */}
        {timeLimitSeconds > 0 && startedAt && (
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold tabular-nums transition-colors",
            isCritical
              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse"
              : isWarning
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-muted text-foreground"
          )}>
            <Clock className="w-4 h-4 flex-shrink-0" />
            {formatted}
          </div>
        )}
      </div>

      <Progress value={((currentIndex + 1) / totalQ) * 100} className="h-2" />

      {/* 5-minute warning banner */}
      {isWarning && !isCritical && timeLimitSeconds > 0 && startedAt && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          5 minutes remaining — finish up and submit soon!
        </div>
      )}

      {/* Critical 1-minute warning banner */}
      {isCritical && timeLimitSeconds > 0 && startedAt && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Less than 1 minute remaining — your quiz will auto-submit when time runs out!
        </div>
      )}

      {/* Question card */}
      {currentQ && (
        <Card className="border border-border">
          <CardContent className="pt-6 pb-6 space-y-5">
            <p className="font-semibold text-base leading-relaxed">{currentQ.questionText}</p>
            <div className="space-y-2.5">
              {currentQ.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  disabled={locked}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl border text-sm transition-all",
                    locked ? "cursor-default opacity-70" : "cursor-pointer",
                    selectedOption === idx
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  )}
                >
                  <span className={cn(
                    "inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold mr-2 flex-shrink-0",
                    selectedOption === idx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <Button
          variant="secondary"
          className="cursor-pointer gap-1"
          onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </Button>
        {currentIndex < totalQ - 1 ? (
          <Button
            className="flex-1 cursor-pointer gap-1"
            onClick={() => setCurrentIndex(i => Math.min(totalQ - 1, i + 1))}
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            className="flex-1 cursor-pointer gap-2"
            onClick={handleSubmit}
            disabled={submitting || locked || answeredCount < totalQ}
          >
            <CheckCircle2 className="w-4 h-4" />
            {submitting ? "Submitting..." : "Submit Quiz"}
          </Button>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {answeredCount} of {totalQ} questions answered
      </p>
    </div>
  );
}

// ── Quiz card (list item) ─────────────────────────────────────────────────────

function QuizCard({ quiz, onStart }: { quiz: Doc<"quizzes">; onStart: () => void }) {
  const attempt = useQuery(api.attempts.getMyAttemptForQuiz, { quizId: quiz._id });
  const attemptCount = useQuery(api.attempts.getMyAttemptCountForQuiz, { quizId: quiz._id });
  const hasAttempt = !!attempt;
  const canRetry = !!quiz.retryAllowed;
  const maxAttempts = quiz.maxAttempts;
  const attemptsUsed = attemptCount ?? 0;
  const maxReached = maxAttempts !== undefined && attemptsUsed >= maxAttempts;

  // Schedule info
  const now = new Date();
  const availableFrom = quiz.availableFrom ? new Date(quiz.availableFrom) : null;
  const availableUntil = quiz.availableUntil ? new Date(quiz.availableUntil) : null;
  const notYetAvailable = availableFrom && now < availableFrom;
  const expired = availableUntil && now > availableUntil;
  const isLocked = notYetAvailable || expired || maxReached;

  return (
    <Card className="border border-border hover:shadow-sm transition-shadow">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{quiz.title}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><ListChecks className="w-3 h-3" />{quiz.questionCount} questions</span>
              {quiz.timeLimit && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{quiz.timeLimit} min</span>}
              <span className="flex items-center gap-1"><Trophy className="w-3 h-3" />{quiz.totalPoints} pts</span>
              {maxAttempts !== undefined && (
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  {attemptsUsed}/{maxAttempts} attempts
                </span>
              )}
              <span className="flex items-center gap-1">
                {canRetry
                  ? <><RotateCcw className="w-3 h-3 text-green-500" /><span className="text-green-600 dark:text-green-400">Retry on</span></>
                  : <><Lock className="w-3 h-3 text-muted-foreground" />No retry</>}
              </span>
            </div>
            {/* Schedule info */}
            {(availableFrom || availableUntil) && (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {availableFrom && (
                  <span className={cn("flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded", notYetAvailable ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-muted text-muted-foreground")}>
                    <Calendar className="w-2.5 h-2.5" />
                    Opens: {availableFrom.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                  </span>
                )}
                {availableUntil && (
                  <span className={cn("flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded", expired ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-muted text-muted-foreground")}>
                    <Calendar className="w-2.5 h-2.5" />
                    Due: {availableUntil.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                  </span>
                )}
              </div>
            )}
            {hasAttempt && (
              <div className="mt-2">
                <Badge className={cn("text-xs", attempt.passed
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                )}>
                  {attempt.passed ? "Passed" : "Failed"} — {attempt.percentage}%
                </Badge>
              </div>
            )}
          </div>
          <Button
            size="sm"
            className="h-8 text-xs cursor-pointer gap-1 shrink-0"
            onClick={onStart}
            disabled={(hasAttempt && !canRetry) || isLocked}
          >
            {isLocked
              ? <><Lock className="w-3.5 h-3.5" /> {notYetAvailable ? "Not open" : expired ? "Closed" : "Max reached"}</>
              : hasAttempt
              ? canRetry ? <><RotateCcw className="w-3.5 h-3.5" /> Retry</> : <><Lock className="w-3.5 h-3.5" /> Locked</>
              : <><Brain className="w-3.5 h-3.5" /> Start</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Course quiz list ──────────────────────────────────────────────────────────

function CourseQuizList({
  courseId,
  courseName,
  onBack,
}: {
  courseId: Id<"courses">;
  courseName: string;
  onBack: () => void;
}) {
  const quizzes = useQuery(api.quizzes.getPublishedQuizzesByCourse, { courseId });
  const [activeQuizId, setActiveQuizId] = useState<Id<"quizzes"> | null>(null);
  const activeQuizData = useQuery(
    api.quizzes.getQuizWithQuestions,
    activeQuizId ? { quizId: activeQuizId } : "skip"
  );

  if (activeQuizId) {
    if (activeQuizData === undefined) {
      return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
    }
    if (!activeQuizData) return <p className="text-muted-foreground text-sm">Quiz not found.</p>;
    return (
      <QuizTaker
        quiz={activeQuizData as QuizWithQuestions}
        onDone={() => setActiveQuizId(null)}
        onBack={() => setActiveQuizId(null)}
      />
    );
  }

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <Button variant="ghost" size="sm" className="cursor-pointer gap-1 -ml-1" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" /> My Courses
      </Button>
      <div>
        <h2 className="text-xl font-bold">{courseName}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Available quizzes</p>
      </div>

      {quizzes === undefined ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : quizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[25vh] gap-3 text-center border-2 border-dashed border-border rounded-2xl p-8">
          <Brain className="w-8 h-8 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">No quizzes published for this course yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quizzes.map(quiz => (
            <QuizCard key={quiz._id} quiz={quiz as Doc<"quizzes">} onStart={() => setActiveQuizId(quiz._id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Enrolled course cards ─────────────────────────────────────────────────────

type CourseWithQuizCount = Doc<"courses"> & { publishedQuizCount: number };

function StudentQuizzesInner() {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const enrolledCourses = useQuery(
    api.courses.getEnrolledCoursesWithQuizzes,
    currentUser !== undefined ? {} : "skip"
  );
  const [selectedCourse, setSelectedCourse] = useState<{ id: Id<"courses">; title: string } | null>(null);
  const [section, setSection] = useState<"quizzes" | "assignments">("quizzes");

  if (currentUser === undefined || enrolledCourses === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  if (selectedCourse) {
    return (
      <CourseQuizList
        courseId={selectedCourse.id}
        courseName={selectedCourse.title}
        onBack={() => setSelectedCourse(null)}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Assessments</h1>
        <p className="text-muted-foreground mt-1">Take quizzes, submit assignments and see your scores.</p>
      </div>
      <Tabs value={section} onValueChange={(v) => setSection(v as "quizzes" | "assignments")}>
        <TabsList>
          <TabsTrigger value="quizzes" className="cursor-pointer">Quizzes</TabsTrigger>
          <TabsTrigger value="assignments" className="cursor-pointer">Assignments and scores</TabsTrigger>
        </TabsList>
      </Tabs>
      {section === "assignments" ? <StudentAssignments /> : (
      <>

      {enrolledCourses.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[35vh] gap-4 text-center border-2 border-dashed border-border rounded-2xl p-8">
          <BookOpen className="w-10 h-10 text-muted-foreground opacity-30" />
          <div>
            <p className="font-semibold">No enrolled courses</p>
            <p className="text-sm text-muted-foreground mt-1">Request access to courses from the Courses page to get started.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(enrolledCourses as CourseWithQuizCount[]).map(course => (
            <Card
              key={course._id}
              className="border border-border hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer"
              onClick={() => setSelectedCourse({ id: course._id, title: course.title })}
            >
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{course.title}</p>
                    <Badge variant="secondary" className="text-xs mt-0.5">{course.category}</Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Brain className="w-3.5 h-3.5" />
                    {course.publishedQuizCount} quiz{course.publishedQuizCount !== 1 ? "zes" : ""} available
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}

export default function StudentQuizzesPage() {
  return (
    <Authenticated>
      <StudentQuizzesInner />
    </Authenticated>
  );
}
