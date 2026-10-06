import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  CreditCard,
  Building2,
  Crown,
  Zap,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  DollarSign,
  Power,
  Calendar,
  UserPlus,
  Mail,
} from "lucide-react";
import { format } from "date-fns";
import RatesCard from "./_rates-card.tsx";
import { DEFAULT_PLANS } from "@/convex/payments.ts";
import type { PlanKey } from "@/convex/payments.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { ConvexError } from "convex/values";

const PLAN_COLORS: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-primary/10 text-primary",
  enterprise: "bg-amber-500/10 text-amber-600",
};

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free: <Zap className="w-4 h-4" />,
  pro: <CreditCard className="w-4 h-4" />,
  enterprise: <Crown className="w-4 h-4" />,
};

// ── Activate Plan Dialog ──────────────────────────────────────────────────────

function ActivatePlanDialog({
  org,
  onClose,
}: {
  org: { _id: Id<"organizations">; name: string; plan: PlanKey };
  onClose: () => void;
}) {
  const activatePlan = useMutation(api.payments.superadminActivatePlan);
  const [plan, setPlan] = useState<PlanKey>(org.plan);
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    setLoading(true);
    try {
      await activatePlan({ orgId: org._id, plan, durationDays: parseInt(days) || 30 });
      toast.success(`${org.name} upgraded to ${plan} plan (${days} days)`);
      onClose();
    } catch {
      toast.error("Failed to activate plan");
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Power className="w-4 h-4 text-primary" />
            Activate Plan for {org.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Plan</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as PlanKey)}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {plan !== "free" && (
            <div className="space-y-2">
              <Label>Duration (days)</Label>
              <Input
                type="number"
                value={days}
                min={1}
                onChange={(e) => setDays(e.target.value)}
                placeholder="30"
              />
              <p className="text-xs text-muted-foreground">
                Expires: {format(new Date(Date.now() + parseInt(days || "30") * 24 * 60 * 60 * 1000), "MMM d, yyyy")}
              </p>
            </div>
          )}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
            This is a manual activation — no payment will be charged.
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleActivate} disabled={loading} className="cursor-pointer">
            {loading ? "Activating..." : "Activate Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Inner Page ────────────────────────────────────────────────────────────────

function SuperadminBillingInner() {
  const config = useQuery(api.payments.getPlatformBillingConfig, {});
  const allOrgs = useQuery(api.payments.getAllOrgsBilling, {});
  const updatePrices = useMutation(api.payments.updatePlanPrices);
  const setPaystackEnabled = useMutation(api.payments.setPaystackEnabled);

  const [proPrice, setProPrice] = useState<string>("");
  const [enterprisePrice, setEnterprisePrice] = useState<string>("");
  const [savingPrices, setSavingPrices] = useState(false);
  const [togglingPaystack, setTogglingPaystack] = useState(false);
  const [activateOrg, setActivateOrg] = useState<{ _id: Id<"organizations">; name: string; plan: PlanKey } | null>(null);

  // Populate inputs when config loads
  const currentProPrice = config?.prices.pro ?? DEFAULT_PLANS.pro.priceGHS;
  const currentEnterprisePrice = config?.prices.enterprise ?? DEFAULT_PLANS.enterprise.priceGHS;

  const handleSavePrices = async () => {
    const pro = parseFloat(proPrice || String(currentProPrice));
    const enterprise = parseFloat(enterprisePrice || String(currentEnterprisePrice));
    if (isNaN(pro) || isNaN(enterprise) || pro < 0 || enterprise < 0) {
      toast.error("Please enter valid prices");
      return;
    }
    setSavingPrices(true);
    try {
      await updatePrices({ proPrice: pro, enterprisePrice: enterprise });
      toast.success("Plan prices updated");
      setProPrice("");
      setEnterprisePrice("");
    } catch {
      toast.error("Failed to update prices");
    } finally {
      setSavingPrices(false);
    }
  };

  const handleTogglePaystack = async () => {
    if (!config) return;
    setTogglingPaystack(true);
    try {
      await setPaystackEnabled({ enabled: !config.paystackEnabled });
      toast.success(config.paystackEnabled ? "Paystack disabled" : "Paystack enabled");
    } catch {
      toast.error("Failed to toggle Paystack");
    } finally {
      setTogglingPaystack(false);
    }
  };

  if (config === undefined || allOrgs === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  if (config === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
        <ShieldCheck className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-xl font-bold">Superadmin Only</h2>
        <p className="text-muted-foreground">Only the platform superadmin can access this page.</p>
      </div>
    );
  }

  const realOrgs = allOrgs.filter(o => o.name.toLowerCase() !== "knust");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Platform Billing</h1>
        <p className="text-muted-foreground mt-1">Manage subscription prices, Paystack, and org plans.</p>
      </div>

      {/* Paystack Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-4 h-4 text-primary" />
            Paystack Integration
          </CardTitle>
          <CardDescription>Enable or disable Paystack payments globally. When disabled, orgs cannot initiate new payments.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${config.paystackEnabled ? "bg-green-500" : "bg-red-400"}`} />
              <span className="text-sm font-medium">
                Paystack is currently <strong>{config.paystackEnabled ? "enabled" : "disabled"}</strong>
              </span>
            </div>
            <Button
              variant="secondary"
              className="cursor-pointer gap-2"
              onClick={handleTogglePaystack}
              disabled={togglingPaystack}
            >
              {config.paystackEnabled
                ? <><ToggleRight className="w-4 h-4 text-green-600" /> Disable</>
                : <><ToggleLeft className="w-4 h-4 text-muted-foreground" /> Enable</>
              }
            </Button>
          </div>
          {!config.paystackEnabled && (
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Make sure <code className="bg-muted px-1 rounded">PAYSTACK_SECRET_KEY</code> is set in Secrets before enabling.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Plan Prices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="w-4 h-4 text-primary" />
            Plan Prices (GHS)
          </CardTitle>
          <CardDescription>Set the monthly prices for Pro and Enterprise plans. Changes apply to new payments immediately.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pro Plan Price (GH₵/month)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Current: GH₵{currentProPrice}</span>
              </div>
              <Input
                type="number"
                min={0}
                placeholder={String(currentProPrice)}
                value={proPrice}
                onChange={(e) => setProPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Enterprise Plan Price (GH₵/month)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Current: GH₵{currentEnterprisePrice}</span>
              </div>
              <Input
                type="number"
                min={0}
                placeholder={String(currentEnterprisePrice)}
                value={enterprisePrice}
                onChange={(e) => setEnterprisePrice(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleSavePrices} disabled={savingPrices} className="cursor-pointer">
            {savingPrices ? "Saving..." : "Save Prices"}
          </Button>
        </CardContent>
      </Card>

      <RatesCard />

      {/* All Orgs Plans */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Institution Plans</h2>
          <Badge variant="secondary">{realOrgs.length}</Badge>
        </div>
        {realOrgs.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No institutions registered yet.</p>
        ) : (
          <div className="space-y-3">
            {realOrgs.map((org) => (
              <div key={org._id} className={`flex items-center gap-4 p-4 rounded-xl border border-border bg-card transition-opacity ${!org.isActive ? "opacity-60" : ""}`}>
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{org.name}</p>
                    {org.type && <Badge variant="secondary" className="text-xs capitalize">{org.type}</Badge>}
                    {!org.isActive && <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">Deactivated</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`text-xs capitalize flex items-center gap-1 ${PLAN_COLORS[org.plan]}`}>
                      {PLAN_ICONS[org.plan]} {org.plan}
                    </Badge>
                    {org.planExpiresAt && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {org.isExpired ? "Expired" : `Until ${format(new Date(org.planExpiresAt), "MMM d, yyyy")}`}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs cursor-pointer gap-1 flex-shrink-0"
                  onClick={() => setActivateOrg({ _id: org._id, name: org.name, plan: org.plan })}
                >
                  <Power className="w-3.5 h-3.5" /> Manage Plan
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {activateOrg && (
        <ActivatePlanDialog org={activateOrg} onClose={() => setActivateOrg(null)} />
      )}
    </div>
  );
}

export default function SuperadminBillingPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Authenticated>
        <InviteSuperAdminPanel />
        <SuperadminBillingInner />
      </Authenticated>
    </div>
  );
}

function InviteSuperAdminPanel() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const inviteSuperAdmin = useMutation(api.superadminInvites.inviteSuperAdmin);
  const pendingInvites = useQuery(api.superadminInvites.listPendingInvites, {});

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const result = await inviteSuperAdmin({ email: email.trim() });
      if (result.type === "promoted") {
        toast.success(`${result.email} already has an account — they've been promoted to superadmin!`);
      } else {
        toast.success(`Invite sent to ${result.email}. They'll become superadmin when they sign up.`);
      }
      setEmail("");
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Failed to send invite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="w-4 h-4 text-primary" /> Invite Superadmin
        </CardTitle>
        <CardDescription>
          Add another superadmin by email. If they already have an account, they{"'"}ll be promoted immediately. Otherwise, they{"'"}ll become superadmin when they sign up.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleInvite} className="flex gap-2">
          <div className="flex-1">
            <Input
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="cursor-pointer gap-2 flex-shrink-0" disabled={loading}>
            <Mail className="w-4 h-4" />
            {loading ? "Sending..." : "Invite"}
          </Button>
        </form>

        {pendingInvites && pendingInvites.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Pending invites (expire in 7 days):</p>
            <div className="space-y-2">
              {pendingInvites.map((invite) => (
                <div key={invite._id} className="flex items-center gap-2 text-sm py-1.5 px-3 bg-muted rounded-lg">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1">{invite.email}</span>
                  <Badge variant="secondary" className="text-xs">Pending</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
