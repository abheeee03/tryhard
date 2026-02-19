import React, { useEffect, useState } from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Animated
} from 'react-native'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { useTheme } from '../context/ThemeContext'

type Props = {
    session: Session
    matchId: string
    onNavigate: (screen: string, params?: any) => void
}

export default function Result({ session, matchId, onNavigate }: Props) {
    const { theme } = useTheme()
    const [loading, setLoading] = useState(true)
    const [matchData, setMatchData] = useState<any>(null)
    const [myScore, setMyScore] = useState(0)
    const [opponentScore, setOpponentScore] = useState(0)
    const [breakdown, setBreakdown] = useState<{ text: string; correct: boolean | null }[]>([])
    const heroScale = React.useRef(new Animated.Value(0.5)).current

    useEffect(() => {
        Animated.spring(heroScale, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }).start()
    }, [])

    useEffect(() => {
        const load = async () => {
            const { data: match } = await supabase
                .from('matches').select('*').eq('id', matchId).single()
            if (!match) return

            const { data: questions } = await supabase
                .from('match_questions')
                .select('id, question_text, correct_option, options')
                .eq('match_id', matchId)
                .order('question_index', { ascending: true })

            const { data: answers } = await supabase
                .from('match_answers')
                .select('player_id, question_id, user_answer')
                .eq('match_id', matchId)

            const myId = session.user.id
            const oppId = match.player1_id === myId ? match.player2_id : match.player1_id

            let me = 0, opp = 0
            const bk: { text: string; correct: boolean | null }[] = []

            for (const q of (questions ?? [])) {
                const myAns = (answers ?? []).find(a => a.question_id === q.id && a.player_id === myId)
                const isCorrect = myAns ? myAns.user_answer === String(q.correct_option) : null
                if (isCorrect === true) me++
                const oppAns = (answers ?? []).find(a => a.question_id === q.id && a.player_id === oppId)
                if (oppAns && oppAns.user_answer === String(q.correct_option)) opp++
                bk.push({ text: q.question_text, correct: isCorrect })
            }

            setMyScore(me)
            setOpponentScore(opp)
            setBreakdown(bk)
            setMatchData(match)
            setLoading(false)
        }
        load()
    }, [matchId])

    const s = makeStyles(theme)
    const myId = session.user.id
    const isWinner = matchData?.winner_id === myId
    const isDraw = matchData?.winner_id === null

    if (loading) return (
        <View style={[s.container, s.center]}>
            <ActivityIndicator size="large" color={theme.accent} />
        </View>
    )

    const resultEmoji = isDraw ? '🤝' : isWinner ? '🏆' : '😔'
    const resultTitle = isDraw ? 'It\'s a Draw!' : isWinner ? 'You Won!' : 'You Lost'
    const resultColor = isDraw ? theme.warning : isWinner ? theme.success : theme.danger

    return (
        <ScrollView style={s.container} contentContainerStyle={s.content}>
            {/* Hero */}
            <Animated.View style={[s.hero, { transform: [{ scale: heroScale }] }]}>
                <Text style={s.heroEmoji}>{resultEmoji}</Text>
                <Text style={[s.heroTitle, { color: resultColor }]}>{resultTitle}</Text>
            </Animated.View>

            {/* Score Row */}
            <View style={s.scoreCard}>
                <View style={s.scoreCol}>
                    <Text style={[s.scoreNum, { color: theme.accent }]}>{myScore}</Text>
                    <Text style={s.scoreLabel}>YOU</Text>
                </View>
                <View style={s.scoreDivider} />
                <View style={s.scoreCol}>
                    <Text style={[s.scoreNum, { color: theme.textSecondary }]}>{opponentScore}</Text>
                    <Text style={s.scoreLabel}>OPPONENT</Text>
                </View>
            </View>

            {/* Question Breakdown */}
            <Text style={s.sectionTitle}>BREAKDOWN</Text>
            {breakdown.map((item, i) => (
                <View key={i} style={s.breakdownRow}>
                    <Text style={s.breakdownIcon}>
                        {item.correct === null ? '–' : item.correct ? '✅' : '❌'}
                    </Text>
                    <Text style={s.breakdownText} numberOfLines={2}>{item.text}</Text>
                </View>
            ))}

            {/* Actions */}
            <View style={s.actions}>
                <TouchableOpacity style={s.primaryBtn} onPress={() => onNavigate('tabs')} activeOpacity={0.85}>
                    <Text style={s.primaryBtnText}>PLAY AGAIN</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    )
}

const makeStyles = (theme: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    center: { alignItems: 'center', justifyContent: 'center' },
    content: { padding: 24, paddingTop: 64 },
    hero: { alignItems: 'center', marginBottom: 32 },
    heroEmoji: { fontSize: 72, marginBottom: 12 },
    heroTitle: { fontSize: 34, fontWeight: '900', letterSpacing: 1 },
    scoreCard: {
        flexDirection: 'row', backgroundColor: theme.surface, borderRadius: 20,
        borderWidth: 1, borderColor: theme.border, marginBottom: 32, overflow: 'hidden',
    },
    scoreCol: { flex: 1, alignItems: 'center', paddingVertical: 24 },
    scoreNum: { fontSize: 48, fontWeight: '900' },
    scoreLabel: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, letterSpacing: 2, marginTop: 4 },
    scoreDivider: { width: 1, backgroundColor: theme.border },
    sectionTitle: {
        fontSize: 11, fontWeight: '700', color: theme.textSecondary,
        letterSpacing: 2, marginBottom: 12,
    },
    breakdownRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: theme.surface, borderRadius: 12, padding: 14,
        marginBottom: 8, borderWidth: 1, borderColor: theme.border,
    },
    breakdownIcon: { fontSize: 18 },
    breakdownText: { flex: 1, color: theme.text, fontSize: 13, lineHeight: 18 },
    actions: { marginTop: 24, gap: 12 },
    primaryBtn: {
        backgroundColor: theme.accent, borderRadius: 14, paddingVertical: 18, alignItems: 'center',
        shadowColor: theme.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
    },
    primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 1.5 },
})
