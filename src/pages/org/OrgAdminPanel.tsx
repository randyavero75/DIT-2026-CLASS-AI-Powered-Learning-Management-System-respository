import { useState, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Users, Settings, Copy, RefreshCw, Shield, BookOpen,
  GraduationCap, UserX, ChevronDown, Building2, Globe, Check,
  CheckCircle2, XCircle, Clock, Home, UserPlus, Upload, ImageIcon, Bell, Trash2, FolderKanban, UserCog, Send, Hash,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";

type Tab = "members" | "settings" | "requests" | "courseRequests" | "programRequests" | "bulkEnroll" | "notifications" | "assignCourses" | "lecturerPrograms" | "sendInviteCode";

type TabGroup = {
  label: string;
  icon: React.ElementType;
  items: { key: Tab; label: string; icon: React.ElementType }[];
};

const TAB_GROUPS: TabGroup[] = [
  {
    label: "Members",
    icon: Users,
    items: [
      { key: "members", label: "Organization Members", icon: Users },
      { key: "requests", label: "Join Requests", icon: UserPlus },
      { key: "sendInviteCode", label: "Share Invite Code", icon: Send },
    ],
  },
  {
    label: "Academics",
    icon: GraduationCap,
    items: [
      { key: "courseRequests", label: "Course Access", icon: BookOpen },
      { key: "programRequests", label: "Program Requests", icon: FolderKanban },
      { key: "bulkEnroll", label: "Bulk Enroll", icon: Upload },
      { key: "assignCourses", label: "Assign Courses", icon: FolderKanban },
      { key: "lecturerPrograms", label: "Lecturer Programs", icon: UserCog },
    ],
  },
  {
    label: "Admin",
    icon: Shield,
    items: [
      { key: "notifications", label: "Notifications", icon: Bell },
      { key: "settings", label: "Settings", icon: Settings },
    ],
  },
];

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  lecturer: "bg-primary/15 text-primary",
  student: "bg-muted text-muted-foreground",
  superadmin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

// ── Embedded create-org form (for admins without an org) ──────────────────────

function OrgOnboardingEmbed() {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"university" | "school" | "senior_high_school" | "junior_high_school" | "bible_school" | "polytechnic" | "technical" | "nursing" | "vocational" | "business" | "other">("school");
  const [description, setDescription] = useState("");
  const createOrg = useMutation(api.organizations.createOrganization);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Organization name is required"); return; }
    setLoading(true);
    try {
      await createOrg({ name: name.trim(), type, description: description.trim() || undefined });
      toast.success(`Organization "${name}" created!`);
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Failed to create organization");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleCreate} className="w-full space-y-4 text-left">
      <div className="space-y-1.5">
        <Label>Organization Name *</Label>
        <Input placeholder="e.g. Greenwood High School" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="university">University / College</SelectItem>
            <SelectItem value="school">School (General)</SelectItem>
            <SelectItem value="senior_high_school">Senior High School (SHS)</SelectItem>
            <SelectItem value="junior_high_school">Junior High School (JHS)</SelectItem>
            <SelectItem value="bible_school">Bible School / Seminary</SelectItem>
            <SelectItem value="polytechnic">Polytechnic / TVET</SelectItem>
            <SelectItem value="technical">Technical Institute</SelectItem>
            <SelectItem value="nursing">Nursing / Health Training School</SelectItem>
            <SelectItem value="vocational">Vocational / Training Center</SelectItem>
            <SelectItem value="business">Business / Corporate</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea placeholder="Brief description..." value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <Button type="submit" className="w-full cursor-pointer" disabled={loading}>
        {loading ? "Creating..." : "Create Organization"}
      </Button>
    </form>
  );
}

function MemberRow({ member, currentUserId }: {
  member: { _id: Id<"users">; name?: string; email?: string; avatar?: string; role?: string; phone?: string; indexNumber?: string };
  currentUserId: Id<"users">;
}) {
  const [roleOpen, setRoleOpen] = useState(false);
  const updateRole = useMutation(api.organizations.updateMemberRole);
  const removeMember = useMutation(api.organizations.removeMember);
  const deleteUser = useMutation(api.users.deleteUser);
  const isSelf = member._id === currentUserId;

  const handleRoleChange = async (role: string) => {
    try {
      await updateRole({ userId: member._id, role: role as "admin" | "lecturer" | "student" });
      toast.success(`Role updated to ${role}`);
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Failed to update role");
    }
    setRoleOpen(false);
  };

  const handleRemove = async () => {
    if (!confirm(`Remove ${member.name ?? "this user"} from the organization?`)) return;
    try {
      await removeMember({ userId: member._id });
      toast.success("Member removed");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Failed to remove member");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Permanently delete ${member.name ?? "this user"}'s account? This cannot be undone.`)) return;
    try {
      await deleteUser({ userId: member._id });
      toast.success("User account deleted");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Failed to delete user");
    }
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <Avatar className="w-9 h-9 flex-shrink-0">
        <AvatarImage src={member.avatar} />
        <AvatarFallback className="text-xs bg-primary/10 text-primary">{member.name?.charAt(0) ?? "?"}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{member.name ?? "—"}</p>
        {member.email && <p className="text-xs text-muted-foreground truncate">{member.email}</p>}
        {member.phone && <p className="text-xs text-muted-foreground">📞 {member.phone}</p>}
        {member.indexNumber && <p className="text-xs text-muted-foreground font-mono">🆔 {member.indexNumber}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {isSelf ? (
          <Badge className={cn("text-xs capitalize", ROLE_COLORS[member.role ?? "student"])}>
            {member.role ?? "student"} (You)
          </Badge>
        ) : (
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-xs gap-1 cursor-pointer capitalize"
              onClick={() => setRoleOpen(!roleOpen)}
            >
              <span className={cn("w-2 h-2 rounded-full", {
                "bg-amber-500": member.role === "admin",
                "bg-primary": member.role === "lecturer",
                "bg-muted-foreground": member.role === "student",
              })} />
              {member.role ?? "student"}
              <ChevronDown className="w-3 h-3" />
            </Button>
            {roleOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-popover border border-border rounded-lg shadow-lg min-w-[130px] py-1">
                {(["admin", "lecturer", "student"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => handleRoleChange(r)}
                    className="w-full text-left text-sm px-3 py-2 hover:bg-muted flex items-center gap-2 cursor-pointer capitalize"
                  >
                    {member.role === r && <Check className="w-3 h-3 text-primary" />}
                    <span className={member.role !== r ? "ml-5" : ""}>{r}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {!isSelf && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
            onClick={handleRemove}
            title="Remove from org"
          >
            <UserX className="w-3.5 h-3.5" />
          </Button>
        )}
        {!isSelf && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
            onClick={handleDelete}
            title="Delete user account"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function InviteRequestsPanel() {
  const requests = useQuery(api.orgInviteRequests.getPendingInviteRequests, {});
  const reviewRequest = useMutation(api.orgInviteRequests.reviewInviteRequest);
  const [roleSelections, setRoleSelections] = useState<Record<string, "student" | "lecturer">>({});

  const handleReview = async (requestId: Parameters<typeof reviewRequest>[0]["requestId"], decision: "approved" | "rejected", name: string, reqId: string) => {
    try {
      const grantRole = roleSelections[reqId] ?? "student";
      await reviewRequest({ requestId, decision, grantRole: decision === "approved" ? grantRole : undefined });
      toast.success(decision === "approved"
        ? `${name} approved as ${grantRole}. They now have dashboard access and a confirmation email has been sent.`
        : `${name}'s request rejected`);
    } catch { toast.error("Failed to process request"); }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Join Requests</CardTitle>
        <p className="text-xs text-muted-foreground">
          Approve requests to grant immediate dashboard access. A confirmation email is sent to the user and the superadmin is notified.
        </p>
      </CardHeader>
      <CardContent>
        {requests === undefined ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center italic">No pending join requests.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const user = req.user;
              if (!user) return null;
              const selectedRole = roleSelections[req._id] ?? "student";
              return (
                <div key={req._id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 font-bold text-primary text-sm">
                      {user.name?.charAt(0) ?? "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{req.fullName || user.name || "Unknown User"}</p>
                      <p className="text-xs text-muted-foreground truncate">{req.email || user.email || "—"}</p>
                      {req.phone && <p className="text-xs text-muted-foreground">📞 {req.phone}</p>}
                      {req.message && <p className="text-xs text-foreground/70 mt-0.5 italic line-clamp-1">"{req.message}"</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Role selector */}
                    <select
                      value={selectedRole}
                      onChange={(e) => setRoleSelections((prev) => ({ ...prev, [req._id]: e.target.value as "student" | "lecturer" }))}
                      className="h-8 text-xs border border-border rounded-md px-2 bg-background cursor-pointer"
                    >
                      <option value="student">Student</option>
                      <option value="lecturer">Lecturer</option>
                    </select>
                    <Button size="sm" className="h-8 text-xs gap-1 cursor-pointer bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleReview(req._id, "approved", user.name ?? "User", req._id)}>
                      <Check className="w-3.5 h-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="secondary" className="h-8 text-xs gap-1 cursor-pointer text-destructive hover:text-destructive"
                      onClick={() => handleReview(req._id, "rejected", user.name ?? "User", req._id)}>
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CourseAccessRequestsPanel() {
  const pendingRequests = useQuery(api.courseRequests.getPendingRequests, {});
  const reviewRequest = useMutation(api.courseRequests.reviewRequest);

  const handleReview = async (
    requestId: Parameters<typeof reviewRequest>[0]["requestId"],
    decision: "approved" | "rejected",
    studentName: string,
    courseTitle: string
  ) => {
    try {
      await reviewRequest({ requestId, decision });
      toast.success(
        decision === "approved"
          ? `${studentName} approved for "${courseTitle}"`
          : `${studentName}'s request rejected`
      );
    } catch { toast.error("Failed to process request"); }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Course Access Requests</CardTitle>
        <p className="text-xs text-muted-foreground">
          Approve or reject student requests to enroll in courses.
        </p>
      </CardHeader>
      <CardContent>
        {pendingRequests === undefined ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : pendingRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center italic">No pending course access requests.</p>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((req) => {
              const student = req.student;
              const course = req.course;
              if (!student || !course) return null;
              return (
                <div key={req._id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 font-bold text-primary text-sm">
                      {student.name?.charAt(0) ?? "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{student.name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Requesting: <span className="font-medium text-foreground">{course.title}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(req.requestedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button size="sm" className="h-8 text-xs gap-1 cursor-pointer bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleReview(req._id, "approved", student.name ?? "User", course.title)}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="secondary" className="h-8 text-xs gap-1 cursor-pointer text-destructive hover:text-destructive"
                      onClick={() => handleReview(req._id, "rejected", student.name ?? "User", course.title)}>
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OrgSettings() {
  const org = useQuery(api.organizations.getMyOrganization, {});
  const updateOrg = useMutation(api.organizations.updateOrganization);
  const regenerateCode = useMutation(api.organizations.regenerateInviteCode);
  const generateLogoUploadUrl = useMutation(api.organizations.generateLogoUploadUrl);
  const saveLogoStorageId = useMutation(api.organizations.saveLogoStorageId);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  type OrgType = "university" | "school" | "senior_high_school" | "junior_high_school" | "bible_school" | "polytechnic" | "technical" | "nursing" | "vocational" | "business" | "other";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [type, setType] = useState<OrgType>("school");
  const [initialized, setInitialized] = useState(false);

  // Initialize form when org loads - only once
  if (org && !initialized) {
    setName(org.name ?? "");
    setDescription(org.description ?? "");
    setWebsite(org.website ?? "");
    setType((org.type as OrgType) ?? "school");
    setInitialized(true);
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setLogoUploading(true);
    try {
      const uploadUrl = await generateLogoUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await res.json() as { storageId: Id<"_storage"> };
      await saveLogoStorageId({ storageId });
      toast.success("Logo uploaded!");
    } catch {
      toast.error("Failed to upload logo");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleCopy = () => {
    if (!org) return;
    navigator.clipboard.writeText(org.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Invite code copied!");
  };

  const [customCode, setCustomCode] = useState("");

  const handleRegenerate = async (code?: string) => {
    if (!confirm("Change the invite code? The old code will stop working.")) return;
    try {
      await regenerateCode({ customCode: code });
      setCustomCode("");
      toast.success("Invite code updated");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Failed to update code");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateOrg({ name, description, website, type });
      toast.success("Settings saved");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (org === undefined) return <Skeleton className="h-48 w-full" />;
  if (!org) return <p className="text-muted-foreground text-sm">Organization not found.</p>;

  const ORG_TYPES: { value: OrgType; label: string }[] = [
    { value: "university", label: "University / College" },
    { value: "school", label: "School (General)" },
    { value: "senior_high_school", label: "Senior High School (SHS)" },
    { value: "junior_high_school", label: "Junior High School (JHS)" },
    { value: "bible_school", label: "Bible School / Seminary" },
    { value: "polytechnic", label: "Polytechnic / TVET" },
    { value: "technical", label: "Technical Institute" },
    { value: "nursing", label: "Nursing / Health Training School" },
    { value: "vocational", label: "Vocational / Training Center" },
    { value: "business", label: "Corporate / Business" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Logo Upload */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" /> Institution Logo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Upload your institution's logo. It will appear in the sidebar for all members.</p>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted flex-shrink-0">
              {org.logoUrl ? (
                <img src={org.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <GraduationCap className="w-7 h-7 text-muted-foreground/50" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="cursor-pointer gap-2"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
              >
                <Upload className="w-3.5 h-3.5" />
                {logoUploading ? "Uploading..." : org.logoUrl ? "Change Logo" : "Upload Logo"}
              </Button>
              {org.logoUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="cursor-pointer text-destructive hover:text-destructive text-xs"
                  onClick={() => updateOrg({ logoUrl: "" })}
                >
                  Remove Logo
                </Button>
              )}
            </div>
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
          />
        </CardContent>
      </Card>

      {/* Invite code */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Invite Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Share this code with lecturers and students so they can join your organization.</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 font-mono text-2xl font-bold tracking-[0.3em] bg-muted rounded-xl px-5 py-3 text-center">
              {org.inviteCode}
            </div>
            <Button variant="secondary" size="sm" className="cursor-pointer gap-1.5 h-12" onClick={handleCopy}>
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="secondary" size="sm" className="cursor-pointer gap-1.5 h-12" onClick={() => handleRegenerate()}>
              <RefreshCw className="w-4 h-4" /> Shuffle
            </Button>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Input
              placeholder="Or type your own code (4-12 letters/numbers)"
              value={customCode}
              maxLength={12}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              className="font-mono tracking-widest"
            />
            <Button
              variant="secondary"
              size="sm"
              className="cursor-pointer"
              disabled={customCode.length < 4}
              onClick={() => handleRegenerate(customCode)}
            >
              Set code
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit org details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Organization Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Institution Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as OrgType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ORG_TYPES.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" />Website</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." type="url" />
            </div>
            <Button type="submit" disabled={saving} className="cursor-pointer">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function BulkEnrollPanel() {
  const members = useQuery(api.organizations.getOrgMembers, {});
  const courses = useQuery(api.courses.getAllCoursesForLecturer, {});
  const bulkEnroll = useMutation(api.courses.bulkEnrollStudents);
  const addManually = useMutation(api.courses.adminAddStudentManually);

  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [level, setLevelState] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Manual add form
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualLevel, setManualLevel] = useState<string>("");
  const [manualCourses, setManualCourses] = useState<Set<string>>(new Set());
  const [manualLoading, setManualLoading] = useState(false);

  const students = members?.filter((m) => m.role === "student") ?? [];

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const toggleCourse = (id: string, set: Set<string>, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    setter(next);
  };

  const handleBulkEnroll = async () => {
    if (selectedStudents.size === 0 || selectedCourses.size === 0) {
      toast.error("Select at least one student and one course");
      return;
    }
    setLoading(true);
    try {
      const result = await bulkEnroll({
        studentIds: Array.from(selectedStudents) as Id<"users">[],
        courseIds: Array.from(selectedCourses) as Id<"courses">[],
        level: level && level !== "none" ? parseInt(level) : undefined,
      });
      toast.success(`${result.enrolled} enrollment(s) created`);
      setSelectedStudents(new Set());
      setSelectedCourses(new Set());
      setLevelState("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk enroll failed");
    } finally {
      setLoading(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualEmail.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setManualLoading(true);
    try {
      const result = await addManually({
        name: manualName.trim(),
        email: manualEmail.trim(),
        level: manualLevel && manualLevel !== "none" ? parseInt(manualLevel) : undefined,
        courseIds: Array.from(manualCourses) as Id<"courses">[],
      });
      toast.success(result.isNew
        ? `Student "${manualName}" added to institution${result.enrolled > 0 ? ` and enrolled in ${result.enrolled} course(s)` : ""}`
        : `Existing student found and enrolled in ${result.enrolled} course(s)`
      );
      setManualName(""); setManualEmail(""); setManualLevel(""); setManualCourses(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add student");
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bulk enroll existing members */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="w-4 h-4 text-primary" /> Bulk Enroll Existing Members
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Select students and courses, optionally assign an academic level, then enroll them all at once.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Students */}
            <div>
              <Label className="mb-2 block text-sm font-medium">
                Select Students ({selectedStudents.size} selected)
              </Label>
              <div className="border border-border rounded-xl max-h-56 overflow-y-auto divide-y divide-border">
                {students.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-4 text-center">No students in this institution yet.</p>
                ) : students.map((s) => (
                  <button
                    key={s._id}
                    onClick={() => toggleStudent(s._id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors cursor-pointer",
                      selectedStudents.has(s._id) ? "bg-primary/10 text-primary" : "hover:bg-muted"
                    )}
                  >
                    <div className={cn("w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center",
                      selectedStudents.has(s._id) ? "bg-primary border-primary" : "border-border"
                    )}>
                      {selectedStudents.has(s._id) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{s.name ?? "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.email ?? "—"}</p>
                    </div>
                    {(s as typeof s & { level?: number }).level && (
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        Lvl {(s as typeof s & { level?: number }).level}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="secondary" className="cursor-pointer text-xs h-7"
                  onClick={() => setSelectedStudents(new Set(students.map((s) => s._id)))}>
                  Select All
                </Button>
                <Button size="sm" variant="secondary" className="cursor-pointer text-xs h-7"
                  onClick={() => setSelectedStudents(new Set())}>
                  Clear
                </Button>
              </div>
            </div>

            {/* Courses */}
            <div>
              <Label className="mb-2 block text-sm font-medium">
                Select Courses ({selectedCourses.size} selected)
              </Label>
              <div className="border border-border rounded-xl max-h-56 overflow-y-auto divide-y divide-border">
                {!courses || courses.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-4 text-center">No courses available.</p>
                ) : courses.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => toggleCourse(c._id, selectedCourses, setSelectedCourses)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors cursor-pointer",
                      selectedCourses.has(c._id) ? "bg-primary/10 text-primary" : "hover:bg-muted"
                    )}
                  >
                    <div className={cn("w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center",
                      selectedCourses.has(c._id) ? "bg-primary border-primary" : "border-border"
                    )}>
                      {selectedCourses.has(c._id) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                    <p className="flex-1 truncate font-medium">{c.title}</p>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">{c.category}</Badge>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Level + Action */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1">
              <Label className="mb-1.5 block text-sm">Academic Level (optional)</Label>
              <Select value={level} onValueChange={setLevelState}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Assign level..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="cursor-pointer">No level</SelectItem>
                  <SelectItem value="100" className="cursor-pointer">Level 100</SelectItem>
                  <SelectItem value="200" className="cursor-pointer">Level 200</SelectItem>
                  <SelectItem value="300" className="cursor-pointer">Level 300</SelectItem>
                  <SelectItem value="400" className="cursor-pointer">Level 400</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="cursor-pointer gap-2 sm:self-auto"
              onClick={handleBulkEnroll}
              disabled={loading || selectedStudents.size === 0 || selectedCourses.size === 0}
            >
              <Upload className="w-4 h-4" />
              {loading ? "Enrolling..." : `Enroll ${selectedStudents.size} Student${selectedStudents.size !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Manual add student */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="w-4 h-4 text-primary" /> Manually Add a Student
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Add a student by email. If they already have an account, they'll be linked to this institution. Otherwise a placeholder record is created.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">Full Name <span className="text-destructive">*</span></Label>
                <Input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="John Smith" required />
              </div>
              <div>
                <Label className="mb-1.5 block">Email Address <span className="text-destructive">*</span></Label>
                <Input value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} placeholder="john@example.com" type="email" required />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Academic Level</Label>
              <Select value={manualLevel} onValueChange={setManualLevel}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Select level..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="cursor-pointer">No level</SelectItem>
                  <SelectItem value="100" className="cursor-pointer">Level 100</SelectItem>
                  <SelectItem value="200" className="cursor-pointer">Level 200</SelectItem>
                  <SelectItem value="300" className="cursor-pointer">Level 300</SelectItem>
                  <SelectItem value="400" className="cursor-pointer">Level 400</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block text-sm">Enroll in Courses (optional)</Label>
              <div className="border border-border rounded-xl max-h-40 overflow-y-auto divide-y divide-border">
                {!courses || courses.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">No courses available.</p>
                ) : courses.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => toggleCourse(c._id, manualCourses, setManualCourses)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors cursor-pointer",
                      manualCourses.has(c._id) ? "bg-primary/10 text-primary" : "hover:bg-muted"
                    )}
                  >
                    <div className={cn("w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center",
                      manualCourses.has(c._id) ? "bg-primary border-primary" : "border-border"
                    )}>
                      {manualCourses.has(c._id) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                    <p className="flex-1 truncate">{c.title}</p>
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" className="cursor-pointer gap-2" disabled={manualLoading}>
              <UserPlus className="w-4 h-4" />
              {manualLoading ? "Adding..." : "Add Student"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function SendNotificationPanel() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const sendNotification = useAction(api.pushNotifications.sendNotificationAsAdmin);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSending(true);
    try {
      await sendNotification({ title: title.trim(), body: body.trim() || undefined });
      toast.success("Notification sent to all subscribed members!");
      setTitle("");
      setBody("");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Send Push Notification</CardTitle>
        <p className="text-xs text-muted-foreground">
          Broadcast a push notification to all members who have enabled notifications. Note: push notifications don{"'"}t work inside the App Builder preview — members must access the published app.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSend} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title <span className="text-destructive">*</span></Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New Quiz Available!"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Message (optional)</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Additional details about the notification..."
              rows={3}
            />
          </div>
          <Button type="submit" className="cursor-pointer gap-2" disabled={sending || !title.trim()}>
            {sending ? "Sending..." : "Send Notification"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AssignCoursesPanel() {
  const unassignedCourses = useQuery(api.courses.getUnassignedCourses, {});
  const programs = useQuery(api.programCategories.listForCurrentOrg, {});
  const assignCourse = useMutation(api.courses.assignCourseToProgram);

  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [semester, setSemester] = useState<string>("");

  const handleAssign = async (courseId: Id<"courses">) => {
    if (!selectedProgramId) {
      toast.error("Please select a program first");
      return;
    }
    try {
      await assignCourse({
        courseId,
        programCategoryId: selectedProgramId as Id<"programCategories">,
        semester: semester && semester !== "none" ? semester as "first" | "second" | "full_term" : undefined,
      });
      toast.success("Course assigned to program");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Failed to assign course");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderKanban className="w-4 h-4 text-primary" /> Assign Courses to Programs
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Assign existing courses that are not yet in any program to the program of your choice.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Target program and semester */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Target Program</Label>
            <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
              <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Select program..." /></SelectTrigger>
              <SelectContent>
                {programs?.map((p) => (
                  <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Semester (optional)</Label>
            <Select value={semester} onValueChange={setSemester}>
              <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Select semester..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No semester</SelectItem>
                <SelectItem value="first">First Semester</SelectItem>
                <SelectItem value="second">Second Semester</SelectItem>
                <SelectItem value="full_term">Full Term</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Unassigned courses */}
        <div>
          <Label className="block mb-2 text-sm font-medium">Unassigned Courses</Label>
          {unassignedCourses === undefined ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : unassignedCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center italic">All courses are already assigned to programs.</p>
          ) : (
            <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
              {unassignedCourses.map((course) => (
                <div key={course._id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{course.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{course.category}</p>
                  </div>
                  <Button
                    size="sm"
                    className="cursor-pointer text-xs h-8 flex-shrink-0"
                    onClick={() => handleAssign(course._id)}
                    disabled={!selectedProgramId}
                  >
                    Assign
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Program Enrollment Requests Panel ────────────────────────────────────────

function ProgramEnrollmentRequestsPanel() {
  const requests = useQuery(api.programEnrollments.getPendingProgramEnrollmentRequests, {});
  const reviewRequest = useMutation(api.programEnrollments.reviewProgramEnrollmentRequest);
  const [loading, setLoading] = useState<string | null>(null);

  const handleDecision = async (requestId: string, decision: "approved" | "rejected") => {
    setLoading(requestId);
    try {
      await reviewRequest({
        requestId: requestId as Id<"programEnrollmentRequests">,
        decision,
      });
      if (decision === "approved") {
        toast.success("Approved! The student can now request courses in this program.");
      } else {
        toast.success("Request rejected.");
      }
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Failed to review request");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FolderKanban className="w-4 h-4 text-primary" />
          Program Enrollment Requests
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Students request to join a program. Once approved, they can request each course in that program.
        </p>
      </CardHeader>
      <CardContent>
        {requests === undefined ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
            <FolderKanban className="w-8 h-8 opacity-25" />
            <p className="text-sm font-medium">No pending program requests</p>
            <p className="text-xs">Students can request to join programs from the Programs page.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {requests.map((req) => (
              <div key={req._id} className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <Avatar className="w-9 h-9 flex-shrink-0">
                  <AvatarImage src={req.student?.avatar} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {req.student?.name?.charAt(0) ?? "S"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{req.fullName || req.student?.name || "Unknown Student"}</p>
                    <Badge className="text-xs bg-primary/10 text-primary">
                      <FolderKanban className="w-3 h-3 mr-1" />
                      {req.program?.name ?? "Unknown Program"}
                    </Badge>
                  </div>
                  {req.student?.email && (
                    <p className="text-xs text-muted-foreground">{req.student.email}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                    {req.phone && <span>📞 {req.phone}</span>}
                    {req.indexNumber && <span>🆔 {req.indexNumber}</span>}
                    {req.yearOfStudy && <span>📚 {req.yearOfStudy}</span>}
                    {req.dateOfBirth && (
                      <span>🎂 {new Date(req.dateOfBirth).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                    )}
                    {req.gender && (
                      <span className="capitalize">{req.gender.replace(/_/g, " ")}</span>
                    )}
                  </div>
                  {req.message && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">{'"'}{req.message}{'"'}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Requested {new Date(req.requestedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    className="cursor-pointer gap-1 h-8"
                    disabled={loading === req._id}
                    onClick={() => handleDecision(req._id, "approved")}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {loading === req._id ? "..." : "Approve"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="cursor-pointer gap-1 h-8 text-destructive hover:text-destructive"
                    disabled={loading === req._id}
                    onClick={() => handleDecision(req._id, "rejected")}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LecturerProgramsPanel() {
  const programs = useQuery(api.programCategories.listForCurrentOrg, {});
  const orgLecturers = useQuery(api.programLecturers.getOrgLecturers, {});
  const pendingRequests = useQuery(api.programLecturers.getPendingAccessRequests, {});
  const assignLecturer = useMutation(api.programLecturers.assignLecturer);
  const removeLecturer = useMutation(api.programLecturers.removeLecturer);
  const reviewRequest = useMutation(api.programLecturers.reviewAccessRequest);

  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [selectedLecturerId, setSelectedLecturerId] = useState<string>("");
  const [programLecturers, setProgramLecturers] = useState<null | Array<{ _id: Id<"users">; name?: string; email?: string }>>(null);
  const getLecturers = useQuery(
    api.programLecturers.getLecturersForProgram,
    selectedProgramId ? { programId: selectedProgramId as Id<"programCategories"> } : "skip"
  );

  // sync
  if (getLecturers !== undefined && getLecturers !== programLecturers) {
    setProgramLecturers(getLecturers as Array<{ _id: Id<"users">; name?: string; email?: string }>);
  }

  const handleAssign = async () => {
    if (!selectedProgramId || !selectedLecturerId) return;
    try {
      await assignLecturer({
        programId: selectedProgramId as Id<"programCategories">,
        lecturerId: selectedLecturerId as Id<"users">,
      });
      toast.success("Lecturer assigned to program");
      setSelectedLecturerId("");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Failed to assign lecturer");
    }
  };

  const handleRemove = async (lecturerId: Id<"users">) => {
    if (!selectedProgramId) return;
    try {
      await removeLecturer({
        programId: selectedProgramId as Id<"programCategories">,
        lecturerId,
      });
      toast.success("Lecturer removed from program");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Failed to remove lecturer");
    }
  };

  const handleReview = async (requestId: Id<"programAccessRequests">, decision: "approved" | "rejected", name: string) => {
    try {
      await reviewRequest({ requestId, decision });
      toast.success(decision === "approved" ? `${name} approved for program access` : `Request from ${name} rejected`);
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Failed to process request");
    }
  };

  return (
    <div className="space-y-6">
      {/* Assign Lecturers to Programs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="w-4 h-4 text-primary" /> Assign Lecturers to Programs
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Assign a lecturer to a program so they can manage content and quizzes for all courses in that program.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Program selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Select Program</Label>
              <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Choose program..." /></SelectTrigger>
                <SelectContent>
                  {programs?.map((p) => (
                    <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Select Lecturer to Assign</Label>
              <div className="flex gap-2">
                <Select value={selectedLecturerId} onValueChange={setSelectedLecturerId}>
                  <SelectTrigger className="cursor-pointer flex-1"><SelectValue placeholder="Choose lecturer..." /></SelectTrigger>
                  <SelectContent>
                    {orgLecturers?.filter((l): l is NonNullable<typeof l> => !!l).map((l) => (
                      <SelectItem key={l._id} value={l._id}>{l.name ?? l.email ?? "Unknown"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="cursor-pointer gap-1.5 flex-shrink-0"
                  onClick={handleAssign}
                  disabled={!selectedProgramId || !selectedLecturerId}
                >
                  <UserPlus className="w-3.5 h-3.5" /> Assign
                </Button>
              </div>
            </div>
          </div>

          {/* Current lecturers for selected program */}
          {selectedProgramId && (
            <div>
              <Label className="block mb-2 text-sm font-medium">
                Lecturers Assigned to This Program
              </Label>
              {getLecturers === undefined ? (
                <Skeleton className="h-16 w-full" />
              ) : (getLecturers as typeof programLecturers)?.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center italic border border-dashed border-border rounded-xl">
                  No lecturers assigned yet.
                </p>
              ) : (
                <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
                  {(getLecturers as typeof programLecturers)?.filter((l): l is NonNullable<typeof l> => !!l).map((l) => (
                    <div key={l._id} className="flex items-center gap-3 px-4 py-3">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">{l.name?.charAt(0) ?? "L"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{l.name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground truncate">{l.email ?? "—"}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer flex-shrink-0"
                        onClick={() => handleRemove(l._id)}
                        title="Remove from program"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Program Access Requests */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Program Access Requests</CardTitle>
          <p className="text-xs text-muted-foreground">
            Review requests from lecturers who want to manage a program's courses.
          </p>
        </CardHeader>
        <CardContent>
          {pendingRequests === undefined ? (
            <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : pendingRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center italic">No pending program access requests.</p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => {
                if (!req.lecturer || !req.program) return null;
                return (
                  <div key={req._id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-border bg-card">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="w-9 h-9 flex-shrink-0">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">{req.lecturer.name?.charAt(0) ?? "L"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{req.lecturer.name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">
                          Requesting: <span className="font-medium text-foreground">{req.program.name}</span>
                        </p>
                        {req.message && (
                          <p className="text-xs text-foreground/70 mt-0.5 italic line-clamp-1">"{req.message}"</p>
                        )}
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(req.requestedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button size="sm" className="h-8 text-xs gap-1 cursor-pointer bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleReview(req._id, "approved", req.lecturer!.name ?? "Lecturer")}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="secondary" className="h-8 text-xs gap-1 cursor-pointer text-destructive hover:text-destructive"
                        onClick={() => handleReview(req._id, "rejected", req.lecturer!.name ?? "Lecturer")}>
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Send Invite Code Panel ────────────────────────────────────────────────────

function SendInviteCodePanel() {
  const codeData = useQuery(api.orgInviteRequests.getOrgInviteCode, {});
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!codeData?.inviteCode) return;
    navigator.clipboard.writeText(codeData.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Invite code copied!");
  };

  // Use the domain the admin is currently on so the link always matches the live/custom domain
  const joinUrl = `${window.location.origin}/institutions`;
  const shareText = codeData
    ? `Join ${codeData.orgName} on RitTutor LMS using invite code: ${codeData.inviteCode}\n\nOpen ${joinUrl}, find your institution, and enter this code.`
    : "";

  const handleShareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const handleShareEmail = () => {
    if (!codeData) return;
    const subject = encodeURIComponent(`Your invite code for ${codeData.orgName} on RitTutor LMS`);
    const body = encodeURIComponent(shareText);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" />
          Share Invite Code
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Share your institution{"'"}s invite code with prospective students and lecturers. They will enter it on the Join page and await your approval.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {codeData === undefined ? (
          <Skeleton className="h-20 w-full" />
        ) : !codeData ? (
          <p className="text-sm text-muted-foreground">Could not load invite code.</p>
        ) : (
          <>
            {/* Code display */}
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-3 bg-muted rounded-xl px-5 py-4 border border-border">
                <Hash className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="font-mono text-2xl font-bold tracking-[0.3em] text-foreground">
                  {codeData.inviteCode}
                </span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="cursor-pointer gap-2 h-14 px-5"
                onClick={handleCopy}
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>

            {/* Share options */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Share via</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="cursor-pointer gap-2"
                  onClick={handleShareWhatsApp}
                >
                  <Send className="w-3.5 h-3.5" />
                  WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="cursor-pointer gap-2"
                  onClick={handleShareEmail}
                >
                  <Send className="w-3.5 h-3.5" />
                  Email
                </Button>
              </div>
            </div>

            {/* Message preview */}
            <div className="rounded-xl border border-border bg-muted/50 p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Message preview</p>
              <p className="text-sm whitespace-pre-wrap text-foreground/80">{shareText}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function OrgAdminPanelInner() {
  const [tab, setTab] = useState<Tab>("members");
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const org = useQuery(api.organizations.getMyOrganization, {});
  const members = useQuery(api.organizations.getOrgMembers, {});
  const fixIds = useMutation(api.organizations.fixDuplicateStudentIds);
  const handleFixIds = async () => {
    try {
      const { fixed } = await fixIds({});
      toast.success(fixed === 0 ? "All student IDs are already unique" : `Gave ${fixed} student${fixed === 1 ? "" : "s"} a new unique ID`);
    } catch {
      toast.error("Could not update student IDs");
    }
  };

  if (currentUser === undefined || org === undefined) return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
    </div>
  );

  // No org yet — show a prompt to create one
  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Building2 className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">No Organization Yet</h2>
          <p className="text-muted-foreground text-sm mt-1">
            You haven't created or joined an organization. Create one to get started — you'll become the admin and can invite your team.
          </p>
        </div>
        <OrgOnboardingEmbed />
      </div>
    );
  }

  const studentCount = members?.filter(m => m.role === "student").length ?? 0;
  const lecturerCount = members?.filter(m => m.role === "lecturer").length ?? 0;
  const adminCount = members?.filter(m => m.role === "admin").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{org?.name ?? "Organization"}</h1>
          <p className="text-muted-foreground text-sm mt-0.5 capitalize">{org?.type ?? ""} · Admin Panel</p>
        </div>
        <Link to="/" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-3 py-2 bg-card hover:bg-muted cursor-pointer flex-shrink-0">
          <Home className="w-3.5 h-3.5" /> Homepage
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Members", value: members?.length ?? 0, icon: Users, color: "text-primary" },
          { label: "Students", value: studentCount, icon: GraduationCap, color: "text-accent" },
          { label: "Lecturers", value: lecturerCount, icon: BookOpen, color: "text-chart-2" },
          { label: "Admins", value: adminCount, icon: Shield, color: "text-chart-4" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border border-border">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <Icon className={cn("w-5 h-5 flex-shrink-0", color)} />
              <div>
                <p className="text-xl font-bold leading-none">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Navigation — categorized dropdown menus */}
      <div className="flex flex-wrap gap-2">
        {TAB_GROUPS.map((group) => {
          const activeItem = group.items.find((i) => i.key === tab);
          const isGroupActive = !!activeItem;
          const isOpen = openGroup === group.label;
          return (
            <div key={group.label} className="relative">
              <button
                onClick={() => setOpenGroup(isOpen ? null : group.label)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all cursor-pointer",
                  isGroupActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-foreground border-border hover:bg-muted"
                )}
              >
                <group.icon className="w-4 h-4" />
                <span>{isGroupActive ? activeItem.label : group.label}</span>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-10" onClick={() => setOpenGroup(null)} />
                  {/* Dropdown */}
                  <div className="absolute left-0 top-full mt-1.5 z-20 bg-popover border border-border rounded-xl shadow-xl min-w-[220px] py-1.5 overflow-hidden">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-1.5">
                      {group.label}
                    </p>
                    {group.items.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => { setTab(item.key); setOpenGroup(null); }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors cursor-pointer",
                          tab === item.key
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted text-foreground"
                        )}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        {item.label}
                        {tab === item.key && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "members" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Organization Members</CardTitle>
            <p className="text-xs text-muted-foreground">
              Change roles or remove members. Share the invite code (in Settings) to add new members.
            </p>
            <Button size="sm" variant="secondary" className="w-fit cursor-pointer mt-2" onClick={handleFixIds}>
              Make student IDs unique
            </Button>
          </CardHeader>
          <CardContent>
            {members === undefined ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No members yet. Share your invite code to get started.</p>
            ) : (
              <div>
                {members.map((m) => (
                  <MemberRow key={m._id} member={m} currentUserId={currentUser!._id} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "requests" && <InviteRequestsPanel />}
      {tab === "sendInviteCode" && <SendInviteCodePanel />}
      {tab === "courseRequests" && <CourseAccessRequestsPanel />}
      {tab === "programRequests" && <ProgramEnrollmentRequestsPanel />}
      {tab === "bulkEnroll" && <BulkEnrollPanel />}
      {tab === "assignCourses" && <AssignCoursesPanel />}
      {tab === "lecturerPrograms" && <LecturerProgramsPanel />}
      {tab === "notifications" && <SendNotificationPanel />}
      {tab === "settings" && <OrgSettings />}
    </div>
  );
}

export default function OrgAdminPanel() {
  return (
    <Authenticated>
      <OrgAdminPanelInner />
    </Authenticated>
  );
}
