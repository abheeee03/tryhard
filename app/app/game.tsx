import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../src/lib/supabase'
import { submitAnswer } from '../src/lib/api'
import { useTheme } from '../src/context/ThemeContext'
import { Match, MatchQuestion } from '../src/types/game'
import { useSession } from '../src/hooks/useSession'
import { useGameStore } from '../src/stores/useGameStore'

const PRE_GAME_SECONDS = 5
const INTER_Q_SECONDS = 3
const OPTION_LABELS = ['A', 'B', 'C', 'D']
const TIPS = [
    '⚡ Fastest correct answer wins the round!',
    '🧠 Read all options before answering.',
    '🎯 Wrong answers don\'t penalize you — answer something!',
    '🔒 Once submitted, answers can\'t be changed.',
    '📡 Questions advance automatically on the server.',
]

type Phase = 'pregame' | 'interlude' | 'question'

export default function GameScreen() {
    const { theme } = useTheme()
    const { session } = useSession()
    const router = useRouter()
    const {
        matchId,
        questions,
        match: initialMatch,
        setMatch: storeSetMatch,
        setGameData,
    } = useGameStore()

    const [match, setMatchState] = useState<Match | null>(initialMatch)
    const [phase, setPhase] = useState<Phase>(
        initialMatch?.status === 'starting' ? 'pregame' : 'question'
    )
    const [preGameCount, setPreGameCount] = useState(PRE_GAME_SECONDS)
    const [interludeCount, setInterludeCount] = useState(INTER_Q_SECONDS)
    const [timeLeft, setTimeLeft] = useState(initialMatch?.question_duration_seconds ?? 10)
    const [answered, setAnswered] = useState<Set<number>>(new Set())
    const [selected, setSelected] = useState<number | null>(null)
    const [questionPhaseStart, setQuestionPhaseStart] = useState<number | null>(
        initialMatch?.status !== 'starting' ? Date.now() : null
    )

    const countdownScale = useRef(new Animated.Value(1)).current
    const modalOpacity = useRef(new Animated.Value(0)).current
    const questionSlide = useRef(new Animated.Value(30)).current
    const questionOpacity = useRef(new Animated.Value(0)).current
    const timerColor = useRef(new Animated.Value(1)).current

    const setMatch = (m: Match) => { setMatchState(m); storeSetMatch(m) }

    useEffect(() => {
        if (phase === 'pregame') {
            Animated.timing(modalOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start()
        }
    }, [phase])

    const pulseCount = useCallback(() => {
        countdownScale.setValue(1.4)
        Animated.spring(countdownScale, { toValue: 1, tension: 120, friction: 5, useNativeDriver: true }).start()
    }, [])

    useEffect(() => {
        if (phase !== 'pregame') return
        const interval = setInterval(() => {
            setPreGameCount((prev) => {
                const next = prev - 1; pulseCount()
                if (next <= 0) clearInterval(interval)
                return Math.max(0, next)
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [phase])

    useEffect(() => {
        if (phase !== 'interlude') return
        setInterludeCount(INTER_Q_SECONDS)
        const interval = setInterval(() => {
            setInterludeCount((prev) => {
                const next = prev - 1; pulseCount()
                if (next <= 0) { clearInterval(interval); showQuestion() }
                return Math.max(0, next)
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [phase])

    const showQuestion = () => {
        questionSlide.setValue(30); questionOpacity.setValue(0)
        setQuestionPhaseStart(Date.now())
        setPhase('question')
        // Animation is triggered by the useEffect below
    }

    // Animate question content visible whenever we enter the 'question' phase.
    // This covers both the normal interlude→question path AND the direct-entry
    // case (player loads game when match is already active).
    useEffect(() => {
        if (phase === 'question') {
            Animated.parallel([
                Animated.timing(questionOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.spring(questionSlide, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
            ]).start()
        }
    }, [phase, match?.current_question_index])

    // Fallback: if questions or match are missing (e.g. player joined late or state lost),
    // hydrate from Supabase so both players always see the quiz.
    useEffect(() => {
        if (!matchId) return
        if (questions.length > 0 && match) return

        let cancelled = false
        ;(async () => {
            try {
                const [{ data: matchRow }, { data: qs }] = await Promise.all([
                    supabase
                        .from('matches')
                        .select('*')
                        .eq('id', matchId)
                        .single(),
                    supabase
                        .from('match_questions')
                        .select('id, match_id, question_index, question_text, options, created_at')
                        .eq('match_id', matchId)
                        .order('question_index', { ascending: true }),
                ])

                if (cancelled) return
                if (matchRow && qs && qs.length > 0) {
                    const typedMatch = matchRow as Match
                    const typedQs = qs as unknown as MatchQuestion[]
                    setMatch(typedMatch)
                    setGameData(typedQs, typedMatch)
                }
            } catch (err) {
                console.error('[game] Failed to hydrate match/questions from backend:', err)
            }
        })()

        return () => {
            cancelled = true
        }
    }, [matchId, questions.length, !!match])

    useEffect(() => {
        if (phase !== 'question' || !questionPhaseStart || !match) return
        setTimeLeft(match.question_duration_seconds)
        const interval = setInterval(() => {
            const elapsed = (Date.now() - questionPhaseStart) / 1000
            const remaining = Math.max(0, match.question_duration_seconds - elapsed)
            setTimeLeft(Math.ceil(remaining))
            timerColor.setValue(remaining / match.question_duration_seconds)
        }, 200)
        return () => clearInterval(interval)
    }, [phase, match?.current_question_index, questionPhaseStart])

    useEffect(() => {
        if (!matchId) return
        const channel = supabase
            .channel(`game-${matchId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
                ({ new: updated }) => {
                    const m = updated as Match
                    if (m.status === 'finished') {
                        setMatch(m); router.replace('/result'); return
                    }
                    if (m.status === 'active' && match?.status === 'starting') {
                        setMatch(m); setSelected(null)
                        Animated.timing(modalOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setPhase('interlude'))
                        return
                    }
                    if (m.status === 'active' && m.current_question_index !== match?.current_question_index) {
                        setMatch(m); setSelected(null); setPhase('interlude'); return
                    }
                    setMatch(m)
                })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [matchId, match?.status, match?.current_question_index])

    const handleAnswer = async (optionIndex: number, questionId: string) => {
        if (!session || !match) return
        const qIdx = match.current_question_index
        if (answered.has(qIdx)) return
        setSelected(optionIndex)
        setAnswered((prev) => new Set([...prev, qIdx]))
        await submitAnswer(session.access_token, matchId!, { answer: optionIndex, question_id: questionId })
    }

    const s = makeStyles(theme)

    // While match/questions are being hydrated, show a basic loading screen instead of a blank view
    if (!matchId) {
        return (
            <View style={s.container}>
                <Text style={{ color: theme.text, textAlign: 'center', marginTop: 100 }}>
                    No match loaded.
                </Text>
            </View>
        )
    }

    if (!match) {
        return (
            <View style={s.container}>
                <Text style={{ color: theme.text, textAlign: 'center', marginTop: 100 }}>
                    Loading match and questions…
                </Text>
            </View>
        )
    }

    const currentQ = questions[match.current_question_index]
    const isAnswered = answered.has(match.current_question_index)
    const timerNumColor = timeLeft <= 3 ? theme.danger : timeLeft <= 5 ? theme.warning : theme.success

    if (phase === 'pregame') {
        return (
            <View style={[s.container, { justifyContent: 'center' }]}>
                <Animated.View style={[StyleSheet.absoluteFill, s.modalBackdrop, { opacity: modalOpacity }]} />
                <Animated.View style={[s.modalCard, { opacity: modalOpacity }]}>
                    <View style={s.countdownRing}>
                        <Animated.Text style={[s.countdownNumber, { transform: [{ scale: countdownScale }] }]}>
                            {preGameCount}
                        </Animated.Text>
                        <Text style={s.countdownLabel}>GET READY</Text>
                    </View>
                    <View style={s.matchInfoRow}>
                        <InfoChip icon="📚" label={match.category} theme={theme} />
                        <InfoChip icon="❓" label={`${match.total_questions} Questions`} theme={theme} />
                        <InfoChip icon="⏱" label={`${match.question_duration_seconds}s / Q`} theme={theme} />
                    </View>
                    <View style={s.divider} />
                    <Text style={s.tipsTitle}>TIPS & RULES</Text>
                    <ScrollView style={s.tipsList} showsVerticalScrollIndicator={false}>
                        {TIPS.map((tip, i) => (
                            <View key={i} style={s.tipRow}><Text style={s.tipText}>{tip}</Text></View>
                        ))}
                    </ScrollView>
                </Animated.View>
            </View>
        )
    }

    if (phase === 'interlude') {
        return (
            <View style={[s.container, s.interludeContainer]}>
                <View style={s.interludeCard}>
                    <Text style={s.interludeLabel}>UP NEXT</Text>
                    <View style={s.countdownRing}>
                        <Animated.Text style={[s.countdownNumber, { transform: [{ scale: countdownScale }] }]}>
                            {interludeCount}
                        </Animated.Text>
                    </View>
                    <Text style={s.interludeQNum}>Question {match.current_question_index + 1} of {match.total_questions}</Text>
                    <Text style={s.interludeCategory}>{match.category}</Text>
                </View>
            </View>
        )
    }

    if (!currentQ) return (
        <View style={s.container}><Text style={{ color: theme.text, textAlign: 'center', marginTop: 100 }}>Loading…</Text></View>
    )

    return (
        <View style={s.container}>
            <View style={s.topBar}>
                <View style={[s.timerPill, timeLeft <= 3 && { backgroundColor: theme.danger + '20' }]}>
                    <Text style={[s.timerText, timeLeft <= 3 && { color: theme.danger }]}>
                        Time left : 00:{timeLeft.toString().padStart(2, '0')}
                    </Text>
                </View>
            </View>
            <Animated.View style={[s.questionBlock, { opacity: questionOpacity, transform: [{ translateY: questionSlide }] }]}>
                <Text style={s.questionText}>{currentQ.question_text}</Text>
            </Animated.View>
            <Animated.View style={[s.optionsBlock, { opacity: questionOpacity, transform: [{ translateY: questionSlide }] }]}>
                {(currentQ.options as { index: number; option: string }[]).map((opt) => {
                    const isSelected = selected === opt.index
                    const dimmed = isAnswered && !isSelected
                    return (
                        <TouchableOpacity key={opt.index}
                            style={[s.optionBtn, isSelected && s.optionSelected, dimmed && s.optionDimmed]}
                            onPress={() => handleAnswer(opt.index, currentQ.id)}
                            disabled={isAnswered} activeOpacity={0.8}>
                            <Text style={[s.optionText, isSelected && s.optionTextSelected]} numberOfLines={2}>{opt.option}</Text>
                        </TouchableOpacity>
                    )
                })}
            </Animated.View>
            {isAnswered && <Text style={s.waitHint}>⏳ Waiting for next question…</Text>}
        </View>
    )
}

function InfoChip({ icon, label, theme }: { icon: string; label: string; theme: any }) {
    return (
        <View style={{ alignItems: 'center', padding: 10, flex: 1 }}>
            <Text style={{ fontSize: 22, marginBottom: 4 }}>{icon}</Text>
            <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
        </View>
    )
}

const makeStyles = (theme: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    modalBackdrop: { backgroundColor: 'rgba(0,0,0,0.85)' },
    modalCard: { marginHorizontal: 20, backgroundColor: theme.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: theme.border },
    countdownRing: { width: 100, height: 100, borderRadius: 50, backgroundColor: theme.accentSoft, borderWidth: 3, borderColor: theme.accent, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    countdownNumber: { fontSize: 44, fontWeight: '900', color: theme.accent, lineHeight: 52 },
    countdownLabel: { fontSize: 10, fontWeight: '800', color: theme.accent, letterSpacing: 2, marginTop: 2 },
    matchInfoRow: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: theme.card, borderRadius: 14, marginBottom: 20, overflow: 'hidden' },
    divider: { height: 1, backgroundColor: theme.border, marginBottom: 16 },
    tipsTitle: { fontSize: 11, fontWeight: '800', color: theme.textSecondary, letterSpacing: 2, marginBottom: 12 },
    tipsList: { maxHeight: 140, marginBottom: 16 },
    tipRow: { backgroundColor: theme.card, borderRadius: 10, padding: 10, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: theme.accent },
    tipText: { color: theme.text, fontSize: 13, lineHeight: 18 },
    interludeContainer: { alignItems: 'center', justifyContent: 'center' },
    interludeCard: { alignItems: 'center' },
    interludeLabel: { fontSize: 12, fontWeight: '800', color: theme.textSecondary, letterSpacing: 3, marginBottom: 24 },
    interludeQNum: { fontSize: 18, fontWeight: '700', color: theme.text, marginTop: 24, marginBottom: 8 },
    interludeCategory: { fontSize: 13, color: theme.accent, fontWeight: '600', letterSpacing: 1 },
    topBar: { alignItems: 'center', paddingTop: 60, paddingBottom: 20 },
    timerPill: { backgroundColor: '#E0E0E0', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
    timerText: { color: '#111', fontSize: 14, fontWeight: '600' },
    questionBlock: { flex: 0.8, justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 20 },
    questionText: { fontSize: 24, fontWeight: '400', color: theme.text, textAlign: 'center', lineHeight: 32 },
    optionsBlock: { paddingHorizontal: 24, paddingBottom: 40, gap: 16 },
    optionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', borderRadius: 999, paddingVertical: 18, paddingHorizontal: 16, borderWidth: 1, borderColor: '#333' },
    optionSelected: { borderColor: '#3B82F6', borderWidth: 2 },
    optionDimmed: { opacity: 0.4 },
    optionText: { color: theme.text, fontSize: 18, fontWeight: '400', textAlign: 'center' },
    optionTextSelected: { color: theme.text },
    waitHint: { textAlign: 'center', color: theme.textSecondary, fontSize: 13, paddingBottom: 40, fontWeight: '500', position: 'absolute', bottom: 10, alignSelf: 'center' },
})
