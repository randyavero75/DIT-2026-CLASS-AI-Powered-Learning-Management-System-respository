"use node";

import escapeHtml from "escape-html";
import { Hercules } from "@usehercules/sdk";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

const hercules = new Hercules({
  apiKey: process.env.HERCULES_API_KEY!,
  apiVersion: "2025-12-09",
});

// Sends acceptance confirmation to the approved user, and a notification to the superadmin
export const sendApprovalEmails = internalAction({
  args: {
    // User details
    userEmail: v.string(),
    userName: v.optional(v.string()),
    // Institution details
    orgName: v.string(),
    orgEmail: v.string(), // verified sender — the institution's email (from env or fallback)
    // Superadmin details
    superadminEmail: v.string(),
    superadminName: v.optional(v.string()),
    // Role granted
    role: v.string(),
  },
  handler: async (_ctx, args) => {
    const safeUserName = escapeHtml(args.userName ?? "there");
    const safeOrgName = escapeHtml(args.orgName);
    const safeRole = escapeHtml(args.role);
    const safeSuperadminName = escapeHtml(args.superadminName ?? "Super Admin");

    // 1. Confirmation email to the approved user — sender is the institution
    // Wrapped in try/catch: email fails silently if sender is not yet verified in Hercules Emails
    try {
      await hercules.email.send({
        from: args.orgEmail,
        to: args.userEmail,
        subject: `You have been accepted to ${args.orgName} on RitTutor LMS`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background: #2563eb; border-radius: 12px; padding: 12px 20px;">
              <span style="color: white; font-size: 20px; font-weight: bold;">RitTutor LMS</span>
            </div>
          </div>
          <div style="background: white; border-radius: 8px; padding: 32px; border: 1px solid #e5e7eb;">
            <h1 style="color: #111827; font-size: 22px; margin-top: 0;">Welcome to ${safeOrgName}!</h1>
            <p style="color: #374151;">Hi ${safeUserName},</p>
            <p style="color: #374151;">
              Great news! Your request to join <strong>${safeOrgName}</strong> on RitTutor LMS has been <strong style="color: #16a34a;">approved</strong>.
              You now have access to the platform as a <strong>${safeRole}</strong>.
            </p>
            <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="color: #15803d; margin: 0; font-weight: 600;">What's next?</p>
              <p style="color: #166534; margin: 8px 0 0;">
                Log in to RitTutor LMS and head to your dashboard to start exploring your courses, quizzes, and resources.
              </p>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
              If you have any questions, please reach out to the ${safeOrgName} admin team.
            </p>
          </div>
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
            This email was sent by ${safeOrgName} via RitTutor LMS &mdash; AI-Powered Learning Management System
          </p>
        </div>
      `,
      });
    } catch (err) {
      // Log but don't crash — approval still succeeds even if email fails
      console.warn("[RitTutor] Approval email to user failed (sender not verified?):", err);
    }

    // 2. Notification email to the superadmin
    try {
      await hercules.email.send({
        from: args.orgEmail,
        to: args.superadminEmail,
        subject: `[RitTutor LMS] New member approved at ${args.orgName}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background: #2563eb; border-radius: 12px; padding: 12px 20px;">
              <span style="color: white; font-size: 20px; font-weight: bold;">RitTutor LMS</span>
            </div>
          </div>
          <div style="background: white; border-radius: 8px; padding: 32px; border: 1px solid #e5e7eb;">
            <h1 style="color: #111827; font-size: 22px; margin-top: 0;">New Member Approved</h1>
            <p style="color: #374151;">Hi ${safeSuperadminName},</p>
            <p style="color: #374151;">
              A new member has been approved and granted access to <strong>${safeOrgName}</strong>.
            </p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr style="background: #f3f4f6;">
                <td style="padding: 10px 12px; font-weight: 600; color: #374151; width: 40%;">User</td>
                <td style="padding: 10px 12px; color: #111827;">${safeUserName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; font-weight: 600; color: #374151;">Email</td>
                <td style="padding: 10px 12px; color: #111827;">${escapeHtml(args.userEmail)}</td>
              </tr>
              <tr style="background: #f3f4f6;">
                <td style="padding: 10px 12px; font-weight: 600; color: #374151;">Institution</td>
                <td style="padding: 10px 12px; color: #111827;">${safeOrgName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; font-weight: 600; color: #374151;">Role Granted</td>
                <td style="padding: 10px 12px; color: #111827;">${safeRole}</td>
              </tr>
            </table>
            <p style="color: #6b7280; font-size: 14px;">
              This is an automated notification. Log in to RitTutor LMS to manage members.
            </p>
          </div>
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
            RitTutor LMS &mdash; AI-Powered Learning Management System
          </p>
        </div>
      `,
      });
    } catch (err) {
      console.warn("[RitTutor] Notification email to superadmin failed (sender not verified?):", err);
    }
  },
});
