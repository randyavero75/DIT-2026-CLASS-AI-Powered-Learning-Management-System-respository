import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import {
  CheckCircle,
  CreditCard,
  Zap,
  Building2,
  Crown,
  History,
  AlertCircle,
  Smartphone,
} from "lucide-react";
import { format } from "date-fns";
import { PLANS } from "@/convex/payments.ts";
import type { PlanKey } from "@/convex/payments.ts";
import {
  CURRENCIES, CURRENCY_META, DEFAULT_FX_RATES, convertFromGHS, currencyForRegion, formatMoney, isCurrency,
} from "@/convex/lib/currency.ts";
import type { CurrencyCode } from "@/convex/lib/currency.ts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";

const CURRENCY_KEY = "billing_currency";

// Default from a saved choice, otherwise the account country (browser region)
function initialCurrency(): CurrencyCode {
  const saved = localStorage.getItem(CURRENCY_KEY);
  if (saved && isCurrency(saved)) return saved;
  const region = navigator.language.split("-")[1];
  return currencyForRegion(region);
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free: <Zap className="w-5 h-5" />,
  pro: <CreditCard className="w-5 h-5" />,
  enterprise: <Crown className="w-5 h-5" />,
};

const PLAN_COLORS: Record<string, string> = {
  free: "border-border",
  pro: "border-primary ring-1 ring-primary",
  enterprise: "border-amber-500 ring-1 ring-amber-500",
};

const PLAN_BADGE: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-primary/10 text-primary",
  enterprise: "bg-amber-500/10 text-amber-600",
};

function BillingInner() {
  const billing = useQuery(api.payments.getOrgBilling, {});
  const initializePayment = useAction(api.payments.initializePayment);
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>(initialCurrency);
  const rates = useQuery(api.payments.getRates, {}) ?? DEFAULT_FX_RATES;

  const changeCurrency = (value: string) => {
    if (!isCurrency(value)) return;
    setCurrency(value);
    localStorage.setItem(CURRENCY_KEY, value);
  };
  const price = (ghs: number) => formatMoney(convertFromGHS(ghs, currency, rates), currency);

  const handleUpgrade = async (plan: PlanKey) => {
    if (plan === "free") return;
    setLoadingPlan(plan);
    try {
      const callbackUrl = `${window.location.origin}/billing?verify=1`;
      const result = await initializePayment({ plan, callbackUrl, currency });
      if (currency !== result.currency) {
        toast.info(`${currency} is not enabled on the payment account yet, so you will pay in ${result.currency}.`);
      }
      window.location.href = result.authorizationUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start payment";
      toast.error(message);
      setLoadingPlan(null);
    }
  };

  if (billing === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      </div>
    );
  }

  if (!billing) {
    return (
      <Card className="p-8 text-center">
        <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <p className="font-semibold">No organization found</p>
        <p className="text-sm text-muted-foreground">You must belong to an organization to manage billing.</p>
      </Card>
    );
  }

  const { org, planInfo, history } = billing;
  const currentPlan = org.plan as PlanKey;

  return (
    <div className="space-y-8">
      {/* Current plan banner */}
      <Card className={`border-2 ${PLAN_COLORS[currentPlan]}`}>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                {PLAN_ICONS[currentPlan]}
              </div>
              <div>
                <CardTitle className="text-lg">Current Plan: {planInfo.name}</CardTitle>
                {org.planExpiresAt && (
                  <CardDescription>
                    {org.isExpired
                      ? <span className="text-destructive flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Plan expired. Downgraded to Free.</span>
                      : `Renews ${format(new Date(org.planExpiresAt), "MMM d, yyyy")}`
                    }
                  </CardDescription>
                )}
              </div>
            </div>
            <Badge className={PLAN_BADGE[currentPlan]}>{planInfo.name}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {planInfo.features.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment methods notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground">
        <Smartphone className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
        <div>
          <p className="font-medium text-foreground">Accepted Payments</p>
          <p>We accept <strong>MTN MoMo</strong>, <strong>Vodafone Cash</strong>, <strong>AirtelTigo Money</strong>, and <strong>Visa/Mastercard</strong> via Paystack. Pick GHS, USD, EUR or GBP below; prices convert automatically.</p>
        </div>
      </div>

      {/* Pricing plans */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-xl font-bold">Choose a Plan</h2>
          <Select value={currency} onValueChange={changeCurrency}>
            <SelectTrigger className="w-56 cursor-pointer" aria-label="Currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c} · {CURRENCY_META[c].name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][]).map(([key, plan]) => {
            const isCurrent = currentPlan === key;
            return (
              <Card
                key={key}
                className={`relative flex flex-col border-2 transition-all ${isCurrent ? PLAN_COLORS[key] : "border-border hover:border-primary/40"}`}
              >
                {key === "pro" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-xs">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2 mb-2 text-primary">
                    {PLAN_ICONS[key]}
                    <CardTitle>{plan.name}</CardTitle>
                  </div>
                  <div className="flex items-end gap-1">
                    {plan.priceGHS === 0
                      ? <span className="text-3xl font-bold">Free</span>
                      : <>
                          <span className="text-3xl font-bold">{price(plan.priceGHS)}</span>
                          <span className="text-muted-foreground text-sm pb-1">/month</span>
                        </>
                    }
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1">
                  <ul className="space-y-2 flex-1 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : key === "free" ? (
                    <Button className="w-full" variant="secondary" disabled>
                      Downgrade
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handleUpgrade(key)}
                      disabled={loadingPlan !== null}
                    >
                      {loadingPlan === key ? "Redirecting..." : `Upgrade to ${plan.name}`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Payment history */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="w-4 h-4" />
              Payment History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((payment) => (
                <div key={payment._id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize">{payment.plan} Plan</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(payment.paidAt), "MMM d, yyyy 'at' h:mm a")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {payment.currency && isCurrency(payment.currency) && payment.amountPaid !== undefined
                        ? formatMoney(payment.amountPaid, payment.currency)
                        : formatMoney(payment.amountGHS, "GHS")}
                    </p>
                    <Badge variant="outline" className="text-xs text-green-600 border-green-300">Paid</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your organization's plan. Pay with MoMo or card.</p>
      </div>
      <Unauthenticated>
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-muted-foreground">Sign in to manage billing</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <Authenticated>
        <BillingInner />
      </Authenticated>
    </div>
  );
}
