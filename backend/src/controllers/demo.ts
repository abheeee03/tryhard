import { Request, Response } from "express";
import { supabase } from "../utils/supabase";
import { generateQuestions } from "../utils/questions";
import { Question } from "../utils/types";
import crypto from "crypto";

function generateMatchCode(): string {
    return crypto.randomBytes(3).toString('hex').toUpperCase(); 
}

export const createMatchDemo = async (req: Request, res: Response) => {
    const { time_per_que, category, total_questions, stake_amount, difficulty, player1_wallet, is_private } = req.body;
    const { userID } = req;
    try {
        const matchCode = generateMatchCode();
        // Skip all solana validations for Demo
        console.log(`[demo] Creating match: user=${userID}, category=${category}, stake=${stake_amount}`);

        const { data, error } = await supabase.from('matches').insert({
            player1_id: userID,
            question_duration_seconds: time_per_que,
            total_questions,
            category,
            stake_amount, // Still tracking this visually but we know it's unverified SOL
            match_code: matchCode,
            player1_wallet: player1_wallet ?? null, 
            is_private: is_private ?? false,
        }).select().single()

        if (error || !data) {
            console.log("[demo] Error while creating room: ", error);
            return res.status(500).json({ status: "FAILED", error: "Failed to Create Demo Room" })
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
            console.log("[demo] Error creating questions: ", match_questions_error);
            return res.status(500).json({ status: "FAILED", error: "Something went wrong generating demo questions" })
        }

        return res.json({ data: { match: data }, status: "SUCCESS" })
    } catch (err) {
        console.error("[demo] Error creating match:", err);
        return res.status(500).json({ status: "FAILED", error: "Internal Server Error" })
    }
}

export const confirmDepositDemo = async (req: Request, res: Response) => {
    const matchId = req.params.matchId;
    const { txSignature, role } = req.body;

    if (!txSignature || !["player1", "player2"].includes(role)) {
        return res.status(400).json({ status: "FAILED", error: "txSignature and role are required" });
    }

    console.log(`[demo] Mock confirming deposit for match=${matchId}, role=${role}`);

    // Skip the `connection.getTransaction(txSignature)` entirely for demo!

    try {
        const column = role === "player1" ? "player1_deposit_tx" : "player2_deposit_tx";
        const { error: updateErr } = await supabase
            .from("matches")
            .update({ [column]: txSignature })
            .eq("id", matchId);

        if (updateErr) {
            console.error(`[demo] Failed to update match deposit:`, updateErr);
            return res.status(500).json({ status: "FAILED", error: "Failed to record demo deposit" });
        }

        console.log(`[demo] ✅ Mock deposit confirmed for match=${matchId}, role=${role}`);

        return res.json({ status: "SUCCESS", data: { message: "Demo Deposit Confirmed" } });
    } catch (err) {
        return res.status(500).json({ status: "FAILED", error: "Internal server error in demo payment" });
    }
};
