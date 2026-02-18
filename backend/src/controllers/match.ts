import { Request, Response } from "express";
import { supabase } from "../utils/supabase";
import { getQuestions } from "../utils/questions";

export const createMatch = async (req: Request, res: Response) => {
    const { time_per_que, category, total_questions } = req.body;
    let userID = "owneroftheroom";
    try {
        const { data, error } = await supabase.from('match').insert({
            createdBy: userID,
            time_per_que,
            category,
            total_questions
        }).select().single()
        if (error || !data) {
            console.log("Error while creating room: ", error);

            return res.status(500).json({
                status: "FAILED",
                error: "Failed to Create Room"
            })
        }

        const questions = await getQuestions(category, total_questions);

        const { data: match_questions, error: match_questions_error } = await supabase
            .from('match_questions')
            .insert(questions.map((question) => ({
                match_id: data.id,
                question: question.question,
                options: question.options,
                answer: question.answer
            })))

        if (match_questions_error || !match_questions) {
            console.log("Error while creating questions: ", match_questions_error);

            return res.status(500).json({
                status: "FAILED",
                error: "Something went wrong on our servers"
            })
        }


        return res.json({
            data: {
                match: data,
                questions: match_questions
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