import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Label } from "@/components/ui/label.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  GraduationCap,
  Search,
  Building2,
  Globe,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowLeft,
  Users,
  Sparkles,
  User,
  Phone,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const TYPE_LABELS: Record<string, string> = {
  university: "University",
  school: "School",
  business: "Business / Corporate",
  other: "Other",
};

const TYPE_COLORS: Record<string, string> = {
  university: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  school: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  business: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  other: "bg-muted text-muted-foreground",
};

function RequestDialog({
  orgId,
  orgName,
  onClose,
}: {
  orgId: Id<"organizations">;
  orgName: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ fullName: "", phone: "", contactEmail: "", message: "" });
  const [loading, setLoading] = useState(false);
  const requestCode = useMutation(api.orgInviteRequests.requestInviteCode);

  const handleSubmit = async () => {
    if (!form.fullName.trim()) { toast.error("Full name is required"); return; }
    if (!form.phone.trim()) { toast.error("Phone number is required"); return; }
    setLoading(true);
    try {
      await requestCode({
        orgId,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        contactEmail: form.contactEmail.trim() || undefined,
        message: form.message.trim() || undefined,
      });
      toast.success("Request sent! The admin will review it and contact you.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" />
            Request to Join {orgName}
          </DialogTitle>
          <DialogDescription>
            Provide your contact details so the admin can verify and reach you.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="req-name" className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="req-name"
              placeholder="e.g. John Kwame Asante"
              value={form.fullName}
              onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-phone" className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Phone Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="req-phone"
              placeholder="e.g. +233 24 000 0000"
              value={form.phone}
              onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-email" className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Contact Email
            </Label>
            <Input
              id="req-email"
              type="email"
              placeholder="e.g. john@example.com"
              value={form.contactEmail}
              onChange={(e) => setForm(f => ({ ...f, contactEmail: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-msg">Additional Message (optional)</Label>
            <Textarea
              id="req-msg"
              placeholder="Introduce yourself or explain why you want to join..."
              value={form.message}
              onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" onClick={onClose} disabled={loading} className="cursor-pointer">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="cursor-pointer gap-1">
              <Send className="w-3.5 h-3.5" />
              {loading ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrgCardAuthenticated({ org }: { org: { _id: Id<"organizations">; name: string; slug: string; type?: string; description?: string; website?: string } }) {
  const [showRequest, setShowRequest] = useState(false);
  const myRequest = useQuery(api.orgInviteRequests.getMyRequestStatus, { orgId: org._id });
  const myMembership = useQuery(api.organizations.getMyOrgMembership, { orgId: org._id });
  const switchOrg = useMutation(api.organizations.switchActiveOrg);
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);

  // Load the institution: switch the active context if needed, then go to its dashboard
  const handleOpen = async () => {
    setOpening(true);
    try {
      if (!myMembership?.isActive) await switchOrg({ orgId: org._id });
      navigate("/dashboard");
    } catch {
      toast.error("Could not open this institution");
      setOpening(false);
    }
  };

  const status = myRequest?.status;

  return (
    <>
      <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all border border-border h-full flex flex-col">
        <CardHeader className="pb-3 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            {org.type && (
              <Badge className={`text-xs ${TYPE_COLORS[org.type] ?? TYPE_COLORS.other}`}>
                {TYPE_LABELS[org.type] ?? org.type}
              </Badge>
            )}
          </div>
          <CardTitle className="text-base mt-2 leading-snug">{org.name}</CardTitle>
          {org.description && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{org.description}</p>
          )}
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {org.website && (
            <a
              href={org.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              {org.website.replace(/^https?:\/\//, "")}
            </a>
          )}

          {myMembership?.isMember ? (
            <Button size="sm" className="w-full cursor-pointer gap-1" disabled={opening} onClick={handleOpen}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              {opening ? "Opening..." : myMembership.isActive ? "Open (current institution)" : "Open institution"}
            </Button>
          ) : status === "pending" ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <Clock className="w-3.5 h-3.5" /> Request pending review
            </div>
          ) : status === "approved" ? (
            <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Approved — check your email or contact the admin
            </div>
          ) : status === "rejected" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <XCircle className="w-3.5 h-3.5" /> Request was not approved
              </div>
              <Button
                size="sm"
                className="w-full cursor-pointer gap-1"
                onClick={() => setShowRequest(true)}
              >
                <Send className="w-3.5 h-3.5" />
                Re-request
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="w-full cursor-pointer gap-1"
              onClick={() => setShowRequest(true)}
            >
              <Send className="w-3.5 h-3.5" />
              Request Enrollment Code
            </Button>
          )}
        </CardContent>
      </Card>

      {showRequest && (
        <RequestDialog
          orgId={org._id}
          orgName={org.name}
          onClose={() => setShowRequest(false)}
        />
      )}
    </>
  );
}

function OrgCardGuest({ org }: { org: { _id: Id<"organizations">; name: string; slug: string; type?: string; description?: string; website?: string } }) {
  return (
    <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all border border-border h-full flex flex-col">
      <CardHeader className="pb-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          {org.type && (
            <Badge className={`text-xs ${TYPE_COLORS[org.type] ?? TYPE_COLORS.other}`}>
              {TYPE_LABELS[org.type] ?? org.type}
            </Badge>
          )}
        </div>
        <CardTitle className="text-base mt-2 leading-snug">{org.name}</CardTitle>
        {org.description && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{org.description}</p>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {org.website && (
          <a
            href={org.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            {org.website.replace(/^https?:\/\//, "")}
          </a>
        )}
        <SignInButton />
      </CardContent>
    </Card>
  );
}

function InstitutionsList({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [search, setSearch] = useState("");
  const orgs = useQuery(api.orgInviteRequests.listPublicOrganizations, {});

  const filtered = (orgs ?? []).filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.description?.toLowerCase().includes(search.toLowerCase()) ||
    o.type?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Search bar */}
      <div className="relative max-w-lg mx-auto mb-10">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by name, type, or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-11 shadow-sm"
        />
      </div>

      {/* Results */}
      {orgs === undefined ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No institutions found</p>
          <p className="text-sm mt-1">
            {search ? "Try a different search term." : "No institutions have been registered yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((org, i) => (
            <motion.div
              key={org._id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              {isAuthenticated ? (
                <OrgCardAuthenticated org={org} />
              ) : (
                <OrgCardGuest org={org} />
              )}
            </motion.div>
          ))}
        </div>
      )}

      {orgs && orgs.length > 0 && (
        <p className="text-center text-xs text-muted-foreground mt-8">
          Showing {filtered.length} of {orgs.length} registered institution{orgs.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

export default function InstitutionsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-base hidden sm:block">RitTutor LMS</span>
            </div>
          </div>
          <Unauthenticated>
            <SignInButton />
          </Unauthenticated>
          <Authenticated>
            <Link to="/dashboard">
              <Button size="sm" className="cursor-pointer gap-1.5">
                Dashboard
              </Button>
            </Link>
          </Authenticated>
          <AuthLoading>
            <Skeleton className="h-8 w-24" />
          </AuthLoading>
        </div>
      </div>

      {/* Hero banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5 border-b border-border">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-72 h-72 bg-primary/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-accent/8 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 border border-primary/20">
              <Sparkles className="w-3.5 h-3.5" />
              Discover & Join
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4 text-balance">
              Find Your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                Institution
              </span>
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto text-base md:text-lg">
              Browse registered schools, universities, and organizations. Request an enrollment code to join and access AI-powered learning tools.
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap justify-center gap-6 mt-8">
              {[
                { icon: Building2, label: "Registered Institutions" },
                { icon: Users, label: "Active Learners" },
                { icon: Sparkles, label: "AI-Powered Quizzes" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="w-4 h-4 text-primary" />
                  {label}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content — accessible to everyone */}
      <AuthLoading>
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
          </div>
        </div>
      </AuthLoading>
      <Unauthenticated>
        <InstitutionsList isAuthenticated={false} />
      </Unauthenticated>
      <Authenticated>
        <InstitutionsList isAuthenticated={true} />
      </Authenticated>
    </div>
  );
}
