import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  ArrowLeft,
  BookOpen,
  Upload,
  Link2,
  Video,
  FileText,
  Trash2,
  Download,
  Play,
  Plus,
  Paperclip,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

type MaterialType = "file" | "link" | "video";

function AddMaterialDialog({
  courseId,
  onClose,
}: {
  courseId: Id<"courses">;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<MaterialType>("file");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.courseMaterials.generateUploadUrl);
  const saveMaterial = useMutation(api.courseMaterials.saveMaterial);
  const saveLinkMaterial = useMutation(api.courseMaterials.saveLinkMaterial);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    setLoading(true);
    try {
      if (tab === "file") {
        if (!file) { toast.error("Please select a file"); setLoading(false); return; }
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error("Upload failed");
        const { storageId } = await res.json() as { storageId: Id<"_storage"> };
        await saveMaterial({
          courseId,
          title,
          description: description || undefined,
          fileStorageId: storageId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        });
        toast.success("File uploaded successfully");
      } else {
        if (!url) { toast.error("Please enter a URL"); setLoading(false); return; }
        await saveLinkMaterial({ courseId, title, description: description || undefined, type: tab, url });
        toast.success(tab === "video" ? "Video added" : "Link added");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add material");
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: MaterialType; label: string; icon: React.ReactNode }[] = [
    { id: "file", label: "Upload File", icon: <Upload className="w-4 h-4" /> },
    { id: "link", label: "Add Link", icon: <Link2 className="w-4 h-4" /> },
    { id: "video", label: "Video URL", icon: <Video className="w-4 h-4" /> },
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" /> Add Course Material
          </DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                tab === t.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="mb-1.5 block">Title <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lecture 1 Notes" required />
          </div>
          <div>
            <Label className="mb-1.5 block">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." rows={2} />
          </div>

          {tab === "file" && (
            <div>
              <Label className="mb-1.5 block">File <span className="text-destructive">*</span></Label>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer hover:border-primary transition-colors"
              >
                {file ? (
                  <div className="flex items-center gap-2 justify-center text-sm">
                    <Paperclip className="w-4 h-4 text-primary" />
                    <span className="font-medium truncate max-w-[200px]">{file.name}</span>
                    <span className="text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    <Upload className="w-6 h-6 mx-auto mb-1 opacity-50" />
                    Click to upload PDF, DOC, image, or any file
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          )}

          {(tab === "link" || tab === "video") && (
            <div>
              <Label className="mb-1.5 block">
                {tab === "video" ? "Video URL (YouTube, Vimeo, etc.)" : "Link URL"} <span className="text-destructive">*</span>
              </Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={tab === "video" ? "https://youtube.com/watch?v=..." : "https://..."}
                type="url"
              />
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="cursor-pointer" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1 cursor-pointer" disabled={loading}>
              {loading ? "Saving..." : "Add Material"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type MaterialItem = {
  _id: Id<"courseMaterials">;
  title: string;
  description?: string;
  type?: "file" | "link" | "video";
  fileName?: string;
  mimeType?: string;
  url: string | null;
};

function getIcon(item: MaterialItem) {
  if (item.type === "video") return <Play className="w-4 h-4 text-red-500" />;
  if (item.type === "link") return <Globe className="w-4 h-4 text-blue-500" />;
  const mime = item.mimeType ?? "";
  if (mime.includes("pdf")) return <FileText className="w-4 h-4 text-red-500" />;
  if (mime.includes("video")) return <Video className="w-4 h-4 text-purple-500" />;
  return <Paperclip className="w-4 h-4 text-primary" />;
}

function MaterialCard({ item, canDelete }: { item: MaterialItem; canDelete: boolean }) {
  const deleteMaterial = useMutation(api.courseMaterials.deleteMaterial);

  const handleDelete = async () => {
    try {
      await deleteMaterial({ materialId: item._id });
      toast.success("Material removed");
    } catch {
      toast.error("Failed to remove material");
    }
  };

  const handleOpen = () => {
    if (!item.url) { toast.error("File URL not available"); return; }
    window.open(item.url, "_blank");
  };

  return (
    <Card className="border border-border hover:shadow-sm transition-all">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            {getIcon(item)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{item.title}</p>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
            )}
            {item.fileName && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.fileName}</p>
            )}
            <div className="flex gap-1.5 mt-1">
              <Badge variant="secondary" className="text-[10px] capitalize">
                {item.type === "link" ? "Link" : item.type === "video" ? "Video" : "File"}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs cursor-pointer gap-1"
              onClick={handleOpen}
              disabled={!item.url}
            >
              {item.type === "link" || item.type === "video" ? (
                <><Globe className="w-3 h-3" /> Open</>
              ) : (
                <><Download className="w-3 h-3" /> View</>
              )}
            </Button>
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs cursor-pointer text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CourseDetailInner({ courseId }: { courseId: Id<"courses"> }) {
  const navigate = useNavigate();
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const course = useQuery(api.courses.getCourseById, { courseId });
  const materials = useQuery(api.courseMaterials.getMaterials, { courseId });
  const [showAdd, setShowAdd] = useState(false);

  const isLecturerOrAdmin =
    currentUser?.role === "lecturer" ||
    currentUser?.role === "admin" ||
    currentUser?.role === "superadmin";

  if (course === undefined || currentUser === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
        <BookOpen className="w-12 h-12 text-muted-foreground opacity-30" />
        <p className="text-lg font-semibold">Course not found</p>
        <Button variant="secondary" onClick={() => navigate("/courses")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Courses
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 cursor-pointer"
            onClick={() => navigate("/courses")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
              <Badge variant="secondary">{course.category}</Badge>
              {course.published ? (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">Published</Badge>
              ) : (
                <Badge className="bg-muted text-muted-foreground text-xs">Draft</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{course.description}</p>
          </div>
        </div>
        {isLecturerOrAdmin && (
          <Button className="cursor-pointer gap-2 shrink-0" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> Add Material
          </Button>
        )}
      </div>

      {/* Materials */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Course Materials</h2>
          <Badge variant="secondary">{materials?.length ?? 0}</Badge>
        </div>

        {materials === undefined ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : materials.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[25vh] gap-3 text-center border-2 border-dashed border-border rounded-2xl p-8">
            <Paperclip className="w-10 h-10 text-muted-foreground opacity-30" />
            <div>
              <p className="font-semibold">No materials yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isLecturerOrAdmin
                  ? "Upload PDFs, add links, or embed videos for your students."
                  : "Your lecturer hasn't uploaded any materials yet."}
              </p>
            </div>
            {isLecturerOrAdmin && (
              <Button size="sm" className="cursor-pointer gap-2" onClick={() => setShowAdd(true)}>
                <Plus className="w-4 h-4" /> Add First Material
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {(materials as MaterialItem[]).map((item) => (
              <MaterialCard
                key={item._id}
                item={item}
                canDelete={isLecturerOrAdmin}
              />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddMaterialDialog courseId={courseId} onClose={() => setShowAdd(false)} />
      )}
    </div>
  );
}

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  return (
    <Authenticated>
      <CourseDetailInner courseId={courseId as Id<"courses">} />
    </Authenticated>
  );
}
