import { create } from 'zustand'
import { Match, MatchQuestion } from '../types/game'

type GameState = {
    matchId: string | null
    isDemoMode: boolean
    isPlayer1: boolean
    questions: MatchQuestion[]
    match: Match | null
    // Actions
    // Actions
    setMatchId: (id: string, isPlayer1: boolean) => void
    setIsDemoMode: (isDemo: boolean) => void
    setGameData: (questions: MatchQuestion[], match: Match) => void
    setMatch: (match: Match) => void
    reset: () => void
}

export const useGameStore = create<GameState>((set) => ({
    matchId: null,
    isDemoMode: false,
    isPlayer1: true,
    questions: [],
    match: null,

    setMatchId: (matchId, isPlayer1) => set({ matchId, isPlayer1 }),
    setIsDemoMode: (isDemoMode) => set({ isDemoMode }),
    setGameData: (questions, match) => set({ questions, match }),
    setMatch: (match) => set({ match }),
    reset: () => set({ matchId: null, isPlayer1: true, questions: [], match: null }),
}))
