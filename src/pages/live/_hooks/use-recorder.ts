import { useCallback, useEffect, useRef, useState } from "react";

// Records the host's view: their own video plus a mix of everyone's audio.
// Runs only in the recorder's browser and saves a file locally when stopped.
export function useRecorder(
  localStream: MediaStream | null,
  remoteStreams: Record<string, MediaStream>,
  fileLabel: string,
) {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const ctxRef = useRef<AudioContext | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const connectedRef = useRef(new Set<string>());

  const connect = useCallback((key: string, stream: MediaStream) => {
    const ctx = ctxRef.current;
    const dest = destRef.current;
    if (!ctx || !dest || connectedRef.current.has(key) || stream.getAudioTracks().length === 0) return;
    ctx.createMediaStreamSource(stream).connect(dest);
    connectedRef.current.add(key);
  }, []);

  // Pull in participants who join after recording started
  useEffect(() => {
    if (!recording) return;
    Object.entries(remoteStreams).forEach(([k, s]) => connect(k, s));
  }, [recording, remoteStreams, connect]);

  const start = useCallback(() => {
    if (!localStream || typeof MediaRecorder === "undefined") return false;
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    ctxRef.current = ctx;
    destRef.current = dest;
    connectedRef.current = new Set();
    connect("local", localStream);
    Object.entries(remoteStreams).forEach(([k, s]) => connect(k, s));

    const tracks = [...localStream.getVideoTracks(), ...dest.stream.getAudioTracks()];
    const recorder = new MediaRecorder(new MediaStream(tracks));
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileLabel.replace(/[^a-z0-9]+/gi, "-")}-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      void ctx.close();
    };
    recorder.start(1000);
    recorderRef.current = recorder;
    setRecording(true);
    return true;
  }, [localStream, remoteStreams, connect, fileLabel]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    setRecording(false);
  }, []);

  // Make sure the file is saved if the host leaves mid-recording
  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    };
  }, []);

  return { recording, start, stop };
}
