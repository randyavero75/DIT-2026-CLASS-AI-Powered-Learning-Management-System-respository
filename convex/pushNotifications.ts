"use node";

import { Hercules } from "@usehercules/sdk";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";

const hercules = new Hercules({ apiKey: process.env.HERCULES_API_KEY!, apiVersion: "2025-12-09" });

export const getVapidPublicKey = action({
  args: {},
  handler: async () => {
    try {
      const { vapidPublicKey } = await hercules.pushNotifications.enable();
      return { vapidPublicKey };
    } catch (error) {
      console.error("Failed to get VAPID public key:", error);
      throw new Error("Failed to enable push notifications");
    }
  },
});

export const subscribe = action({
  args: { subscription: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const visitorId = identity?.subject ?? crypto.randomUUID();

    const sub = JSON.parse(args.subscription) as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
      expirationTime: number | null;
    };
    const { secret } = await hercules.pushNotifications.subscribe({
      visitorId,
      subscription: {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        expirationTime: sub.expirationTime,
      },
    });

    await ctx.runMutation(internal.pushIdentities.storeIdentity, { secret, visitorId });
    return { secret };
  },
});

export const identify = action({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Must be authenticated to identify", code: "UNAUTHENTICATED" });
    }

    const userId = identity.subject;
    const result = await hercules.pushNotifications.identify({ secret: args.secret, userId });

    if (result.success) {
      await ctx.runMutation(internal.pushIdentities.updateIdentityVisitorId, {
        secret: args.secret,
        visitorId: userId,
      });
    }

    return result;
  },
});

export const unsubscribe = action({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    await hercules.pushNotifications.unsubscribe({ secret: args.secret });
    await ctx.runMutation(internal.pushIdentities.deleteIdentity, { secret: args.secret });
    return { success: true };
  },
});

export const sendNotification = internalAction({
  args: {
    visitorIds: v.optional(v.array(v.string())),
    title: v.string(),
    body: v.optional(v.string()),
    icon: v.optional(v.string()),
    badge: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (_, args) => {
    const result = await hercules.pushNotifications.send({
      visitorIds: args.visitorIds,
      title: args.title,
      body: args.body,
      icon: args.icon,
      badge: args.badge,
      image: args.image,
    });
    return result;
  },
});

// Public action for admins/superadmins to broadcast notifications to their org
export const sendNotificationAsAdmin = action({
  args: {
    title: v.string(),
    body: v.optional(v.string()),
    targetVisitorIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

    const user = await ctx.runQuery(internal.users.getUserByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });

    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError({ message: "Only admins can send notifications", code: "FORBIDDEN" });
    }

    try {
      // Send to specific visitor IDs if provided, otherwise broadcast to all subscribers
      await ctx.runAction(internal.pushNotifications.sendNotification, {
        visitorIds: args.targetVisitorIds,
        title: args.title,
        body: args.body,
      });
    } catch (err) {
      console.error("Push notification send error:", err);
      throw new ConvexError({ message: "Failed to send push notification. Make sure the app is published (push notifications do not work in the App Builder preview).", code: "EXTERNAL_SERVICE_ERROR" });
    }

    return { success: true };
  },
});
