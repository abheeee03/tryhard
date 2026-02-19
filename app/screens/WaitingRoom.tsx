import React, { useEffect, useState, useRef } from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity,
    ActivityIndicator, Clipboard, Animated
} from 'react-native'
import { supabase } from '../lib/supabase'
import { startMatch } from '../lib/api'
import { Session } from '@supabase/supabase-js'
import { useTheme } from '../context/ThemeContext'
import { Match, MatchQuestion } from '../types/game'

type Props = {
    session: Session
    matchId: string
    isPlayer1: boolean
    onNavigate: (screen: string, params?: any) => void
    onBack: () => void
}

export default function WaitingRoom({ session, matchId, isPlayer1, onNavigate, onBack }: Props) {
    const { theme } = useTheme()
    const [match, setMatch] = useState<Match | null>(null)
    const [starting, setStarting] = useState(false)
    const dotAnim = useRef(new Animated.Value(0)).current

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
                Animated.timing(dotAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
            ])
        ).start()
    }, [])

    useEffect(() => {
        supabase
            .from('matches')
            .select('*')
            .eq('id', matchId)
            .single()
            .then(({ data }) => setMatch(data as Match))

        const channel = supabase
            .channel(`match-${matchId}`)
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}`
            }, async ({ new: updated }) => {
                const m = updated as Match
                setMatch(m)
                if (m.status === 'active') {
                    const { data: questions } = await supabase
                        .from('match_questions')
                        .select('id, question_index, question_text, options')
                        .eq('match_id', matchId)
                        .order('question_index', { ascending: true })
                    onNavigate('game', { matchId, questions, match: m })
                }
            })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [matchId])

    const handleStart = async () => {
        setStarting(true)
        const res = await startMatch(session.access_token, matchId)
        if (res.status !== 'SUCCESS') {
            setStarting(false)
        }
    }

    const s = makeStyles(theme)

    const isReady = match?.status === 'ready'
    const isWaiting = !match || match.status === 'waiting'

    return (
        <View style={s.container}>
            <View style={s.topBar}>
                <TouchableOpacity onPress={onBack} style={s.backBtn}>
                    <Text style={s.backText}>← Leave</Text>
                </TouchableOpacity>
                <Text style={s.topBarTitle}>Waiting Room</Text>
                <View style={{ width: 60 }} />
            </View>

            <View style={s.body}>
                {/* Match ID Badge */}
                <View style={s.idCard}>
                    <Text style={s.idLabel}>MATCH ID</Text>
                    <TouchableOpacity onPress={() => Clipboard.setString(matchId)}>
                        <Text style={s.idValue}>{matchId.slice(0, 8).toUpperCase()}</Text>
                        <Text style={s.idHint}>Tap to copy full ID</Text>
                    </TouchableOpacity>
                </View>

                {/* Status */}
                <View style={s.statusBlock}>
                    <Animated.Text style={[s.bigIcon, { opacity: isReady ? 1 : dotAnim }]}>
                        {isReady ? '🎮' : '⏳'}
                    </Animated.Text>
                    <Text style={s.statusTitle}>
                        {isReady
                            ? 'Opponent Joined!'
                            : 'Waiting for opponent…'
                        }
                    </Text>
                    <Text style={s.statusSub}>
                        {isPlayer1
                            ? isReady
                                ? 'You can now start the match'
                                : 'Share the Match ID with a friend'
                            : 'Waiting for Player 1 to start…'
                        }
                    </Text>
                </View>

                {/* Player slots */}
                <View style={s.playersRow}>
                    <View style={s.playerSlot}>
                        <View style={[s.playerDot, { backgroundColor: theme.accent }]} />
                        <Text style={s.playerLabel}>YOU</Text>
                    </View>
                    <Text style={s.vs}>VS</Text>
                    <View style={s.playerSlot}>
                        <View style={[s.playerDot, { backgroundColor: isReady ? theme.success : theme.border }]} />
                        <Text style={s.playerLabel}>{isReady ? 'READY' : '???'}</Text>
                    </View>
                </View>

                {isPlayer1 && isReady && (
                    <TouchableOpacity style={s.startBtn} onPress={handleStart} disabled={starting} activeOpacity={0.85}>
                        {starting
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={s.startBtnText}>START BATTLE ⚔</Text>
                        }
                    </TouchableOpacity>
                )}
            </View>
        </View>
    )
}

const makeStyles = (theme: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    topBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
        backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    backBtn: { width: 60 },
    backText: { color: theme.danger, fontSize: 15, fontWeight: '600' },
    topBarTitle: { fontSize: 17, fontWeight: '800', color: theme.text },
    body: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
    idCard: {
        backgroundColor: theme.surface, borderRadius: 16, padding: 20, alignItems: 'center',
        borderWidth: 1, borderColor: theme.border, marginBottom: 40, width: '100%',
    },
    idLabel: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, letterSpacing: 2, marginBottom: 8 },
    idValue: { fontSize: 28, fontWeight: '900', color: theme.accent, letterSpacing: 4, textAlign: 'center' },
    idHint: { color: theme.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 6 },
    statusBlock: { alignItems: 'center', marginBottom: 40 },
    bigIcon: { fontSize: 64, marginBottom: 16 },
    statusTitle: { fontSize: 22, fontWeight: '800', color: theme.text, textAlign: 'center', marginBottom: 8 },
    statusSub: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
    playersRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        marginBottom: 40, gap: 20,
    },
    playerSlot: { alignItems: 'center', gap: 8 },
    playerDot: { width: 14, height: 14, borderRadius: 7 },
    playerLabel: { color: theme.textSecondary, fontWeight: '700', fontSize: 12, letterSpacing: 1 },
    vs: { fontSize: 18, fontWeight: '900', color: theme.accent },
    startBtn: {
        backgroundColor: theme.accent, borderRadius: 14, paddingVertical: 18,
        paddingHorizontal: 40, alignItems: 'center',
        shadowColor: theme.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10,
    },
    startBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1.5 },
})
