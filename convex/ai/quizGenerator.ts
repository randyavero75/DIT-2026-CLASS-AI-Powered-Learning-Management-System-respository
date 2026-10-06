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

export const generateQuizFromPdf = action({
  args: {
    storageId: v.id("_storage"),
    pdfName: v.string(),
    courseId: v.id("courses"),
    quizTitle: v.string(),
    numQuestions: v.number(),
    timeLimit: v.optional(v.number()),
    difficulty: v.optional(v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"))),
    questionStyle: v.optional(v.union(
      v.literal("standard"),    // standard 4-option MCQ
      v.literal("true_false"),  // True/False only
      v.literal("mixed"),       // mix of standard, true/false
    )),
    tone: v.optional(v.string()), // e.g. "academic", "conversational", "exam-style"
    focusTopic: v.optional(v.string()), // specific topic to focus on
  },
  handler: async (ctx, args): Promise<Id<"quizzes">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });

    // Verify lecturer/admin
    const user = await ctx.runQuery(internal.users.getUserByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user || (user.role !== "lecturer" && user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError({ message: "Only lecturers or admins can generate quizzes", code: "FORBIDDEN" });
    }
    if (user.role === "lecturer" && !user.lecturerApproved) {
      throw new ConvexError({ message: "Your lecturer account has not been approved yet", code: "FORBIDDEN" });
    }

    // Fetch PDF bytes from storage
    const pdfUrl = await ctx.storage.getUrl(args.storageId);
    if (!pdfUrl) throw new ConvexError({ message: "PDF not found", code: "NOT_FOUND" });

    const pdfResponse = await fetch(pdfUrl);
    const pdfBuffer = await pdfResponse.arrayBuffer();

    // Extract text from PDF using pdf-parse v2
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: Buffer.from(pdfBuffer) });
    const textResult = await parser.getText();
    await parser.destroy();
    const pdfText = (textResult.text ?? "").slice(0, 12000); // cap to avoid token limits

    if (!pdfText.trim()) {
      throw new ConvexError({ message: "Could not extract text from PDF", code: "BAD_REQUEST" });
    }

    // Call AI to generate quiz
    const openai = new OpenAI({
      baseURL: "https://ai-gateway.hercules.app/v1",
      apiKey: process.env.HERCULES_API_KEY,
    });

    const difficulty = args.difficulty ?? "medium";
    const style = args.questionStyle ?? "standard";
    const tone = args.tone ?? "academic";
    const focusNote = args.focusTopic ? `Focus specifically on: ${args.focusTopic}.` : "";

    const styleInstructions = style === "true_false"
      ? `All questions must be True/False format with exactly 2 options: ["True", "False"]. 
IMPORTANT: Do NOT include the words "True or False:" or "Is it true that" in the question text. Write the question as a declarative statement (e.g. "The mitochondria is the powerhouse of the cell." rather than "True or False: The mitochondria is the powerhouse of the cell.").`
      : style === "mixed"
        ? `Mix of standard 4-option MCQs and True/False questions (roughly 70% MCQ, 30% True/False). For True/False questions, use exactly 2 options: ["True", "False"] and write them as declarative statements — do NOT prefix with "True or False:".`
        : "Each question must have exactly 4 options (A, B, C, D format).";

    const systemPrompt = `You are an expert academic quiz creator. Given content from a PDF, generate exactly ${args.numQuestions} multiple-choice questions.
Difficulty level: ${difficulty}. Tone: ${tone}. ${focusNote}
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
- Questions must be directly based on the provided content
- Keep explanations concise (1-2 sentences)`;

    const response = await openai.chat.completions.create({
      model: "openai/gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate ${args.numQuestions} quiz questions from this content:\n\n${pdfText}` },
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

    // Save quiz and questions to database
    const quizId: Id<"quizzes"> = await ctx.runMutation(internal.quizzes.createQuizWithQuestions, {
      title: args.quizTitle,
      courseId: args.courseId,
      createdBy: user._id,
      orgId: user.orgId ?? undefined,
      timeLimit: args.timeLimit,
      sourcePdfName: args.pdfName,
      sourcePdfStorageId: args.storageId,
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
