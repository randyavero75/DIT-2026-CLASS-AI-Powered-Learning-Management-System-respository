import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api.js";
import type { QueryCtx } from "./_generated/server";
import { CURRENCIES, DEFAULT_FX_RATES, convertFromGHS, convertToGHS, isCurrency } from "./lib/currency.ts";
import type { CurrencyCode, FxRates } from "./lib/currency.ts";

async function loadRates(ctx: QueryCtx): Promise<FxRates> {
  const row = await ctx.db
    .query("platformConfig")
    .withIndex("by_key", (q) => q.eq("key", "fx_rates"))
    .unique();
  if (!row) return DEFAULT_FX_RATES;
  const saved = JSON.parse(row.value) as Partial<FxRates>;
  return { ...DEFAULT_FX_RATES, ...saved, GHS: 1 };
}

// Rates and live plan prices (GHS) for the pricing page
export const getRates = query({
  args: {},
  handler: async (ctx) => loadRates(ctx),
});

export const internalGetRates = internalQuery({
  args: {},
  handler: async (ctx) => loadRates(ctx),
});

export const updateRates = mutation({
  args: { USD: v.number(), EUR: v.number(), GBP: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || user.role !== "superadmin") {
      throw new ConvexError({ message: "Only superadmin can update rates", code: "FORBIDDEN" });
    }
    if ([args.USD, args.EUR, args.GBP].some((n) => !(n > 0))) {
      throw new ConvexError({ message: "Rates must be positive numbers", code: "BAD_REQUEST" });
    }
    const value = JSON.stringify({ USD: args.USD, EUR: args.EUR, GBP: args.GBP });
    const existing = await ctx.db
      .query("platformConfig")
      .withIndex("by_key", (q) => q.eq("key", "fx_rates"))
      .unique();
    const updatedAt = new Date().toISOString();
    if (existing) await ctx.db.patch(existing._id, { value, updatedAt });
    else await ctx.db.insert("platformConfig", { key: "fx_rates", value, updatedAt });
  },
});

// Default subscription plans with GHS pricing
export const DEFAULT_PLANS = {
  free: { name: "Free", priceGHS: 0, maxStudents: 50, maxCourses: 5, features: ["5 courses", "50 students", "AI quiz generation (10/month)", "Forum access"] },
  pro: { name: "Pro", priceGHS: 199, maxStudents: 500, maxCourses: 50, features: ["50 courses", "500 students", "Unlimited AI quiz generation", "Content library", "Analytics", "Priority support"] },
  enterprise: { name: "Enterprise", priceGHS: 499, maxStudents: 99999, maxCourses: 99999, features: ["Unlimited courses", "Unlimited students", "Unlimited AI quiz generation", "Advanced analytics", "Dedicated support", "Custom branding"] },
} as const;

// PLANS is the live version (may be overridden by superadmin config)
export const PLANS = DEFAULT_PLANS;

export const SUPPORTED_CURRENCIES = CURRENCIES;
export type PlanKey = keyof typeof DEFAULT_PLANS;

const PAYSTACK_BASE = "https://api.paystack.co";

async function paystackPost(endpoint: string, body: Record<string, unknown>, secretKey: string) {
  const res = await fetch(`${PAYSTACK_BASE}${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ status: boolean; message: string; data: Record<string, unknown> }>;
}

async function paystackGet(endpoint: string, secretKey: string) {
  const res = await fetch(`${PAYSTACK_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  return res.json() as Promise<{ status: boolean; message: string; data: Record<string, unknown> }>;
}

// Initialize a payment transaction with Paystack
export const initializePayment = action({
  args: {
    plan: v.union(v.literal("pro"), v.literal("enterprise")),
    callbackUrl: v.string(),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ authorizationUrl: string; reference: string; currency: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) throw new ConvexError({ message: "Payment service not configured. Please contact support.", code: "BAD_REQUEST" });

    const user = await ctx.runQuery(internal.users.getUserByToken, { tokenIdentifier: identity.tokenIdentifier });
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    if (!user.orgId) throw new ConvexError({ message: "You must belong to an organization", code: "BAD_REQUEST" });
    if (user.role !== "admin" && user.role !== "superadmin") {
      throw new ConvexError({ message: "Only org admins can manage billing", code: "FORBIDDEN" });
    }

    const priceGHS = PLANS[args.plan].priceGHS;
    const rates = await ctx.runQuery(internal.payments.internalGetRates, {});
    const wanted: CurrencyCode = args.currency && isCurrency(args.currency) ? args.currency : "GHS";

    const start = async (currency: CurrencyCode) => {
      // Smallest unit (pesewas, cents, pence) = amount * 100
      const amount = Math.round(convertFromGHS(priceGHS, currency, rates) * 100);
      const reference = `eduai_${user.orgId}_${args.plan}_${currency}_${Date.now()}`;
      const response = await paystackPost("/transaction/initialize", {
        email: identity.email ?? `${user._id}@eduai.app`,
        amount,
        currency,
        reference,
        callback_url: args.callbackUrl,
        metadata: {
          orgId: user.orgId,
          userId: user._id,
          plan: args.plan,
          currency,
          custom_fields: [
            { display_name: "Organization", variable_name: "orgId", value: user.orgId },
            { display_name: "Plan", variable_name: "plan", value: args.plan },
          ],
        },
      }, secretKey);
      return { response, currency };
    };

    let attempt = await start(wanted);
    // The Paystack account may not support this currency yet: fall back to GHS
    if (!attempt.response.status && wanted !== "GHS") attempt = await start("GHS");
    const { response, currency } = attempt;

    if (!response.status) {
      throw new ConvexError({ message: response.message ?? "Failed to initialize payment", code: "EXTERNAL_SERVICE_ERROR" });
    }

    return {
      authorizationUrl: response.data.authorization_url as string,
      reference: response.data.reference as string,
      currency,
    };
  },
});

// Verify payment after redirect from Paystack
export const verifyPayment = action({
  args: { reference: v.string() },
  handler: async (ctx, args): Promise<{ success: boolean; plan: string; message: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) throw new ConvexError({ message: "Payment service not configured", code: "BAD_REQUEST" });

    const response = await paystackGet(`/transaction/verify/${encodeURIComponent(args.reference)}`, secretKey);

    if (!response.status || (response.data.status as string) !== "success") {
      return { success: false, plan: "", message: response.message ?? "Payment verification failed" };
    }

    const metadata = response.data.metadata as { orgId: string; plan: string };
    const plan = metadata?.plan as PlanKey;
    const orgId = metadata?.orgId;

    if (!plan || !orgId) {
      return { success: false, plan: "", message: "Invalid payment metadata" };
    }

    const paidCurrency = isCurrency(String(response.data.currency)) ? (String(response.data.currency) as CurrencyCode) : "GHS";
    const amountPaid = (response.data.amount as number) / 100;
    const rates = await ctx.runQuery(internal.payments.internalGetRates, {});

    // Activate the plan
    await ctx.runMutation(internal.payments.activatePlan, {
      orgId: orgId as string,
      plan,
      reference: args.reference,
      amountGHS: convertToGHS(amountPaid, paidCurrency, rates),
      currency: paidCurrency,
      amountPaid,
    });

    return { success: true, plan, message: `${PLANS[plan].name} plan activated successfully!` };
  },
});

// Internal mutation to activate a plan after successful payment
export const activatePlan = internalMutation({
  args: {
    orgId: v.string(),
    plan: v.string(),
    reference: v.string(),
    amountGHS: v.number(),
    currency: v.optional(v.string()),
    amountPaid: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Find the org
    const org = await ctx.db
      .query("organizations")
      .filter((q) => q.eq(q.field("_id"), args.orgId))
      .first();

    if (!org) throw new ConvexError({ message: "Organization not found", code: "NOT_FOUND" });

    // Set plan expiry to 30 days from now
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await ctx.db.patch(org._id, {
      plan: args.plan as PlanKey,
      planExpiresAt: expiresAt,
    });

    // Store payment record
    await ctx.db.insert("payments", {
      orgId: org._id,
      reference: args.reference,
      plan: args.plan as PlanKey,
      amountGHS: args.amountGHS,
      currency: args.currency,
      amountPaid: args.amountPaid,
      status: "success",
      paidAt: new Date().toISOString(),
    });
  },
});

// Get organization's current plan and payment history
export const getOrgBilling = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user?.orgId) return null;

    const org = await ctx.db.get(user.orgId);
    if (!org) return null;

    const history = await ctx.db
      .query("payments")
      .withIndex("by_org", (q) => q.eq("orgId", user.orgId!))
      .order("desc")
      .take(20);

    const plan = (org.plan ?? "free") as PlanKey;
    const planInfo = PLANS[plan];
    const isExpired = org.planExpiresAt ? new Date(org.planExpiresAt) < new Date() : false;
    const effectivePlan = isExpired ? "free" : plan;

    return {
      org: {
        _id: org._id,
        name: org.name,
        plan: effectivePlan,
        planExpiresAt: org.planExpiresAt,
        isExpired,
      },
      planInfo: PLANS[effectivePlan],
      history,
    };
  },
});

// ── Superadmin: get platform config (prices, paystack enabled) ────────────────
export const getPlatformBillingConfig = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || user.role !== "superadmin") return null;

    const priceConfig = await ctx.db
      .query("platformConfig")
      .withIndex("by_key", (q) => q.eq("key", "plan_prices"))
      .unique();
    const paystackConfig = await ctx.db
      .query("platformConfig")
      .withIndex("by_key", (q) => q.eq("key", "paystack_enabled"))
      .unique();

    const prices = priceConfig
      ? (JSON.parse(priceConfig.value) as { pro: number; enterprise: number })
      : { pro: DEFAULT_PLANS.pro.priceGHS, enterprise: DEFAULT_PLANS.enterprise.priceGHS };

    const paystackEnabled = paystackConfig
      ? paystackConfig.value === "true"
      : false;

    return { prices, paystackEnabled };
  },
});

// ── Superadmin: update plan prices ───────────────────────────────────────────
export const updatePlanPrices = mutation({
  args: {
    proPrice: v.number(),
    enterprisePrice: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || user.role !== "superadmin") {
      throw new ConvexError({ message: "Only superadmin can update prices", code: "FORBIDDEN" });
    }

    const existing = await ctx.db
      .query("platformConfig")
      .withIndex("by_key", (q) => q.eq("key", "plan_prices"))
      .unique();
    const value = JSON.stringify({ pro: args.proPrice, enterprise: args.enterprisePrice });
    if (existing) {
      await ctx.db.patch(existing._id, { value, updatedAt: new Date().toISOString() });
    } else {
      await ctx.db.insert("platformConfig", { key: "plan_prices", value, updatedAt: new Date().toISOString() });
    }
  },
});

// ── Superadmin: toggle Paystack enabled ──────────────────────────────────────
export const setPaystackEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || user.role !== "superadmin") {
      throw new ConvexError({ message: "Only superadmin can configure payment settings", code: "FORBIDDEN" });
    }

    const existing = await ctx.db
      .query("platformConfig")
      .withIndex("by_key", (q) => q.eq("key", "paystack_enabled"))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.enabled ? "true" : "false", updatedAt: new Date().toISOString() });
    } else {
      await ctx.db.insert("platformConfig", { key: "paystack_enabled", value: args.enabled ? "true" : "false", updatedAt: new Date().toISOString() });
    }
  },
});

// ── Superadmin: manually activate a plan for an org ──────────────────────────
export const superadminActivatePlan = mutation({
  args: {
    orgId: v.id("organizations"),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    durationDays: v.optional(v.number()), // default 30
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || user.role !== "superadmin") {
      throw new ConvexError({ message: "Only superadmin can manually activate plans", code: "FORBIDDEN" });
    }

    const org = await ctx.db.get(args.orgId);
    if (!org) throw new ConvexError({ message: "Organization not found", code: "NOT_FOUND" });

    const days = args.durationDays ?? 30;
    const expiresAt = args.plan === "free" ? undefined : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    await ctx.db.patch(args.orgId, { plan: args.plan, planExpiresAt: expiresAt });

    // Log as a payment record with GH₵0 (manual activation)
    if (args.plan !== "free") {
      await ctx.db.insert("payments", {
        orgId: args.orgId,
        reference: `manual_${args.orgId}_${args.plan}_${Date.now()}`,
        plan: args.plan,
        amountGHS: 0,
        status: "success",
        paidAt: new Date().toISOString(),
      });
    }
  },
});

// ── Superadmin: get all orgs with billing info ────────────────────────────────
export const getAllOrgsBilling = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user || user.role !== "superadmin") return [];

    const orgs = await ctx.db.query("organizations").collect();
    return orgs.map((org) => {
      const isExpired = org.planExpiresAt ? new Date(org.planExpiresAt) < new Date() : false;
      return {
        _id: org._id,
        name: org.name,
        type: org.type,
        plan: (isExpired ? "free" : (org.plan ?? "free")) as PlanKey,
        planExpiresAt: org.planExpiresAt,
        isExpired,
        isActive: org.isActive !== false,
      };
    });
  },
});
