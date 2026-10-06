/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_quizGenerator from "../ai/quizGenerator.js";
import type * as ai_topicQuizGenerator from "../ai/topicQuizGenerator.js";
import type * as analytics from "../analytics.js";
import type * as assignments from "../assignments.js";
import type * as attempts from "../attempts.js";
import type * as courseMaterials from "../courseMaterials.js";
import type * as courseRequests from "../courseRequests.js";
import type * as courses from "../courses.js";
import type * as emails from "../emails.js";
import type * as forum from "../forum.js";
import type * as lib_currency from "../lib/currency.js";
import type * as lib_studentId from "../lib/studentId.js";
import type * as library from "../library.js";
import type * as live from "../live.js";
import type * as orgInviteRequests from "../orgInviteRequests.js";
import type * as organizations from "../organizations.js";
import type * as payments from "../payments.js";
import type * as programCategories from "../programCategories.js";
import type * as programEnrollments from "../programEnrollments.js";
import type * as programLecturers from "../programLecturers.js";
import type * as pushIdentities from "../pushIdentities.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as quizzes from "../quizzes.js";
import type * as superadminInvites from "../superadminInvites.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "ai/quizGenerator": typeof ai_quizGenerator;
  "ai/topicQuizGenerator": typeof ai_topicQuizGenerator;
  analytics: typeof analytics;
  assignments: typeof assignments;
  attempts: typeof attempts;
  courseMaterials: typeof courseMaterials;
  courseRequests: typeof courseRequests;
  courses: typeof courses;
  emails: typeof emails;
  forum: typeof forum;
  "lib/currency": typeof lib_currency;
  "lib/studentId": typeof lib_studentId;
  library: typeof library;
  live: typeof live;
  orgInviteRequests: typeof orgInviteRequests;
  organizations: typeof organizations;
  payments: typeof payments;
  programCategories: typeof programCategories;
  programEnrollments: typeof programEnrollments;
  programLecturers: typeof programLecturers;
  pushIdentities: typeof pushIdentities;
  pushNotifications: typeof pushNotifications;
  quizzes: typeof quizzes;
  superadminInvites: typeof superadminInvites;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
