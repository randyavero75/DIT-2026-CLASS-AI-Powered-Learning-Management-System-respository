import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

type Mode = "video" | "audio";

export type RoomState =
  | { status: "starting" }
  | { status: "ready" }
  | { status: "error"; message: string };

// Peer-to-peer mesh call. Convex carries the signaling messages; media flows directly between browsers.
export function useLiveRoom(sessionId: Id<"liveSessions">, mode: Mode | undefined) {
  const [peerId] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<RoomState>({ status: "starting" });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const joinMut = useMutation(api.live.join);
  const leaveMut = useMutation(api.live.leave);
  const heartbeatMut = useMutation(api.live.heartbeat);
  const sendSignalMut = useMutation(api.live.sendSignal);
  const consumeMut = useMutation(api.live.consumeSignals);

  const ready = state.status === "ready";
  const participants = useQuery(api.live.listParticipants, ready ? { sessionId, peerId } : "skip");
  const signals = useQuery(api.live.mySignals, ready ? { sessionId, peerId } : "skip");

  const localRef = useRef<MediaStream | null>(null);
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const pendingCandidates = useRef(new Map<string, RTCIceCandidateInit[]>());
  const handled = useRef(new Set<string>());
  const chain = useRef<Promise<void>>(Promise.resolve());

  const dropPeer = useCallback((remote: string) => {
    pcs.current.get(remote)?.close();
    pcs.current.delete(remote);
    pendingCandidates.current.delete(remote);
    setRemoteStreams((prev) => {
      if (!(remote in prev)) return prev;
      const next = { ...prev };
      delete next[remote];
      return next;
    });
  }, []);

  const createPc = useCallback(
    (remote: string) => {
      const existing = pcs.current.get(remote);
      if (existing) return existing;
      const pc = new RTCPeerConnection(ICE_SERVERS);
      localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current!));
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        void sendSignalMut({
          sessionId,
          fromPeer: peerId,
          toPeer: remote,
          kind: "candidate",
          payload: JSON.stringify(e.candidate.toJSON()),
        });
      };
      pc.ontrack = (e) => {
        const stream = e.streams[0];
        if (stream) setRemoteStreams((prev) => ({ ...prev, [remote]: stream }));
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") dropPeer(remote);
      };
      pcs.current.set(remote, pc);
      return pc;
    },
    [dropPeer, peerId, sendSignalMut, sessionId],
  );

  // Acquire camera/mic, then register in the room
  useEffect(() => {
    if (!mode) return;
    let cancelled = false;
    const peerConnections = pcs.current;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: mode === "video",
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localRef.current = stream;
        setLocalStream(stream);
        await joinMut({ sessionId, peerId });
        if (!cancelled) setState({ status: "ready" });
      } catch {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              "Could not access your microphone or camera. Allow access in your browser settings and try again.",
          });
        }
      }
    };
    void start();

    return () => {
      cancelled = true;
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
      peerConnections.forEach((pc) => pc.close());
      peerConnections.clear();
      void leaveMut({ sessionId, peerId }).catch(() => undefined);
    };
  }, [mode, sessionId, peerId, joinMut, leaveMut]);

  // Keep-alive so others can tell when a tab was closed abruptly
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      void heartbeatMut({ sessionId, peerId }).catch(() => undefined);
    }, 15_000);
    return () => clearInterval(id);
  }, [ready, heartbeatMut, sessionId, peerId]);

  // Newer participants call older ones, so each pair negotiates exactly once
  useEffect(() => {
    if (!participants) return;
    const me = participants.find((p) => p.peerId === peerId);
    if (!me) return;
    const present = new Set(participants.map((p) => p.peerId));

    pcs.current.forEach((_, remote) => {
      if (!present.has(remote)) dropPeer(remote);
    });

    participants.forEach((p) => {
      if (p.peerId === peerId || pcs.current.has(p.peerId) || p.joinedAt >= me.joinedAt) return;
      const pc = createPc(p.peerId);
      const call = async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignalMut({
          sessionId,
          fromPeer: peerId,
          toPeer: p.peerId,
          kind: "offer",
          payload: JSON.stringify(offer),
        });
      };
      void call().catch(() => dropPeer(p.peerId));
    });
  }, [participants, peerId, createPc, dropPeer, sendSignalMut, sessionId]);

  // Process incoming offers, answers and ICE candidates in order
  useEffect(() => {
    if (!signals || signals.length === 0) return;
    const fresh = signals.filter((s) => !handled.current.has(s._id));
    if (fresh.length === 0) return;
    fresh.forEach((s) => handled.current.add(s._id));

    const flush = async (remote: string, pc: RTCPeerConnection) => {
      const queued = pendingCandidates.current.get(remote) ?? [];
      pendingCandidates.current.delete(remote);
      for (const c of queued) await pc.addIceCandidate(c);
    };

    const handle = async (s: (typeof fresh)[number]) => {
      const data: unknown = JSON.parse(s.payload);
      if (s.kind === "offer") {
        const pc = createPc(s.fromPeer);
        await pc.setRemoteDescription(data as RTCSessionDescriptionInit);
        await flush(s.fromPeer, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignalMut({
          sessionId,
          fromPeer: peerId,
          toPeer: s.fromPeer,
          kind: "answer",
          payload: JSON.stringify(answer),
        });
      } else if (s.kind === "answer") {
        const pc = pcs.current.get(s.fromPeer);
        if (!pc) return;
        await pc.setRemoteDescription(data as RTCSessionDescriptionInit);
        await flush(s.fromPeer, pc);
      } else {
        const pc = pcs.current.get(s.fromPeer);
        const candidate = data as RTCIceCandidateInit;
        if (pc?.remoteDescription) await pc.addIceCandidate(candidate);
        else {
          const list = pendingCandidates.current.get(s.fromPeer) ?? [];
          pendingCandidates.current.set(s.fromPeer, [...list, candidate]);
        }
      }
    };

    chain.current = chain.current.then(async () => {
      for (const s of fresh) {
        try {
          await handle(s);
        } catch {
          // A single bad message should not break the call
        }
      }
      await consumeMut({ sessionId, peerId, ids: fresh.map((s) => s._id) }).catch(() => undefined);
    });
  }, [signals, createPc, consumeMut, sendSignalMut, sessionId, peerId]);

  const toggleMic = () => {
    const next = !micOn;
    localRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  };

  const toggleCam = () => {
    const next = !camOn;
    localRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
  };

  return { peerId, state, localStream, remoteStreams, participants, micOn, camOn, toggleMic, toggleCam };
}
