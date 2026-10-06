import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { format } from "date-fns";

type Props = {
  sessionId: Id<"liveSessions">;
  hostId: Id<"users">;
  hostName: string;
  isStaff: boolean;
};

type Message = {
  _id: string;
  senderId: Id<"users">;
  senderName: string;
  recipientId?: Id<"users">;
  body: string;
  createdAt: string;
  mine: boolean;
};

// Group chat for the class plus private messages between students and the host
export default function LiveChat({ sessionId, hostId, hostName, isStaff }: Props) {
  const messages = useQuery(api.live.listMessages, { sessionId });
  const send = useMutation(api.live.sendMessage);
  const [tab, setTab] = useState<"everyone" | "private">("everyone");
  const [draft, setDraft] = useState("");
  // Staff pick which student they are replying to in the private tab
  const [peerId, setPeerId] = useState<Id<"users"> | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const privateMsgs = useMemo(() => (messages ?? []).filter((m) => m.recipientId), [messages]);
  const groupMsgs = useMemo(() => (messages ?? []).filter((m) => !m.recipientId), [messages]);

  // Conversations for staff: one per student who exchanged private messages
  const conversations = useMemo(() => {
    const map = new Map<Id<"users">, { name: string; count: number }>();
    privateMsgs.forEach((m) => {
      if (m.mine && m.recipientId) return;
      const prev = map.get(m.senderId);
      map.set(m.senderId, { name: m.senderName, count: (prev?.count ?? 0) + 1 });
    });
    return [...map.entries()];
  }, [privateMsgs]);

  const activePeer = isStaff ? peerId : hostId;
  const visible: Message[] =
    tab === "everyone"
      ? groupMsgs
      : privateMsgs.filter((m) => m.senderId === activePeer || m.recipientId === activePeer);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visible.length, tab]);

  const handleSend = async () => {
    if (!draft.trim()) return;
    if (tab === "private" && !activePeer) {
      toast.error("Choose a student to reply to");
      return;
    }
    try {
      await send({
        sessionId,
        body: draft,
        recipientId: tab === "private" ? (activePeer ?? undefined) : undefined,
      });
      setDraft("");
    } catch {
      toast.error("Message not sent");
    }
  };

  return (
    <div className="flex flex-col h-[480px] lg:h-[calc(100vh-14rem)] rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-2 border-b border-border">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "everyone" | "private")}>
          <TabsList className="w-full">
            <TabsTrigger value="everyone" className="flex-1 cursor-pointer">Everyone</TabsTrigger>
            <TabsTrigger value="private" className="flex-1 cursor-pointer">
              {isStaff ? "Private" : "Message host"}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === "private" && isStaff && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {conversations.length === 0 && (
              <p className="text-xs text-muted-foreground px-1">No private messages yet.</p>
            )}
            {conversations.map(([id, c]) => (
              <button
                key={id}
                onClick={() => setPeerId(id)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs border cursor-pointer",
                  peerId === id ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        {tab === "private" && !isStaff && (
          <p className="text-xs text-muted-foreground px-1 pt-2">Only you and {hostName} can see these.</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {messages === undefined ? null : visible.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center pt-6">No messages yet. Say hello!</p>
        ) : (
          visible.map((m) => (
            <div key={m._id} className={cn("flex flex-col max-w-[85%]", m.mine ? "ml-auto items-end" : "items-start")}>
              <span className="text-[10px] text-muted-foreground px-1">
                {m.mine ? "You" : m.senderName} · {format(new Date(m.createdAt), "h:mm a")}
              </span>
              <div
                className={cn(
                  "px-3 py-2 rounded-2xl text-sm break-words",
                  m.mine ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {m.body}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="p-2 border-t border-border flex gap-2">
        <Input
          placeholder={tab === "everyone" ? "Message everyone..." : "Private message..."}
          value={draft}
          maxLength={1000}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSend();
          }}
        />
        <Button size="icon" className="cursor-pointer flex-shrink-0" onClick={handleSend} aria-label="Send">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
