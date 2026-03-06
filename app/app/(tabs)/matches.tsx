import React, { useEffect, useState } from 'react'
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import { useTheme } from '../../src/context/ThemeContext'
import { useSession } from '../../src/hooks/useSession'
import { useGameStore } from '../../src/stores/useGameStore'
import { Match } from '../../src/types/game'

const STATUS_COLOR: Record<string, string> = {
    finished: '#00C9A7',
    active: '#FFB800',
    waiting: '#9945FF',
    ready: '#14F195',
    starting: '#FFB800',
    cancelled: '#FF4757',
}

const STATUS_LABEL: Record<string, string> = {
    finished: 'Finished',
    active: 'In Progress',
    waiting: 'Waiting',
    ready: 'Ready',
    starting: 'Starting',
    cancelled: 'Cancelled',
}

export default function MatchesTab() {
    const { theme } = useTheme()
    const { session } = useSession()
    const router = useRouter()
    const setMatchId = useGameStore((s) => s.setMatchId)
    const [matches, setMatches] = useState<Match[]>([])
    const [loading, setLoading] = useState(true)

    const fetchMyMatches = async () => {
        if (!session) return
        setLoading(true)
        const { data } = await supabase
            .from('matches')
            .select('*')
            .or(`player1_id.eq.${session.user.id},player2_id.eq.${session.user.id}`)
            .order('created_at', { ascending: false })
            .limit(30)
        setMatches((data as Match[]) ?? [])
        setLoading(false)
    }

    useEffect(() => {
        if (!session) return
        fetchMyMatches()
    }, [session])

    const handleResume = (match: Match) => {
        if (match.status === 'waiting' || match.status === 'ready') {
            setMatchId(match.id, match.player1_id === session?.user.id)
            router.push('/waiting-room')
        } else if (match.status === 'active' || match.status === 'starting') {
            setMatchId(match.id, match.player1_id === session?.user.id)
            router.push('/game')
        }
    }

    const s = makeStyles(theme)

    const renderCard = ({ item }: { item: Match }) => {
        const isPlayer1 = item.player1_id === session?.user.id
        const isWinner = item.winner_id === session?.user.id
        const isDraw = item.status === 'finished' && item.winner_id === null
        const isFinished = item.status === 'finished'
        const canResume = ['waiting', 'ready', 'active', 'starting'].includes(item.status)

        return (
            <TouchableOpacity
                style={s.card}
                onPress={() => canResume ? handleResume(item) : undefined}
                activeOpacity={canResume ? 0.8 : 1}
            >
                <View style={s.cardTop}>
                    <View style={s.categoryBadge}>
                        <Text style={s.categoryText}>{item.category ?? 'General'}</Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + '22' }]}>
                        <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[item.status] }]} />
                        <Text style={[s.statusText, { color: STATUS_COLOR[item.status] }]}>
                            {STATUS_LABEL[item.status]}
                        </Text>
                    </View>
                </View>

                <View style={s.cardMeta}>
                    <Text style={s.metaText}>❓ {item.total_questions} Questions</Text>
                    <Text style={s.metaText}>⏱ {item.question_duration_seconds}s / Q</Text>
                    {isPlayer1 ? <Text style={s.metaText}>👑 You created</Text> : <Text style={s.metaText}>🎯 You joined</Text>}
                </View>

                {isFinished && (
                    <View style={[s.resultBadge, {
                        backgroundColor: isDraw ? '#FFB80022' : isWinner ? '#00C9A722' : '#FF475722',
                        borderColor: isDraw ? '#FFB800' : isWinner ? '#00C9A7' : '#FF4757',
                    }]}>
                        <Text style={[s.resultText, {
                            color: isDraw ? '#FFB800' : isWinner ? '#00C9A7' : '#FF4757'
                        }]}>
                            {isDraw ? '🤝 Draw' : isWinner ? '🏆 You Won' : '😔 You Lost'}
                        </Text>
                    </View>
                )}

                {canResume && (
                    <View style={s.resumeHint}>
                        <Text style={s.resumeText}>Tap to resume →</Text>
                    </View>
                )}
            </TouchableOpacity>
        )
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
            <View style={s.header}>
                <Text style={s.headerTitle}>YOUR MATCHES</Text>
                <Text style={s.headerSub}>Match history & active games</Text>
            </View>
            {loading ? (
                <View style={s.center}>
                    <ActivityIndicator size="large" color={theme.accent} />
                </View>
            ) : (
                <FlatList
                    data={matches}
                    keyExtractor={(m) => m.id}
                    renderItem={renderCard}
                    contentContainerStyle={s.list}
                    refreshControl={
                        <RefreshControl
                            refreshing={loading}
                            onRefresh={fetchMyMatches}
                            tintColor={theme.accent}
                            colors={[theme.accent]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={s.emptyState}>
                            <Text style={s.emptyIcon}>📋</Text>
                            <Text style={s.emptyTitle}>No Matches Yet</Text>
                            <Text style={s.emptySub}>Create or join a battle to get started!</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    )
}

const makeStyles = (theme: any) => StyleSheet.create({
    header: {
        paddingHorizontal: 24, paddingVertical: 16,
        backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    headerTitle: { fontSize: 22, fontWeight: '900', color: theme.text, letterSpacing: 3 },
    headerSub: { fontSize: 13, color: theme.textSecondary, marginTop: 2, letterSpacing: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: 16, paddingBottom: 100 },
    card: {
        backgroundColor: theme.surface, borderRadius: 16, padding: 18,
        marginBottom: 14, borderWidth: 1, borderColor: theme.border,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' },
    categoryBadge: {
        backgroundColor: theme.accentSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    },
    categoryText: { color: theme.accent, fontWeight: '700', fontSize: 12 },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center', borderRadius: 8,
        paddingHorizontal: 10, paddingVertical: 4, gap: 6,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontWeight: '700', fontSize: 12 },
    cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
    metaText: { color: theme.textSecondary, fontSize: 13 },
    resultBadge: {
        borderRadius: 10, paddingVertical: 8, alignItems: 'center',
        borderWidth: 1, marginBottom: 4,
    },
    resultText: { fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
    resumeHint: { alignItems: 'flex-end', marginTop: 4 },
    resumeText: { color: theme.accent, fontSize: 12, fontWeight: '700' },
    emptyState: { alignItems: 'center', paddingTop: 80 },
    emptyIcon: { fontSize: 64, marginBottom: 16 },
    emptyTitle: { color: theme.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
    emptySub: { color: theme.textSecondary, fontSize: 14 },
})
