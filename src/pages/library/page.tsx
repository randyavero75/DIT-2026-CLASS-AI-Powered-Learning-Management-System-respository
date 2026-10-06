import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Library,
  Plus,
  FileText,
  Video,
  Link2,
  Download,
  Trash2,
  Search,
  ExternalLink,
  BookOpen,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const TYPE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  video: Video,
  link: Link2,
  document: BookOpen,
};

const TYPE_COLORS: Record<string, string> = {
  pdf: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  video: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  link: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  document: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
};

const SUGGESTED_CATEGORIES = [
  "Mathematics", "Science", "History", "Literature", "Technology",
  "Health", "Business", "Language", "Arts", "Social Studies", "Other",
];

function AddItemDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Other");
  const [type, setType] = useState<"pdf" | "video" | "link" | "document">("link");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addItem = useMutation(api.library.addItem);
  const generateUploadUrl = useMutation(api.library.generateUploadUrl);

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error("Please enter a title"); return; }
    if ((type === "link" || type === "video") && !url.trim()) { toast.error("Please enter a URL"); return; }
    if ((type === "pdf" || type === "document") && !file && !url.trim()) { toast.error("Please upload a file or enter a URL"); return; }

    setLoading(true);
    try {
      let fileStorageId: Id<"_storage"> | undefined;
      let fileName: string | undefined;
      let resolvedUrl = url || undefined;

      if (file && (type === "pdf" || type === "document")) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await res.json() as { storageId: Id<"_storage"> };
        fileStorageId = storageId;
        fileName = file.name;
        resolvedUrl = undefined;
      }

      await addItem({
        title,
        description: description || undefined,
        category,
        type,
        url: resolvedUrl,
        fileStorageId,
        fileName,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      toast.success("Item added to library!");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="w-4 h-4 text-primary" />
            Add to Library
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <Input placeholder="Title *" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Type *</label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">Link / Website</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="document">Other Document</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Category *</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUGGESTED_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(type === "link" || type === "video") && (
            <Input placeholder="URL (https://...)" value={url} onChange={(e) => setUrl(e.target.value)} />
          )}

          {(type === "pdf" || type === "document") && (
            <div className="space-y-2">
              <Input placeholder="URL (optional, or upload file below)" value={url} onChange={(e) => setUrl(e.target.value)} />
              <div
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {file ? file.name : "Click to upload file"}
                </p>
              </div>
            </div>
          )}

          <Input placeholder="Tags (comma separated, e.g. algebra, grade-10)" value={tags} onChange={(e) => setTags(e.target.value)} />

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" onClick={onClose} disabled={loading} className="cursor-pointer">Cancel</Button>
            <Button onClick={handleSubmit} disabled={loading} className="cursor-pointer">
              {loading ? "Adding..." : "Add to Library"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type LibraryItem = {
  _id: Id<"libraryItems">;
  title: string;
  description?: string;
  category: string;
  type: "pdf" | "video" | "link" | "document";
  tags: string[];
  createdAt: string;
  resolvedUrl: string | null;
  adderName: string;
  fileName?: string;
};

function ItemCard({ item, canDelete, onDelete }: { item: LibraryItem; canDelete: boolean; onDelete: () => void }) {
  const Icon = TYPE_ICONS[item.type] ?? FileText;

  return (
    <div className="rounded-xl border border-border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", TYPE_COLORS[item.type])}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug truncate">{item.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge className={cn("text-[10px] capitalize", TYPE_COLORS[item.type])}>{item.type}</Badge>
            <Badge variant="secondary" className="text-[10px]">{item.category}</Badge>
          </div>
        </div>
        {canDelete && (
          <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer flex-shrink-0">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      {item.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
      )}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-muted-foreground">Added by {item.adderName}</span>
        {item.resolvedUrl ? (
          item.type === "pdf" || item.type === "document" ? (
            <a
              href={item.resolvedUrl}
              download={item.fileName ?? item.title}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </a>
          ) : (
            <a
              href={item.resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open
            </a>
          )
        ) : null}
      </div>
    </div>
  );
}

function LibraryInner() {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const categories = useQuery(api.library.getCategories, {});
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [showAdd, setShowAdd] = useState(false);
  const deleteItem = useMutation(api.library.deleteItem);

  const { results, status, loadMore } = usePaginatedQuery(
    api.library.listItems,
    { category: categoryFilter !== "All" ? categoryFilter : undefined },
    { initialNumItems: 24 }
  );

  const canAdd = currentUser?.role === "admin" || currentUser?.role === "superadmin" || currentUser?.role === "lecturer";
  const isAdminOrSuper = currentUser?.role === "admin" || currentUser?.role === "superadmin";

  const filtered = (results as LibraryItem[]).filter((item: LibraryItem) =>
    !search ||
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    item.description?.toLowerCase().includes(search.toLowerCase()) ||
    item.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDelete = async (id: Id<"libraryItems">) => {
    try {
      await deleteItem({ itemId: id });
      toast.success("Item removed from library");
    } catch { toast.error("Failed to remove item"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Content Library</h1>
          <p className="text-muted-foreground mt-1 text-sm">Browse educational resources: PDFs, videos, links, and more.</p>
        </div>
        {canAdd && (
          <Button onClick={() => setShowAdd(true)} className="cursor-pointer gap-1.5 flex-shrink-0">
            <Plus className="w-4 h-4" /> Add Item
          </Button>
        )}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search library..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        {["All", ...(categories ?? [])].map((c) => (
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

      {/* Grid */}
      {status === "LoadingFirstPage" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Library className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No items found</p>
          <p className="text-sm mt-1">{canAdd ? "Add the first item to the library!" : "Check back later for new content."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item: LibraryItem) => (
            <ItemCard
              key={item._id}
              item={item}
              canDelete={isAdminOrSuper || false}
              onDelete={() => handleDelete(item._id)}
            />
          ))}
        </div>
      )}

      {status === "CanLoadMore" && (
        <div className="text-center">
          <Button variant="secondary" onClick={() => loadMore(24)} className="cursor-pointer">Load more</Button>
        </div>
      )}

      {showAdd && <AddItemDialog onClose={() => setShowAdd(false)} />}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Authenticated>
      <LibraryInner />
    </Authenticated>
  );
}
