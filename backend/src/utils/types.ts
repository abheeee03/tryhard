export type MatchStatus =
    | "waiting"
    | "ready"
    | "starting"
    | "active"
    | "finished"
    | "cancelled";

export interface User {
    id: string;
    username: string;
    matches_played: number;
    wins: number;
    losses: number;
    created_at: Date;
}

export interface Match {
    id: string;
    player1_id: string;
    player2_id: string | null;
    status: MatchStatus;
    category: string,
    stake_amount: number;
    winner_id: string | null;
    current_question_index: number;
    question_start_time: Date | null;
    question_duration_seconds: number;
    total_questions: number;
    created_at: Date;
    started_at: Date | null;
    finished_at: Date | null;
}

export interface MatchQuestion {
    id: string;
    match_id: string;
    question_index: number;
    question_text: string;
    options: string[];
    correct_option: string;
    created_at: Date;
}

export interface MatchAnswers {
    id: string,
    match_id: string,
    player_id: string,
    question_id: string,
    user_answer: string,
    created_at: string
}

export interface Question {
    question: string,
    options: {
        index: number,
        option: string
    }[],
    answer: number
}