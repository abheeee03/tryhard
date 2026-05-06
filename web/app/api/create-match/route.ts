import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { MatchStatus, Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type CreateMatchBody = {
    time_per_que: number;
    category?: string;
    total_questions: number;
    stake_amount?: number;
    difficulty?: string;
    player1_wallet?: string;
    total_players?: number;
    userId?: string;
};

type GeneratedQuestion = {
    question: string;
    options: string[];
    answer: string;
};

type RawGeneratedQuestion = {
    question?: unknown;
    options?: unknown;
    answer?: unknown;
};


const AI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview";
const geminiApiKey = "AIzaSyB9AwupV2mR698i8bvWlFgKKEFIIf8Omho";
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;
const INVITE_CODE_BYTES = 4;
const MAX_INVITE_CODE_ATTEMPTS = 5;

const generateInviteCode = () =>
    crypto.randomBytes(INVITE_CODE_BYTES).toString("hex").toUpperCase();

const createUniqueInviteCode = async (
    tx: Prisma.TransactionClient
): Promise<string> => {
    for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt += 1) {
        const inviteCode = generateInviteCode();
        const existing = await tx.match.findUnique({
            where: { inviteCode },
            select: { id: true },
        });

        if (!existing) {
            return inviteCode;
        }
    }

    throw new Error("Failed to generate invite code");
};

const normalizeGeneratedQuestions = (
    payload: unknown,
    expectedCount: number
): GeneratedQuestion[] => {
    if (!payload || typeof payload !== "object") {
        return [];
    }

    const questions = (payload as { questions?: unknown }).questions;
    if (!Array.isArray(questions)) {
        return [];
    }

    const normalized = questions
        .map((raw): GeneratedQuestion | null => {
            const questionObj = raw as RawGeneratedQuestion;
            const questionText =
                typeof questionObj.question === "string"
                    ? questionObj.question.trim()
                    : "";
            if (!questionText) {
                return null;
            }

            let optionStrings: string[] = [];
            if (Array.isArray(questionObj.options)) {
                const options = questionObj.options as Array<
                    string | { index?: number; option?: string }
                >;

                if (options.length && typeof options[0] === "object") {
                    optionStrings = options
                        .map((option, index) => {
                            if (!option || typeof option !== "object") {
                                return null;
                            }

                            const optionIndex =
                                typeof option.index === "number"
                                    ? option.index
                                    : index;
                            const optionText =
                                typeof option.option === "string"
                                    ? option.option.trim()
                                    : "";

                            if (!optionText) {
                                return null;
                            }

                            return { index: optionIndex, option: optionText };
                        })
                        .filter(
                            (option): option is { index: number; option: string } =>
                                option !== null
                        )
                        .sort((a, b) => a.index - b.index)
                        .map((option) => option.option);
                } else {
                    optionStrings = options
                        .map((option) =>
                            typeof option === "string" ? option.trim() : ""
                        )
                        .filter(Boolean);
                }
            }

            if (optionStrings.length < 2) {
                return null;
            }

            let correctAnswer = "";
            if (
                typeof questionObj.answer === "number" &&
                Number.isInteger(questionObj.answer) &&
                questionObj.answer >= 0 &&
                questionObj.answer < optionStrings.length
            ) {
                correctAnswer = optionStrings[questionObj.answer];
            } else if (typeof questionObj.answer === "string") {
                const answerText = questionObj.answer.trim();
                if (answerText && optionStrings.includes(answerText)) {
                    correctAnswer = answerText;
                }
            }

            if (!correctAnswer) {
                return null;
            }

            return {
                question: questionText,
                options: optionStrings,
                answer: correctAnswer,
            };
        })
        .filter((question): question is GeneratedQuestion => question !== null);

    return normalized.slice(0, expectedCount);
};

const parseQuestionsJson = (text: string): unknown => {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const cleanedText = jsonMatch ? jsonMatch[1].trim() : text.trim();

    try {
        return JSON.parse(cleanedText);
    } catch (error) {
        const firstBrace = text.indexOf("{");
        const lastBrace = text.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1) {
            return JSON.parse(text.substring(firstBrace, lastBrace + 1));
        }
        throw error;
    }
};

const generateQuestions = async (
    category: string | undefined,
    totalQuestions: number,
    difficulty: string | undefined
): Promise<{ questions: GeneratedQuestion[] }> => {
    if (!ai) {
        throw new Error("Missing GEMINI_API_KEY");
    }

    const topic = category?.trim() || "General";
    const level = difficulty?.trim() || "easy";
    const count = Math.max(0, Math.trunc(totalQuestions));

    const prompt = `
    Generate ${count} quiz questions along with the options and correct answer about "${topic}" with difficulty level - "${level}".
    IMPORTANT: return STRICT JSON only, no markdown and no extra text. Use this schema exactly:
    {
     "questions": [{
        "question": "Question Number 1",
        "options": [
            {"index": 0, "option": "Option Number 1"},
            {"index": 1, "option": "Option Number 2"},
            {"index": 2, "option": "Option Number 3"},
            {"index": 3, "option": "Option Number 4"}
        ],
        "answer": 0
     }]
    }`;

    const response = await ai.models.generateContent({
        model: AI_MODEL,
        contents: prompt,
    });
    const text = response.text || "";

    const parsed = parseQuestionsJson(text);
    const normalizedQuestions = normalizeGeneratedQuestions(parsed, count);

    if (!normalizedQuestions.length) {
        throw new Error("Failed to parse questions JSON");
    }

    return { questions: normalizedQuestions };
};

export async function POST(req: NextRequest) {
    let body: CreateMatchBody;

    try {
        body = await req.json();
    } catch {
        return NextResponse.json(
            { status: "FAILED", error: "Invalid JSON body" },
            { status: 400 }
        );
    }

    const timePerQRaw = Number(body.time_per_que);
    const questionCountRaw = Number(body.total_questions);
    const stakeAmountRaw = Number(body.stake_amount ?? 0);
    const totalPlayersRaw = Number(body.total_players ?? 2);

    if (!Number.isFinite(timePerQRaw) || timePerQRaw <= 0) {
        return NextResponse.json(
            { status: "FAILED", error: "Invalid time_per_que" },
            { status: 400 }
        );
    }

    if (!Number.isFinite(questionCountRaw) || questionCountRaw <= 0) {
        return NextResponse.json(
            { status: "FAILED", error: "Invalid total_questions" },
            { status: 400 }
        );
    }

    if (!Number.isFinite(stakeAmountRaw) || stakeAmountRaw < 0) {
        return NextResponse.json(
            { status: "FAILED", error: "Invalid stake_amount" },
            { status: 400 }
        );
    }

    const timePerQ = Math.trunc(timePerQRaw);
    const questionCount = Math.trunc(questionCountRaw);
    const stakeAmount = stakeAmountRaw;
    const totalPlayers =
        Number.isFinite(totalPlayersRaw) && totalPlayersRaw > 0
            ? Math.trunc(totalPlayersRaw)
            : 2;

    const bodyUserId = body.userId
    const wallet = body.player1_wallet?.trim();

    let creatorId =  bodyUserId ?? undefined;

    try {
        if (!creatorId && wallet) {
            const existingUser = await prisma.user.findUnique({
                where: { wallet },
            });

            if (existingUser) {
                creatorId = existingUser.id;
            } else {
                const createdUser = await prisma.user.create({
                    data: { wallet },
                });
                creatorId = createdUser.id;
            }
        }

        if (!creatorId) {
            return NextResponse.json(
                { status: "FAILED", error: "Missing user id" },
                { status: 401 }
            );
        }

        const resolvedCreatorId = creatorId;

        console.log(
            `[match] Creating match: user=${resolvedCreatorId}, category=${body.category ?? "none"}, stake=${stakeAmount}`
        );

        const generated = await generateQuestions(
            body.category,
            questionCount,
            body.difficulty
        );

        if (!generated.questions.length) {
            return NextResponse.json(
                { status: "FAILED", error: "No questions generated" },
                { status: 500 }
            );
        }

        const match = await prisma.$transaction(
            async (tx) => {
            const inviteCode = await createUniqueInviteCode(tx);
            const createdMatch = await tx.match.create({
                data: {
                    creatorId: resolvedCreatorId,
                    inviteCode,
                    stakeAmount,
                    totalPlayers,
                    questionCount,
                    timePerQ,
                    status: MatchStatus.WAITING,
                },
            });

            await tx.question.createMany({
                data: generated.questions.map((question, index) => ({
                    matchId: createdMatch.id,
                    question: question.question,
                    options: question.options,
                    correctAns: question.answer,
                    order: index,
                })),
            });

            await tx.matchPlayer.create({
                data: {
                    userId: resolvedCreatorId,
                    matchId: createdMatch.id,
                },
            });

            return createdMatch;
            },
            {
                maxWait: 10000,
                timeout: 20000,
            }
        );

        console.log(`[match] Match created: id=${match.id}, stake=${stakeAmount}`);

        return NextResponse.json(
            {
                status: "SUCCESS",
                data: { match },
            },
            { status: 201 }
        );
    } catch (err) {
        console.error("[match] Error creating match:", err);
        return NextResponse.json(
            { status: "FAILED", error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

export const createMatch = POST;