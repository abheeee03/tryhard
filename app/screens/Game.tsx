import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity,
    Animated, Easing
} from 'react-native'
import { supabase } from '../lib/supabase'
import { submitAnswer } from '../lib/api'
import { Session } from '@supabase/supabase-js'
import { useTheme } from '../context/ThemeContext'
import { Match, MatchQuestion } from '../types/game'

type Props = {
    session: Session
    matchId: string
    questions: MatchQuestion[]
    initialMatch: Match
    onNavigate: (screen: string, params?: any) => void
}

const OPTION_LABELS = ['A', 'B', 'C', 'D']

export default function Game({ session, matchId, questions, initialMatch, onNavigate }: Props) {
    const { theme } = useTheme()
    const [match, setMatch] = useState<Match>(initialMatch)
    const [answered, setAnswered] = useState<Set<number>>(new Set())
    const [selected, setSelected] = useState<number | null>(null)
    const [timerWidth] = useState(new Animated.Value(1))
    const timerAnim = useRef<Animated.CompositeAnimation | null>(null)
    const timerColor = useRef(new Animated.Value(0)).current

    const currentQ = questions[match.current_question_index]

    const startTimer = useCallback((durationSec: number, startTime: string) => {
        const elapsed = (Date.now() - new Date(startTime).getTime()) / 1000
        const remaining = Math.max(0, durationSec - elapsed)
        const fraction = remaining / durationSec

        timerWidth.setValue(fraction)
        timerColor.setValue(fraction > 0.5 ? 0 : fraction > 0.25 ? 0.5 : 1)

        timerAnim.current?.stop()
        timerAnim.current = Animated.timing(timerWidth, {
            toValue: 0,
            duration: remaining * 1000,
            easing: Easing.linear,
            useNativeDriver: false,
        })
        timerAnim.current.start()
    }, [])

    useEffect(() => {
        setSelected(null)
        if (match.question_start_time) {
            startTimer(match.question_duration_seconds, match.question_start_time)
        }
    }, [match.current_question_index])

    useEffect(() => {
        if (match.question_start_time) {
            startTimer(match.question_duration_seconds, match.question_start_time)
        }

        const channel = supabase
            .channel(`game-${matchId}`)
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}`
            }, ({ new: updated }) => {
                const m = updated as Match
                setMatch(m)
                setSelected(null)
                if (m.status === 'finished') {
                    onNavigate('result', { matchId })
                }
            })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [matchId])

    const handleAnswer = async (optionIndex: number, questionId: string) => {
        if (answered.has(match.current_question_index)) return
        setSelected(optionIndex)
        setAnswered((prev) => new Set([...prev, match.current_question_index]))
        await submitAnswer(session.access_token, matchId, { answer: optionIndex, question_id: questionId })
    }

    const timerBarColor = timerColor.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [theme.success, theme.warning, theme.danger],
    })

    const s = makeStyles(theme)
    const isAnswered = answered.has(match.current_question_index)

    if (!currentQ) return (
        <View style={s.center}><Text style={{ color: theme.text }}>Loading…</Text></View>
    )

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <Text style={s.qCount}>Q{match.current_question_index + 1} / {match.total_questions}</Text>
                <View style={s.categoryBadge}>
                    <Text style={s.categoryText}>{match.category}</Text>
                </View>
            </View>

            {/* Timer Bar */}
            <View style={s.timerTrack}>
                <Animated.View style={[s.timerFill, {
                    width: timerWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    backgroundColor: timerBarColor,
                }]} />
            </View>

            {/* Question */}
            <View style={s.questionBlock}>
                <Text style={s.questionText}>{currentQ.question_text}</Text>
            </View>

            {/* Options */}
            <View style={s.optionsBlock}>
                {(currentQ.options as { index: number; option: string }[]).map((opt) => {
                    const isSelected = selected === opt.index
                    return (
                        <TouchableOpacity
                            key={opt.index}
                            style={[
                                s.optionBtn,
                                isSelected && s.optionSelected,
                                isAnswered && !isSelected && s.optionDimmed,
                            ]}
                            onPress={() => handleAnswer(opt.index, currentQ.id)}
                            disabled={isAnswered}
                            activeOpacity={0.8}
                        >
                            <View style={[s.optionLabel, isSelected && s.optionLabelSelected]}>
                                <Text style={[s.optionLabelText, isSelected && { color: '#fff' }]}>
                                    {OPTION_LABELS[opt.index]}
                                </Text>
                            </View>
                            <Text style={[s.optionText, isSelected && s.optionTextSelected]}>
                                {opt.option}
                            </Text>
                        </TouchableOpacity>
                    )
                })}
            </View>

            {isAnswered && (
                <Text style={s.waitHint}>⏳ Waiting for next question…</Text>
            )}
        </View>
    )
}

const makeStyles = (theme: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12,
        backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    qCount: { fontSize: 15, fontWeight: '800', color: theme.textSecondary },
    categoryBadge: { backgroundColor: theme.accentSoft, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
    categoryText: { color: theme.accent, fontWeight: '700', fontSize: 12 },
    timerTrack: { height: 4, backgroundColor: theme.card },
    timerFill: { height: 4, borderRadius: 2 },
    questionBlock: { flex: 1, justifyContent: 'center', padding: 24 },
    questionText: {
        fontSize: 22, fontWeight: '700', color: theme.text, textAlign: 'center', lineHeight: 32,
    },
    optionsBlock: { padding: 20, gap: 12 },
    optionBtn: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: theme.surface, borderRadius: 14, padding: 16,
        borderWidth: 1.5, borderColor: theme.border, gap: 14,
    },
    optionSelected: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
    optionDimmed: { opacity: 0.45 },
    optionLabel: {
        width: 32, height: 32, borderRadius: 8, borderWidth: 1.5, borderColor: theme.border,
        alignItems: 'center', justifyContent: 'center',
    },
    optionLabelSelected: { backgroundColor: theme.accent, borderColor: theme.accent },
    optionLabelText: { color: theme.textSecondary, fontWeight: '800', fontSize: 13 },
    optionText: { flex: 1, color: theme.text, fontSize: 15, fontWeight: '500' },
    optionTextSelected: { color: theme.accent, fontWeight: '700' },
    waitHint: {
        textAlign: 'center', color: theme.textSecondary, fontSize: 13,
        paddingBottom: 24, fontWeight: '500',
    },
})
