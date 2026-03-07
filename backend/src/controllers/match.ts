import { Request, Response } from "express";
import { supabase } from "../utils/supabase";
import { generateQuestions } from "../utils/questions";
import { Question } from "../utils/types";
import crypto from "crypto";

function generateMatchCode(): string {
    return crypto.randomBytes(3).toString('hex').toUpperCase(); // 6-char hex e.g. "A3F1B2"
}

export const createMatch = async (req: Request, res: Response) => {
    const { time_per_que, category, total_questions, stake_amount, difficulty, player1_wallet } = req.body;
    const { userID } = req;
    try {
        const matchCode = generateMatchCode();
        console.log(`[match] Creating match: user=${userID}, category=${category}, stake=${stake_amount}, wallet=${player1_wallet ?? 'none'}`);

        const { data, error } = await supabase.from('matches').insert({
            player1_id: userID,
            question_duration_seconds: time_per_que,
            total_questions,
            category,
            stake_amount,
            match_code: matchCode,
            player1_wallet: player1_wallet ?? null,
        }).select().single()
        if (error || !data) {
            console.log("[match] Error while creating room: ", error);

            return res.status(500).json({
                status: "FAILED",
                error: "Failed to Create Room"
            })
        }

        console.log(`[match] ✅ Match created: id=${data.id}, code=${matchCode}, stake=${stake_amount}`);

        const generatedQuestions: { questions: Question[] } = await generateQuestions(category, total_questions, difficulty);

        const { error: match_questions_error } = await supabase
            .from('match_questions')
            .insert(generatedQuestions.questions.map((question: Question, index: number) => ({
                match_id: data.id,
                question_text: question.question,
                question_index: index,
                options: question.options,
                correct_option: question.answer
            })))

        if (match_questions_error) {
            console.log("[match] Error while creating questions: ", match_questions_error);

            return res.status(500).json({
                status: "FAILED",
                error: "Something went wrong on our servers"
            })
        }


        return res.json({
            data: {
                match: data
            },
            status: "SUCCESS"
        })
    } catch (err) {
        console.error("[match] Error creating match:", err);
        return res.status(500).json({
            status: "FAILED",
            error: "Internal Server Error"
        })
    }
}


export const joinMatch = async (req: Request, res: Response) => {
    const matchID = req.params.id;
    const { userID } = req;
    const { player2_wallet } = req.body;

    console.log(`[match] Join attempt: match=${matchID}, user=${userID}, wallet=${player2_wallet ?? 'none'}`);

    const { data: matchData, error: matchErr } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchID).single()

    if (matchErr) {
        return res.json({
            status: "FAILED",
            error: "Match not found"
        })
    }

    if (matchData.player1_id == userID) {
        return res.json({
            status: "FAILED",
            error: "User already in Room"
        })
    }

    if (matchData.status != "waiting") {
        return res.json({
            status: "FAILED",
            error: "Match is in Progress"
        })
    }

    const { data: updateMatch, error: updateMatchErr } = await supabase
        .from("matches")
        .update({
            player2_id: userID,
            player2_wallet: player2_wallet ?? null,
            status: "ready"
        })
        .eq("id", matchID)

    if (updateMatchErr) {
        console.log("[match] Error joining: ", updateMatchErr);
        return res.json({
            status: "FAILED",
            error: "Failed to join room"
        })
    }

    console.log(`[match] ✅ Player2 joined match=${matchID}, wallet=${player2_wallet ?? 'none'}`);

    return res.json({
        status: "SUCCESS",
        data: {
            message: "JOINED ROOM"
        }
    })
}


export const startMatch = async (req: Request, res: Response) => {
    const matchID = req.params.id;
    const userID = req.userID;

    const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchID)
        .single()

    if (matchError) {
        return res.json({
            status: "FAILED",
            error: "Match not found"
        })
    }

    if (matchData.player1_id != userID) {
        return res.json({
            status: "FAILED",
            error: "User not authorized to start match"
        })
    }

    if (matchData.status != "ready") {
        return res.json({
            status: "FAILED",
            error: "Match not ready to start or already in progress"
        })
    }

    const { data: queData, error: errData } = await supabase
        .from("match_questions")
        .select("id, question_index, question_text, options")
        .eq("match_id", matchID)
        .order("question_index", { ascending: true })

    if (!queData || queData.length != matchData.total_questions) {
        console.log("que error: ", errData);
        return res.json({
            status: "FAILED",
            error: "Starting Match Failed"
        })

    }

    const { data: updateMatch, error: updateMatchError } = await supabase
        .from("matches")
        .update({
            status: "starting",
            started_at: new Date()
        })
        .eq("id", matchID)

    if (updateMatchError) {
        console.log("error while starting match: ", updateMatchError);

        return res.json({
            status: "FAILED",
            error: "Failed to start match"
        })
    }

    return res.json({
        status: "SUCCESS",
        data: {
            questions: queData,
            message: "Match started"
        }
    })


}


export const submitAnswer = async (req: Request, res: Response) => {
    const { answer, question_id } = req.body;
    const match_id = req.params.id;

    const normalizedAnswer = String(answer);
    if (!["0", "1", "2", "3"].includes(normalizedAnswer)) {
        return res.status(400).json({
            status: "FAILED",
            error: "Invalid answer. Must be an option index: 0, 1, 2, or 3"
        });
    }

    const { data: matchData, error: matchErr } = await supabase
        .from("matches")
        .select("*")
        .eq("id", match_id).single()

    if (matchErr) {
        return res.json({
            status: "FAILED",
            error: "No Match Found, Or Something went wrong"
        })
    }

    if (matchData.status != "active") {
        return res.json({
            status: "FAILED",
            error: "Match is not active"
        })
    }

    const { data, error } = await supabase
        .from("match_answers")
        .insert({
            match_id,
            user_answer: normalizedAnswer,
            question_id,
            player_id: req.userID
        })

    if (error) {
        console.log("failed answer submission: ", error);
        return res.json({
            status: "FAILED",
            error: "Error Submitting Answers"
        })
    }

    console.log("answer submitted : ", data);

    res.json({
        status: "SUCCESS",
        data: {
            message: "Answer Submitted"
        }
    })
}

export const findMatchByCode = async (req: Request, res: Response) => {
    const code = req.params.code as string;

    if (!code || code.length !== 6) {
        return res.status(400).json({
            status: "FAILED",
            error: "Invalid match code. Must be 6 characters."
        });
    }

    const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("match_code", code.toUpperCase())
        .single();

    if (error || !data) {
        return res.status(404).json({
            status: "FAILED",
            error: "No match found with that code"
        });
    }

    return res.json({
        status: "SUCCESS",
        data: { match: data }
    });
}