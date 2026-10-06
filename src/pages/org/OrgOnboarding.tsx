import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { GraduationCap, Building2, KeyRound, Plus, ArrowRight, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

type Mode = "choose" | "create" | "join" | "pending";

export default function OrgOnboarding() {
  const [mode, setMode] = useState<Mode>("choose");
  const [loading, setLoading] = useState(false);
  const [pendingOrgName, setPendingOrgName] = useState("");

  // Create form
  const [name, setName] = useState("");
  const [type, setType] = useState<"university" | "school" | "senior_high_school" | "junior_high_school" | "bible_school" | "polytechnic" | "technical" | "nursing" | "vocational" | "business" | "other">("school");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");

  // Join form
  const [inviteCode, setInviteCode] = useState("");

  const createOrg = useMutation(api.organizations.createOrganization);
  const joinOrg = useMutation(api.organizations.joinOrganization);
  const currentUser = useQuery(api.users.getCurrentUser, {});

  // Check if user already has any pending invite requests
  const allRequests = useQuery(api.orgInviteRequests.getMyPendingRequests, {});
  const hasPendingRequest = allRequests && allRequests.length > 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Organization name is required"); return; }
    setLoading(true);
    try {
      await createOrg({ name: name.trim(), type, description: description.trim() || undefined, website: website.trim() || undefined });
      toast.success(`Organization "${name}" created! You're now the admin.`);
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Failed to create organization");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) { toast.error("Invite code is required"); return; }
    setLoading(true);
    try {
      const result = await joinOrg({ inviteCode: inviteCode.trim() });
      setPendingOrgName(result.orgName);
      setMode("pending");
      toast.success(`Request submitted to ${result.orgName}. Awaiting admin approval.`);
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Invalid invite code. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  // If user already has pending requests from before (e.g. refreshed page), show pending state
  if (hasPendingRequest && mode === "choose") {
    const firstRequest = allRequests[0];
    return (
      <PendingApprovalScreen
        orgName={firstRequest.orgName ?? "your institution"}
        requestedAt={firstRequest.createdAt}
        status={firstRequest.status}
        currentUserName={currentUser?.name ?? currentUser?.email ?? ""}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
          <GraduationCap className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-sm">RitTutor LMS Platform</span>
        {currentUser && (
          <span className="ml-auto text-sm text-muted-foreground">Signed in as {currentUser.name ?? currentUser.email}</span>
        )}
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-6">

          {mode === "pending" && (
            <PendingApprovalScreen
              orgName={pendingOrgName}
              requestedAt={new Date().toISOString()}
              status="pending"
              currentUserName={currentUser?.name ?? currentUser?.email ?? ""}
            />
          )}

          {mode === "choose" && (
            <>
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Welcome to RitTutor LMS</h1>
                <p className="text-muted-foreground">
                  RitTutor LMS is a multi-tenant learning platform for schools, universities, and businesses.
                  Get started by creating your organization or joining an existing one.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card
                  className="border-2 border-border hover:border-primary/50 cursor-pointer transition-all hover:shadow-md group"
                  onClick={() => setMode("create")}
                >
                  <CardContent className="pt-6 pb-6 flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Plus className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">Create Organization</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Set up a new school, university, or business account</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>

                <Card
                  className="border-2 border-border hover:border-accent/50 cursor-pointer transition-all hover:shadow-md group"
                  onClick={() => setMode("join")}
                >
                  <CardContent className="pt-6 pb-6 flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                      <KeyRound className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <p className="font-semibold">Join with Invite Code</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Enter the invite code your admin shared with you</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {mode === "create" && (
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Create Your Organization</CardTitle>
                    <CardDescription>You'll become the admin and can invite lecturers and students.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="org-name">Organization Name *</Label>
                    <Input
                      id="org-name"
                      placeholder="e.g. Greenwood High School"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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
                    <Label htmlFor="org-desc">Description</Label>
                    <Textarea
                      id="org-desc"
                      placeholder="Brief description of your organization..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="org-website">Website</Label>
                    <Input
                      id="org-website"
                      placeholder="https://yourschool.edu"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      type="url"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="secondary" className="flex-1 cursor-pointer" onClick={() => setMode("choose")}>
                      Back
                    </Button>
                    <Button type="submit" className="flex-1 cursor-pointer" disabled={loading}>
                      {loading ? "Creating..." : "Create Organization"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {mode === "join" && (
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <KeyRound className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <CardTitle>Join with Invite Code</CardTitle>
                    <CardDescription>
                      Enter the invite code for your organization. Your request will be sent to the admin for approval.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleJoin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-code">Invite Code</Label>
                    <Input
                      id="invite-code"
                      placeholder="e.g. AB12CD"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      className="font-mono text-lg tracking-widest text-center"
                      maxLength={6}
                      required
                    />
                    <p className="text-xs text-muted-foreground">6-character code provided by your organization's admin</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                    <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    Your request will be reviewed by the institution admin before you gain access.
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="secondary" className="flex-1 cursor-pointer" onClick={() => setMode("choose")}>
                      Back
                    </Button>
                    <Button type="submit" className="flex-1 cursor-pointer" disabled={loading}>
                      {loading ? "Submitting..." : "Request to Join"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Pending approval screen ───────────────────────────────────────────────────

function PendingApprovalScreen({
  orgName,
  requestedAt,
  status,
  currentUserName,
}: {
  orgName: string;
  requestedAt: string;
  status: string;
  currentUserName: string;
}) {
  const isRejected = status === "rejected";
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
          <GraduationCap className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-sm">RitTutor LMS Platform</span>
        {currentUserName && (
          <span className="ml-auto text-sm text-muted-foreground">Signed in as {currentUserName}</span>
        )}
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-6">
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${isRejected ? "bg-destructive/10" : "bg-amber-100 dark:bg-amber-900/30"}`}>
            {isRejected
              ? <XCircle className="w-10 h-10 text-destructive" />
              : <Clock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
            }
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              {isRejected ? "Request Not Approved" : "Awaiting Approval"}
            </h1>
            <p className="text-muted-foreground">
              {isRejected
                ? `Your request to join ${orgName} was not approved. Please contact the institution admin for more information.`
                : `Your request to join ${orgName} has been submitted. You'll get access as soon as the institution admin approves your request.`
              }
            </p>
          </div>

          {!isRejected && (
            <div className="bg-card border border-border rounded-2xl p-5 text-left space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Request submitted</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(requestedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-amber-400 mt-0.5 flex-shrink-0 animate-pulse" />
                <div>
                  <p className="text-sm font-medium">Waiting for admin review</p>
                  <p className="text-xs text-muted-foreground">The admin at {orgName} will review your request</p>
                </div>
              </div>
              <div className="flex items-start gap-3 opacity-40">
                <div className="w-4 h-4 rounded-full border-2 border-border mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Access granted</p>
                  <p className="text-xs text-muted-foreground">You'll be taken to your dashboard automatically</p>
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            This page will update automatically when your request is reviewed.
          </p>
        </div>
      </div>
    </div>
  );
}
