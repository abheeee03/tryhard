import { Request, Response } from "express";
import { supabase } from "../utils/supabase";
import { generateQuestions } from "../utils/questions";
import { Question } from "../utils/types";

export const createMatch = async (req: Request, res: Response) => {
    const { time_per_que, category, total_questions, stake_amount, difficulty } = req.body;
    const { userID } = req;
    try {
        const { data, error } = await supabase.from('matches').insert({
            player1_id: userID,
            question_duration_seconds: time_per_que,
            total_questions,
            category,
            stake_amount
        }).select().single()
        if (error || !data) {
            console.log("Error while creating room: ", error);

            return res.status(500).json({
                status: "FAILED",
                error: "Failed to Create Room"
            })
        }

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
            console.log("Error while creating questions: ", match_questions_error);

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
        return res.status(500).json({
            status: "FAILED",
            error: "Internal Server Error"
        })
    }
}


export const joinMatch = async (req: Request, res: Response) => {
    const matchID = req.params.id;
    const { userID } = req;

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
            status: "ready"
        })
        .eq("id", matchID)


    console.log("update error: ", updateMatchErr);


    if (updateMatchErr) {
        return res.json({
            status: "FAILED",
            error: "Failed to join room"
        })
    }

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
            status: "active",
            current_question_index: 0,
            question_start_time: new Date(),
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