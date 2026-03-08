import React, { useEffect, useState } from 'react'
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Image
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
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
                <View style={s.cardTopRow}>
                    <Text style={s.cardTitle}>{item.category ?? 'General'}</Text>
                    <Ionicons name="heart-outline" size={28} color="#FFF" />
                </View>

                <View style={s.cardMiddle}>
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
                </View>

                <View style={s.cardPriceRow}>
                    <Text style={s.cardPriceText}>{item.stake_amount}</Text>
                    <Image source={require('../../assets/solana-icon.png')} style={[s.solanaIcon, { tintColor: '#fff' }]} />
                </View>

                <View style={s.cardBottomRow}>
                    <View style={s.pillGroup}>
                        <View style={s.pillBlack}>
                            <Text style={s.pillBlackText}>
                                {STATUS_LABEL[item.status]}
                            </Text>
                        </View>
                        <View style={s.pillBlack}>
                            <Text style={s.pillBlackText}>{item.total_questions} Qs</Text>
                        </View>
                    </View>

                    {canResume && (
                        <View style={s.resumeBtn}>
                            <Text style={s.resumeBtnText}>RESUME</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        )
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
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
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: 16, paddingBottom: 100 },
    
    // New Card Styles
    card: {
        backgroundColor: '#3B82F6', // Blue from index
        borderRadius: 24, 
        padding: 20,
        marginBottom: 16, 
        borderWidth: 1, 
        borderColor: 'rgba(0,0,0,0.1)',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        minHeight: 200, // accommodate the illustration space
        justifyContent: 'space-between'
    },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardTitle: { fontFamily: 'CabinetGrotesk', color: '#FFF', fontSize: 24, fontWeight: '900', width: '70%' },
    
    cardMiddle: {
        height: 40, // Space for the illustration body as seen in ref
        justifyContent: 'center',
    },

    cardPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    cardPriceText: { fontFamily: 'CabinetGrotesk', color: '#FFF', fontSize: 42, fontWeight: '900', letterSpacing: -1 },
    solanaIcon: { width: 32, height: 32, resizeMode: 'contain' },

    cardBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pillGroup: { flexDirection: 'row', gap: 8 },
    pillBlack: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
    pillBlackText: { fontFamily: 'CabinetGrotesk', color: '#FFF', fontSize: 13, fontWeight: '800' },
    
    resumeBtn: { backgroundColor: '#fff', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
    resumeBtnText: { fontFamily: 'CabinetGrotesk', color: '#3B82F6', fontWeight: '900', fontSize: 14, letterSpacing: 1 },

    resultBadge: {
        borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, width: '60%', backgroundColor: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.2)'
    },
    resultText: { fontFamily: 'CabinetGrotesk', fontWeight: '800', fontSize: 14, letterSpacing: 0.5, color: '#FFF' },

    emptyState: { alignItems: 'center', paddingTop: 80 },
    emptyIcon: { fontSize: 64, marginBottom: 16 },
    emptyTitle: { fontFamily: 'CabinetGrotesk', color: theme.text, fontSize: 24, fontWeight: '900', marginBottom: 8 },
    emptySub: { fontFamily: 'CabinetGrotesk', color: theme.textSecondary, fontSize: 16 },
})
