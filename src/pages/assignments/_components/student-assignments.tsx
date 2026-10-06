import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { toast } from "sonner";
import { ClipboardList, Paperclip, Upload, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { DueBadge } from "./staff-assignments.tsx";

const errMsg = (e: unknown, fallback: string) =>
  e instanceof ConvexError ? (e.data as { message: string }).message : fallback;

type StudentAssignment = NonNullable<ReturnType<typeof useQuery<typeof api.assignments.listForStudent>>>[number];

function SubmitBox({ a }: { a: StudentAssignment }) {
  const generateUrl = useMutation(api.assignments.generateUploadUrl);
  const submit = useMutation(api.assignments.submit);
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const closed = Date.now() > Date.parse(a.dueAt);
  const graded = a.submission?.score !== undefined;

  const handleSubmit = async () => {
    if (files.length === 0) {
      toast.error("Choose at least one file");
      return;
    }
    const bad = files.find((f) => !a.allowedFormats.includes(f.name.split(".").pop()?.toLowerCase() ?? ""));
    if (bad) {
      toast.error(`${bad.name} is not an accepted format (${a.allowedFormats.join(", ")})`);
      return;
    }
    setBusy(true);
    try {
      const uploaded: { storageId: Id<"_storage">; fileName: string }[] = [];
      for (const f of files) {
        const url = await generateUrl();
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": f.type || "application/octet-stream" },
          body: f,
        });
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        uploaded.push({ storageId, fileName: f.name });
      }
      await submit({ assignmentId: a._id, note, files: uploaded });
      toast.success(closed ? "Submitted (marked late)" : "Submitted");
      setFiles([]);
      setNote("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      toast.error(errMsg(e, "Upload failed"));
    } finally {
      setBusy(false);
    }
  };

  if (graded) return null;

  return (
    <div className="space-y-2 pt-2 border-t border-border">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={a.allowedFormats.map((f) => `.${f}`).join(",")}
        className="text-xs block w-full"
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />
      <Textarea rows={2} placeholder="Note to lecturer (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button size="sm" className="cursor-pointer gap-2" disabled={busy} onClick={handleSubmit}>
        <Upload className="w-3.5 h-3.5" />
        {busy ? "Uploading..." : a.submission ? "Replace submission" : closed ? "Submit late" : "Submit"}
      </Button>
    </div>
  );
}

export default function StudentAssignments() {
  const list = useQuery(api.assignments.listForStudent, {});

  if (list === undefined) return <Skeleton className="h-24 w-full" />;
  if (list.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><ClipboardList /></EmptyMedia>
          <EmptyTitle>No assignments yet</EmptyTitle>
          <EmptyDescription>Assignments from your enrolled courses will appear here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {list.map((a) => {
        const sub = a.submission;
        return (
          <Card key={a._id}>
            <CardContent className="py-4 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.courseTitle}</p>
                </div>
                <DueBadge dueAt={a.dueAt} />
              </div>
              {a.instructions && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.instructions}</p>}
              <p className="text-xs text-muted-foreground">Accepted: {a.allowedFormats.map((f) => `.${f}`).join(", ")}</p>

              {sub && (
                <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    Submitted {format(new Date(sub.submittedAt), "MMM d, h:mm a")}
                    {sub.isLate && <Badge variant="destructive">Late</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sub.files.map((f) => (
                      <a key={f.storageId} href={f.url ?? undefined} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-background cursor-pointer">
                        <Paperclip className="w-3 h-3" /> {f.fileName}
                      </a>
                    ))}
                  </div>
                  {sub.score !== undefined ? (
                    <div>
                      <p className="text-sm font-bold">Score: {sub.score} / {a.maxScore}</p>
                      {sub.feedback && <p className="text-xs text-muted-foreground">Feedback: {sub.feedback}</p>}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Awaiting grading</p>
                  )}
                </div>
              )}
              <SubmitBox a={a} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
