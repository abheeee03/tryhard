import { supabase } from "../utils/supabase";

let engineInterval: NodeJS.Timeout | null = null;



const finishMatch = async (matchId: string) => {
    console.log(`[finishMatch] Starting for match ${matchId}`);
    const { data: match, error: matchErr } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

    if (matchErr || !match) {
        console.error(`[finishMatch] Match ${matchId} not found`, matchErr);
        return;
    }

    if (match.status === "finished") {
        console.log(`[finishMatch] Match ${matchId} already finished — skipping.`);
        return;
    }

    if (match.status !== "active") {
        console.warn(`[finishMatch] Match ${matchId} is not active (status=${match.status}) — skipping.`);
        return;
    }

    if (!match.player1_id || !match.player2_id) {
        console.error(`[finishMatch] Match ${matchId} missing player IDs — skipping.`);
        return;
    }
    const { data: questions, error: questionsErr } = await supabase
        .from("match_questions")
        .select("id, correct_option")
        .eq("match_id", matchId);

    if (questionsErr || !questions) {
        console.error(`[finishMatch] Failed to fetch questions for match ${matchId}`, questionsErr);
        return;
    }

    const correctOptionMap: Record<string, string> = {};
    for (const q of questions) {
        correctOptionMap[q.id] = q.correct_option;
    }

    const { data: answers, error: answersErr } = await supabase
        .from("match_answers")
        .select("player_id, question_id, user_answer")
        .eq("match_id", matchId);

    if (answersErr || !answers) {
        console.error(`[finishMatch] Failed to fetch answers for match ${matchId}`, answersErr);
        return;
    }

    let player1Score = 0;
    let player2Score = 0;

    for (const answer of answers) {
        const correct = correctOptionMap[answer.question_id];
        if (correct !== undefined && answer.user_answer === correct) {
            if (answer.player_id === match.player1_id) {
                player1Score++;
            } else if (answer.player_id === match.player2_id) {
                player2Score++;
            }
        }
    }

    console.log(`[finishMatch] Scores — player1: ${player1Score}, player2: ${player2Score}`);

    let winner_id: string | null = null;
    if (player1Score > player2Score) {
        winner_id = match.player1_id;
    } else if (player2Score > player1Score) {
        winner_id = match.player2_id;
    }
    // null → draw

    const { data: updatedRows, error: updateErr } = await supabase
        .from("matches")
        .update({
            status: "finished",
            winner_id,
            finished_at: new Date().toISOString(),
        })
        .eq("id", matchId)
        .eq("status", "active")
        .select("id");

    if (updateErr) {
        console.error(`[finishMatch] Failed to update match ${matchId}`, updateErr);
        return;
    }

    if (!updatedRows || updatedRows.length === 0) {
        console.warn(`[finishMatch] Match ${matchId} was already finished by another process — aborting stats update.`);
        return;
    }

    console.log(`[finishMatch] Match ${matchId} marked finished. Winner: ${winner_id ?? "draw"}`);

    const statsUpdates: Promise<any>[] = [];

    if (winner_id) {
        const loserId = winner_id === match.player1_id ? match.player2_id : match.player1_id;

        statsUpdates.push(
            Promise.resolve(supabase.rpc("increment_player_stats", {
                p_user_id: winner_id,
                p_matches_played: 1,
                p_wins: 1,
                p_losses: 0,
            }))
        );

        statsUpdates.push(
            Promise.resolve(supabase.rpc("increment_player_stats", {
                p_user_id: loserId,
                p_matches_played: 1,
                p_wins: 0,
                p_losses: 1,
            }))
        );
    } else {
        // Draw — increment matches_played only, no wins or losses
        statsUpdates.push(
            Promise.resolve(supabase.rpc("increment_player_stats", {
                p_user_id: match.player1_id,
                p_matches_played: 1,
                p_wins: 0,
                p_losses: 0,
            }))
        );
        statsUpdates.push(
            Promise.resolve(supabase.rpc("increment_player_stats", {
                p_user_id: match.player2_id,
                p_matches_played: 1,
                p_wins: 0,
                p_losses: 0,
            }))
        );
    }

    const results = await Promise.all(statsUpdates);
    for (const { error } of results) {
        if (error) {
            console.error(`[finishMatch] Failed to update player stats for match ${matchId}`, error);
        }
    }

    console.log(`[finishMatch] Stats updated for match ${matchId}`);
};

const advanceMatch = async (match: any) => {
    if (match.current_question_index < match.total_questions) {
        await supabase
            .from("matches")
            .update({
                current_question_index: match.current_question_index + 1,
                question_start_time: new Date().toISOString()
            })
            .eq("id", match.id)
            .eq("status", "active");

        console.log(`Advanced match ${match.id}`);
    } else {
        await finishMatch(match.id);
    }
}

const processActiveMatches = async () => {
    const { data: matches, error } = await supabase
        .from("matches")
        .select("*")
        .eq("status", "active");

    if (error || !matches) return;

    const now = new Date();

    for (const match of matches) {
        if (!match.question_start_time) continue;

        const start = new Date(match.question_start_time);
        const elapsed =
            (now.getTime() - start.getTime()) / 1000;

        if (elapsed >= match.question_duration_seconds) {
            await advanceMatch(match);
        }
    }
}


export const startGameEngine = () => {
    if (engineInterval) return;

    console.log("Game engine started");

    engineInterval = setInterval(async () => {
        try {
            await processActiveMatches();
        } catch (err) {
            console.error("Engine error:", err);
        }
    }, 1000); // 1 second tick
}
