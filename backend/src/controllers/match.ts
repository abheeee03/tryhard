import { Request, Response } from "express";
import { supabase } from "../utils/supabase";
import { getQuestions } from "../utils/questions";

export const createMatch = async (req: Request, res: Response) => {
    const { time_per_que, category, total_questions, stake_amount } = req.body;
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

        const questions = await getQuestions(category, total_questions);

        const { error: match_questions_error } = await supabase
            .from('match_questions')
            .insert(questions.map((question, index) => ({
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
                match: data,
                questions: questions
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