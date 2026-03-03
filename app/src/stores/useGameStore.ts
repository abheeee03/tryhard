import { create } from 'zustand'
import { Match, MatchQuestion } from '../types/game'

type GameState = {
    matchId: string | null
    isPlayer1: boolean
    questions: MatchQuestion[]
    match: Match | null
    // Actions
    setMatchId: (id: string, isPlayer1: boolean) => void
    setGameData: (questions: MatchQuestion[], match: Match) => void
    setMatch: (match: Match) => void
    reset: () => void
}

export const useGameStore = create<GameState>((set) => ({
    matchId: null,
    isPlayer1: true,
    questions: [],
    match: null,

    setMatchId: (matchId, isPlayer1) => set({ matchId, isPlayer1 }),
    setGameData: (questions, match) => set({ questions, match }),
    setMatch: (match) => set({ match }),
    reset: () => set({ matchId: null, isPlayer1: true, questions: [], match: null }),
}))
