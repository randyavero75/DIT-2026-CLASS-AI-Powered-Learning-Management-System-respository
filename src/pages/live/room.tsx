import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { toast } from "sonner";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, AlertTriangle, Circle, Square } from "lucide-react";
import { useLiveRoom } from "./_hooks/use-live-room.ts";
import { useRecorder } from "./_hooks/use-recorder.ts";
import LiveChat from "./_components/live-chat.tsx";

function MediaTile({
  stream,
  label,
  muted,
  showVideo,
}: {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  showVideo: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative aspect-video rounded-2xl overflow-hidden bg-sidebar border border-border">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={showVideo ? "w-full h-full object-cover" : "hidden"}
      />
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center text-3xl font-bold">
            {label.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <span className="absolute bottom-2 left-2 text-xs px-2 py-1 rounded-md bg-black/60 text-white">{label}</span>
    </div>
  );
}

function Room({ sessionId }: { sessionId: Id<"liveSessions"> }) {
  const navigate = useNavigate();
  const session = useQuery(api.live.getSession, { sessionId });
  const endSession = useMutation(api.live.endSession);
  const room = useLiveRoom(sessionId, session?.mode);
  const setRecordingFlag = useMutation(api.live.setRecording);
  const recorder = useRecorder(room.localStream, room.remoteStreams, session?.title ?? "class");

  const toggleRecording = async () => {
    if (recorder.recording) {
      recorder.stop();
      await setRecordingFlag({ sessionId, isRecording: false });
      toast.success("Recording saved to your device");
    } else if (recorder.start()) {
      await setRecordingFlag({ sessionId, isRecording: true });
    } else {
      toast.error("Recording is not supported in this browser");
    }
  };

  // Everyone leaves when the host ends the class
  useEffect(() => {
    if (session?.status === "ended") {
      toast.info("This class has ended");
      navigate("/live");
    }
  }, [session?.status, navigate]);

  if (session === undefined) return <Skeleton className="h-96 w-full" />;
  if (session === null) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="font-semibold">Class not found</p>
        <p className="text-sm text-muted-foreground">It may belong to another institution. Use the switcher in the sidebar.</p>
        <Button className="cursor-pointer" onClick={() => navigate("/live")}>Back to live classes</Button>
      </div>
    );
  }

  if (room.state.status === "error") {
    return (
      <div className="text-center py-20 space-y-3 max-w-md mx-auto">
        <AlertTriangle className="w-10 h-10 mx-auto text-destructive" />
        <p className="text-sm text-muted-foreground">{room.state.message}</p>
        <Button className="cursor-pointer" onClick={() => navigate("/live")}>Back</Button>
      </div>
    );
  }

  const isVideo = session.mode === "video";
  const others = (room.participants ?? []).filter((p) => p.peerId !== room.peerId);

  const handleEnd = async () => {
    try {
      await endSession({ sessionId });
    } catch {
      toast.error("Could not end the class");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{session.title}</h1>
          <p className="text-sm text-muted-foreground">Hosted by {session.hostName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Users className="w-3 h-3" /> {room.participants?.length ?? 1}
          </Badge>
          <Badge>{isVideo ? "Video" : "Audio"}</Badge>
          {session.isRecording && (
            <Badge variant="destructive" className="gap-1"><Circle className="w-2.5 h-2.5 fill-current" /> Recording</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
      <div className="space-y-4 min-w-0">
      {room.state.status === "starting" ? (
        <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
          <Spinner /> Connecting...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <MediaTile
            stream={room.localStream}
            label="You"
            muted
            showVideo={isVideo && room.camOn}
          />
          {others.map((p) => (
            <MediaTile
              key={p.peerId}
              stream={room.remoteStreams[p.peerId] ?? null}
              label={p.name}
              showVideo={isVideo && !!room.remoteStreams[p.peerId]}
            />
          ))}
        </div>
      )}
      </div>
      <LiveChat
        sessionId={sessionId}
        hostId={session.hostId}
        hostName={session.hostName}
        isStaff={session.canRecord}
      />
      </div>

      <div className="flex justify-center gap-3 sticky bottom-4">
        <Button
          size="lg"
          variant={room.micOn ? "secondary" : "destructive"}
          className="cursor-pointer rounded-full"
          onClick={room.toggleMic}
        >
          {room.micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </Button>
        {isVideo && (
          <Button
            size="lg"
            variant={room.camOn ? "secondary" : "destructive"}
            className="cursor-pointer rounded-full"
            onClick={room.toggleCam}
          >
            {room.camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </Button>
        )}
        {session.canRecord && (
          <Button
            size="lg"
            variant={recorder.recording ? "destructive" : "secondary"}
            className="cursor-pointer rounded-full gap-2"
            onClick={toggleRecording}
          >
            {recorder.recording ? <Square className="w-4 h-4" /> : <Circle className="w-4 h-4 text-destructive" />}
            {recorder.recording ? "Stop" : "Record"}
          </Button>
        )}
        <Button
          size="lg"
          variant="secondary"
          className="cursor-pointer rounded-full gap-2"
          onClick={() => navigate("/live")}
        >
          <PhoneOff className="w-5 h-5" /> Leave
        </Button>
        {session.canEnd && (
          <Button size="lg" variant="destructive" className="cursor-pointer rounded-full" onClick={handleEnd}>
            End for all
          </Button>
        )}
      </div>
    </div>
  );
}

export default function LiveRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return (
    <>
      <AuthLoading><Skeleton className="h-96 w-full" /></AuthLoading>
      <Unauthenticated>
        <div className="text-center py-20 space-y-3">
          <p>Sign in to join the class</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <Authenticated>
        {sessionId && <Room sessionId={sessionId as Id<"liveSessions">} />}
      </Authenticated>
    </>
  );
}
