import { useState } from "react";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  MessageSquare,
  Plus,
  ThumbsUp,
  Trash2,
  Pin,
  ChevronRight,
  ArrowLeft,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const CATEGORIES = ["General", "Questions", "Announcements", "Resources", "Off-topic"];

type ThreadWithAuthor = {
  _id: Id<"forumThreads">;
  title: string;
  body: string;
  category?: string;
  upvotes: number;
  replyCount: number;
  isPinned?: boolean;
  createdAt: string;
  authorId: Id<"users">;
  authorName: string;
  authorAvatar?: string;
  orgId: Id<"organizations">;
};

type ReplyWithAuthor = {
  _id: Id<"forumReplies">;
  body: string;
  upvotes: number;
  createdAt: string;
  authorId: Id<"users">;
  authorName: string;
  authorAvatar?: string;
  threadId: Id<"forumThreads">;
  myVote: boolean;
};

function NewThreadDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("General");
  const [loading, setLoading] = useState(false);
  const createThread = useMutation(api.forum.createThread);

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Please fill in the title and content.");
      return;
    }
    setLoading(true);
    try {
      await createThread({ title, body, category });
      toast.success("Thread posted!");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post thread");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            New Discussion Thread
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <Input
            placeholder="Thread title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer border",
                  category === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <Textarea
            placeholder="What's on your mind? Ask a question, share a resource, or start a discussion..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose} disabled={loading} className="cursor-pointer">Cancel</Button>
            <Button onClick={handleSubmit} disabled={loading} className="cursor-pointer gap-1">
              <Send className="w-3.5 h-3.5" />
              {loading ? "Posting..." : "Post Thread"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ThreadDetail({
  thread: threadSnapshot,
  onBack,
  currentUser,
}: {
  thread: ThreadWithAuthor;
  onBack: () => void;
  currentUser: { _id: Id<"users">; role?: string } | null | undefined;
}) {
  // Live copy so vote counts update immediately; snapshot is a fallback while loading
  const liveThread = useQuery(api.forum.getThread, { threadId: threadSnapshot._id });
  const thread = { ...threadSnapshot, ...(liveThread ?? {}) };
  const myThreadVote = liveThread?.myVote ?? false;
  const replies = useQuery(api.forum.getReplies, { threadId: threadSnapshot._id });
  const [replyBody, setReplyBody] = useState("");
  const [loading, setLoading] = useState(false);
  const addReply = useMutation(api.forum.addReply);
  const deleteReply = useMutation(api.forum.deleteReply);
  const upvoteThread = useMutation(api.forum.upvoteThread);
  const upvoteReply = useMutation(api.forum.upvoteReply);
  const deleteThread = useMutation(api.forum.deleteThread);
  const pinThread = useMutation(api.forum.pinThread);

  const isModOrAdmin = currentUser?.role === "admin" || currentUser?.role === "superadmin" || currentUser?.role === "lecturer";

  const handleAddReply = async () => {
    if (!replyBody.trim()) return;
    setLoading(true);
    try {
      await addReply({ threadId: thread._id, body: replyBody });
      setReplyBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post reply");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteThread = async () => {
    try {
      await deleteThread({ threadId: thread._id });
      toast.success("Thread deleted.");
      onBack();
    } catch { toast.error("Failed to delete thread"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold flex-1 truncate">{thread.title}</h2>
        {thread.isPinned && <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1 flex items-center"><Pin className="w-3 h-3" />Pinned</Badge>}
        {thread.category && <Badge variant="secondary" className="text-xs">{thread.category}</Badge>}
      </div>

      {/* OP */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-9 h-9">
            <AvatarImage src={thread.authorAvatar} />
            <AvatarFallback>{thread.authorName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold">{thread.authorName}</p>
            <p className="text-xs text-muted-foreground">{format(new Date(thread.createdAt), "MMM d, yyyy 'at' h:mm a")}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isModOrAdmin && (
              <Button size="sm" variant="ghost" className="h-7 text-xs cursor-pointer gap-1" onClick={() => pinThread({ threadId: thread._id, pinned: !thread.isPinned })}>
                <Pin className="w-3 h-3" /> {thread.isPinned ? "Unpin" : "Pin"}
              </Button>
            )}
            {(currentUser?._id === thread.authorId || isModOrAdmin) && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive cursor-pointer gap-1" onClick={handleDeleteThread}>
                <Trash2 className="w-3 h-3" /> Delete
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{thread.body}</p>
        <button
          onClick={() => upvoteThread({ threadId: thread._id })}
          className={cn("flex items-center gap-1.5 text-xs hover:text-primary transition-colors cursor-pointer", myThreadVote ? "text-primary font-semibold" : "text-muted-foreground")}
        >
          <ThumbsUp className={cn("w-3.5 h-3.5", myThreadVote && "fill-current")} /> {thread.upvotes} upvote{thread.upvotes !== 1 ? "s" : ""}
        </button>
      </div>

      {/* Replies */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {replies?.length ?? 0} {replies?.length === 1 ? "Reply" : "Replies"}
        </p>
        {replies === undefined ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        ) : replies.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No replies yet. Be the first to respond!</p>
        ) : (
          replies.map((reply: ReplyWithAuthor) => (
            <div key={reply._id} className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-7 h-7">
                  <AvatarImage src={reply.authorAvatar} />
                  <AvatarFallback className="text-xs">{reply.authorName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{reply.authorName}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(reply.createdAt), "MMM d, yyyy 'at' h:mm a")}</p>
                </div>
                {(currentUser?._id === reply.authorId || isModOrAdmin) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-6 text-xs text-destructive hover:text-destructive cursor-pointer"
                    onClick={() => deleteReply({ replyId: reply._id })}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{reply.body}</p>
              <button
                onClick={() => upvoteReply({ replyId: reply._id })}
                className={cn("flex items-center gap-1.5 text-xs hover:text-primary transition-colors cursor-pointer", reply.myVote ? "text-primary font-semibold" : "text-muted-foreground")}
              >
                <ThumbsUp className={cn("w-3 h-3", reply.myVote && "fill-current")} /> {reply.upvotes}
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add reply */}
      <div className="flex gap-3 items-end">
        <Textarea
          placeholder="Write a reply..."
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          rows={3}
          className="flex-1"
        />
        <Button onClick={handleAddReply} disabled={loading || !replyBody.trim()} className="cursor-pointer gap-1">
          <Send className="w-3.5 h-3.5" />
          Reply
        </Button>
      </div>
    </div>
  );
}

function ForumInner() {
  const { results, status, loadMore } = usePaginatedQuery(api.forum.listThreads, {}, { initialNumItems: 20 });
  const [showNew, setShowNew] = useState(false);
  const [selectedThread, setSelectedThread] = useState<ThreadWithAuthor | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const currentUser = useQuery(api.users.getCurrentUser, {});

  const threadList = results as ThreadWithAuthor[];

  const filtered = threadList.filter((t) =>
    categoryFilter === "All" ? true : t.category === categoryFilter
  );

  // Sort: pinned first, then by date desc
  const sorted = [...filtered].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (selectedThread) {
    return <ThreadDetail thread={selectedThread} onBack={() => setSelectedThread(null)} currentUser={currentUser} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Community Forum</h1>
          <p className="text-muted-foreground mt-1 text-sm">Ask questions, share resources, and connect with your peers.</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="cursor-pointer gap-1.5 flex-shrink-0">
          <Plus className="w-4 h-4" /> New Thread
        </Button>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {["All", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer border",
              categoryFilter === c
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Thread list */}
      {status === "LoadingFirstPage" ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No threads yet</p>
          <p className="text-sm mt-1">Start the conversation!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((thread) => (
            <div
              key={thread._id}
              onClick={() => setSelectedThread(thread)}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {thread.isPinned && <Pin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                  <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{thread.title}</p>
                  {thread.category && <Badge variant="secondary" className="text-xs flex-shrink-0">{thread.category}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{thread.body}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-muted-foreground">{thread.authorName}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(thread.createdAt), "MMM d")}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{thread.upvotes}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare className="w-3 h-3" />{thread.replyCount}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
            </div>
          ))}
        </div>
      )}

      {status === "CanLoadMore" && (
        <div className="text-center">
          <Button variant="secondary" onClick={() => loadMore(20)} className="cursor-pointer">Load more</Button>
        </div>
      )}

      {showNew && <NewThreadDialog onClose={() => setShowNew(false)} />}
    </div>
  );
}

export default function ForumPage() {
  return (
    <Authenticated>
      <ForumInner />
    </Authenticated>
  );
}
