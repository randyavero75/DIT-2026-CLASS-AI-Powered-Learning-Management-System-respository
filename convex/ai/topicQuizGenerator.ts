"use node";

import { v, ConvexError } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import OpenAI from "openai";
import type { Id } from "../_generated/dataModel.d.ts";

type GeneratedQuestion = {
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  points: number;
};

export const generateQuizFromTopic = action({
  args: {
    courseId: v.id("courses"),
    quizTitle: v.string(),
    topic: v.string(), // what to generate questions about
    numQuestions: v.number(),
    timeLimit: v.optional(v.number()),
    difficulty: v.optional(v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"))),
    questionStyle: v.optional(v.union(
      v.literal("standard"),
      v.literal("true_false"),
      v.literal("mixed"),
    )),
  },
  handler: async (ctx, args): Promise<Id<"quizzes">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

    const user = await ctx.runQuery(internal.users.getUserByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user || (user.role !== "lecturer" && user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError({ message: "Only lecturers or admins can generate quizzes", code: "FORBIDDEN" });
    }
    if (user.role === "lecturer" && !user.lecturerApproved) {
      throw new ConvexError({ message: "Your lecturer account has not been approved yet", code: "FORBIDDEN" });
    }

    const difficulty = args.difficulty ?? "medium";
    const style = args.questionStyle ?? "standard";

    const styleInstructions = style === "true_false"
      ? `All questions must be True/False format with exactly 2 options: ["True", "False"]. 
IMPORTANT: Do NOT include the words "True or False:" in the question text. Write as declarative statements (e.g. "Water boils at 100°C at sea level.").`
      : style === "mixed"
        ? `Mix of standard 4-option MCQs and True/False questions (roughly 70% MCQ, 30% True/False). For True/False, use ["True", "False"] options and declarative statements.`
        : "Each question must have exactly 4 options (A, B, C, D format).";

    const openai = new OpenAI({
      baseURL: "https://ai-gateway.hercules.app/v1",
      apiKey: process.env.HERCULES_API_KEY,
    });

    const systemPrompt = `You are an expert academic quiz creator. Generate exactly ${args.numQuestions} quiz questions about the topic provided.
Difficulty level: ${difficulty}.
${styleInstructions}

Return ONLY a valid JSON array with this exact structure, no markdown, no extra text:
[
  {
    "questionText": "The question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctOptionIndex": 0,
    "explanation": "Brief explanation of why this is correct.",
    "points": 1
  }
]

Rules:
- correctOptionIndex is 0-based (index of the correct option in options array)
- ${difficulty === "easy" ? "Use straightforward recall questions." : difficulty === "hard" ? "Use analytical, application, and synthesis questions." : "Mix of recall and comprehension questions."}
- Keep explanations concise (1-2 sentences)
- Make all questions directly relevant to the given topic`;

    const response = await openai.chat.completions.create({
      model: "openai/gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate ${args.numQuestions} quiz questions about: ${args.topic}` },
      ],
    });

    const rawJson = response.choices[0]?.message?.content ?? "[]";

    let questions: GeneratedQuestion[];
    try {
      questions = JSON.parse(rawJson) as GeneratedQuestion[];
    } catch {
      throw new ConvexError({ message: "AI returned invalid JSON. Please try again.", code: "BAD_REQUEST" });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new ConvexError({ message: "AI did not generate any questions. Please try again.", code: "BAD_REQUEST" });
    }

    const quizId: Id<"quizzes"> = await ctx.runMutation(internal.quizzes.createQuizWithQuestions, {
      title: args.quizTitle,
      courseId: args.courseId,
      createdBy: user._id,
      orgId: user.orgId ?? undefined,
      timeLimit: args.timeLimit,
      questions: questions.map((q, i) => ({
        questionText: q.questionText,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
        explanation: q.explanation ?? "",
        points: q.points ?? 1,
        orderIndex: i,
      })),
    });

    return quizId;
  },
});
