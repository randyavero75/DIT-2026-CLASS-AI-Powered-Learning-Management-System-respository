import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { toast } from "sonner";
import { Video, Mic, Radio, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type Mode = "video" | "audio";

function StartClassCard() {
  const startSession = useMutation(api.live.startSession);
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<Mode>("video");
  const [loading, setLoading] = useState(false);
  // "all" | "course:<id>" | "program:<id>"
  const [audience, setAudience] = useState("all");
  const courses = useQuery(api.courses.getAllCoursesForLecturer, {});
  const programs = useQuery(api.programCategories.listForCurrentOrg, {});

  const handleStart = async () => {
    if (!title.trim()) {
      toast.error("Give your class a title");
      return;
    }
    setLoading(true);
    try {
      const [kind, targetId] = audience.split(":");
      const id = await startSession({
        title,
        mode,
        courseId: kind === "course" ? (targetId as Id<"courses">) : undefined,
        programId: kind === "program" ? (targetId as Id<"programCategories">) : undefined,
      });
      navigate(`/live/${id}`);
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Could not start the class");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary" /> Host a live class
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="live-title">Class title</Label>
          <Input
            id="live-title"
            placeholder="e.g. Week 4 - Organic Chemistry"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Who can join</Label>
          <Select value={audience} onValueChange={setAudience}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Whole institution</SelectItem>
              {(programs ?? []).map((pr) => (
                <SelectItem key={pr._id} value={"program:" + pr._id}>Program: {pr.name}</SelectItem>
              ))}
              {(courses ?? []).map((c) => (
                <SelectItem key={c._id} value={"course:" + c._id}>Course: {c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {(["video", "audio"] as const).map((m) => (
            <Button
              key={m}
              type="button"
              variant={mode === m ? "default" : "secondary"}
              className="cursor-pointer gap-2 flex-1"
              onClick={() => setMode(m)}
            >
              {m === "video" ? <Video className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {m === "video" ? "Video" : "Audio only"}
            </Button>
          ))}
        </div>
        <Button className="cursor-pointer w-full" disabled={loading} onClick={handleStart}>
          {loading ? "Starting..." : "Go live"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ActiveClasses() {
  const sessions = useQuery(api.live.listActiveSessions, {});
  const navigate = useNavigate();

  if (sessions === undefined) {
    return <Skeleton className="h-24 w-full" />;
  }
  if (sessions.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Video /></EmptyMedia>
          <EmptyTitle>No live classes right now</EmptyTitle>
          <EmptyDescription>Classes hosted in your institution will appear here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="space-y-3">
      {sessions.map((s) => (
        <Card key={s._id}>
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="font-semibold truncate">{s.title}</p>
              <p className="text-xs text-muted-foreground">
                {s.isHost ? "You are hosting" : `Hosted by ${s.hostName}`} · {s.audience}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="secondary" className="gap-1">
                {s.mode === "video" ? <Video className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                {s.mode === "video" ? "Video" : "Audio"}
              </Badge>
              <Button size="sm" className="cursor-pointer" onClick={() => navigate(`/live/${s._id}`)}>
                {s.isHost ? "Rejoin" : "Join"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LiveInner() {
  const user = useQuery(api.users.getCurrentUser, {});
  const canHost = user?.role === "admin" || user?.role === "lecturer" || user?.role === "superadmin";
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Live Classes</h1>
        <p className="text-sm text-muted-foreground">Join or host online lectures for your institution.</p>
      </div>
      {canHost && <StartClassCard />}
      <ActiveClasses />
    </div>
  );
}

export default function LivePage() {
  return (
    <>
      <AuthLoading><Skeleton className="h-64 w-full" /></AuthLoading>
      <Unauthenticated>
        <div className="text-center py-20 space-y-3">
          <p>Sign in to see live classes</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <Authenticated><LiveInner /></Authenticated>
    </>
  );
}
