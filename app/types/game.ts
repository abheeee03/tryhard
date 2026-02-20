export type MatchStatus = "waiting" | "ready" | "starting" | "active" | "finished" | "cancelled";

export interface Match {
    id: string;
    player1_id: string;
    player2_id: string | null;
    status: MatchStatus;
    category: string;
    stake_amount: number;
    winner_id: string | null;
    current_question_index: number;
    question_start_time: string | null;
    question_duration_seconds: number;
    total_questions: number;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
}

export interface MatchQuestion {
    id: string;
    match_id: string;
    question_index: number;
    question_text: string;
    options: { index: number; option: string }[];
    created_at: string;
}

export interface MatchAnswer {
    id: string;
    match_id: string;
    player_id: string;
    question_id: string;
    user_answer: string;
    created_at: string;
}

export interface PlayerProfile {
    id: string;
    username: string | null;
    matches_played: number;
    wins: number;
    losses: number;
}
