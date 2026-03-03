import React, { useState, useEffect, useRef } from 'react'
import {
    View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator,
    RefreshControl, Animated, Alert, TextInput
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/src/lib/supabase'
import { joinMatch, findMatchByCode } from '@/src/lib/api'
import { Match } from '@/src/types/game'
import { useTheme } from '@/src/context/ThemeContext'
import { useSession } from '@/src/hooks/useSession'
import { useGameStore } from '@/src/stores/useGameStore'

const DIFFICULTY_COLOR: Record<string, string> = {
    easy: '#00C9A7',
    medium: '#FFB800',
    hard: '#FF4757',
}

export default function HomeTab() {
    const { theme } = useTheme()
    const { session } = useSession()
    const router = useRouter()
    const setMatchId = useGameStore((s) => s.setMatchId)
    const [matches, setMatches] = useState<Match[]>([])
    const [loading, setLoading] = useState(true)
    const [joining, setJoining] = useState<string | null>(null)
    const [searchCode, setSearchCode] = useState('')
    const [searching, setSearching] = useState(false)
    const fabScale = useRef(new Animated.Value(1)).current

    const fetchMatches = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('matches')
            .select('*')
            .eq('status', 'waiting')
            .neq('player1_id', session?.user.id ?? '')
            .order('created_at', { ascending: false })
        setMatches((data as Match[]) ?? [])
        setLoading(false)
    }

    useEffect(() => {
        if (!session) return
        fetchMatches()
        const channel = supabase
            .channel('public:matches')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
                fetchMatches()
            })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [session])

    const handleJoin = async (matchId: string) => {
        if (!session) return
        setJoining(matchId)
        const res = await joinMatch(session.access_token, matchId)
        setJoining(null)
        if (res.status === 'SUCCESS') {
            setMatchId(matchId, false)
            router.push('/waiting-room')
        } else {
            Alert.alert('Could not join', res.error ?? 'Unknown error')
        }
    }

    const handleCodeSearch = async () => {
        if (!session) return
        const code = searchCode.trim().toUpperCase()
        if (code.length !== 6) { Alert.alert('Invalid Code', 'Match code must be exactly 6 characters.'); return }
        setSearching(true)
        try {
            const res = await findMatchByCode(session.access_token, code)
            if (res.status === 'SUCCESS' && res.data?.match) {
                const match = res.data.match
                if (match.status === 'waiting') {
                    handleJoin(match.id)
                } else if (match.player1_id === session.user.id || match.player2_id === session.user.id) {
                    setMatchId(match.id, match.player1_id === session.user.id)
                    router.push('/waiting-room')
                } else {
                    Alert.alert('Match Unavailable', 'This match is no longer accepting players.')
                }
            } else {
                Alert.alert('Not Found', res.error ?? 'No match found with that code.')
            }
        } catch {
            Alert.alert('Error', 'Failed to search for match.')
        } finally {
            setSearching(false)
            setSearchCode('')
        }
    }

    const s = makeStyles(theme)

    const renderCard = ({ item }: { item: Match }) => {
        const isJoining = joining === item.id
        return (
            <View style={s.card}>
                <View style={s.cardRow}>
                    <View style={s.categoryBadge}>
                        <Text style={s.categoryText}>{item.category ?? 'General'}</Text>
                    </View>
                    {item.stake_amount > 0 && (
                        <View style={s.stakeBadge}>
                            <Text style={s.stakeText}>💰 {item.stake_amount}</Text>
                        </View>
                    )}
                </View>
                <View style={s.cardMeta}>
                    <MetaChip icon="❓" label={`${item.total_questions} Questions`} theme={theme} />
                    <MetaChip icon="⏱" label={`${item.question_duration_seconds}s / Q`} theme={theme} />
                </View>
                <TouchableOpacity
                    style={[s.joinBtn, isJoining && s.joinBtnDisabled]}
                    onPress={() => handleJoin(item.id)}
                    disabled={!!joining}
                    activeOpacity={0.8}
                >
                    {isJoining
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={s.joinBtnText}>JOIN BATTLE ⚔</Text>
                    }
                </TouchableOpacity>
            </View>
        )
    }

    return (
        <View style={s.container}>
            <View style={s.header}>
                <Text style={s.headerTitle}>⚔ TRYHARD</Text>
                <Text style={s.headerSub}>Live Battles</Text>
            </View>

            <View style={s.searchBar}>
                <TextInput
                    style={s.searchInput}
                    placeholder="Enter 6-digit match code"
                    placeholderTextColor={theme.textSecondary}
                    value={searchCode}
                    onChangeText={(t) => setSearchCode(t.toUpperCase().slice(0, 6))}
                    autoCapitalize="characters"
                    maxLength={6}
                    returnKeyType="search"
                    onSubmitEditing={handleCodeSearch}
                />
                <TouchableOpacity
                    style={[s.searchBtn, searchCode.length !== 6 && { opacity: 0.5 }]}
                    onPress={handleCodeSearch}
                    disabled={searching || searchCode.length !== 6}
                    activeOpacity={0.8}
                >
                    {searching
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={s.searchBtnText}>JOIN</Text>
                    }
                </TouchableOpacity>
            </View>

            <FlatList
                data={matches}
                keyExtractor={(m) => m.id}
                renderItem={renderCard}
                contentContainerStyle={s.list}
                refreshControl={
                    <RefreshControl
                        refreshing={loading}
                        onRefresh={fetchMatches}
                        tintColor={theme.accent}
                        colors={[theme.accent]}
                    />
                }
                ListEmptyComponent={
                    loading ? null : (
                        <View style={s.emptyState}>
                            <Text style={s.emptyIcon}>🎮</Text>
                            <Text style={s.emptyTitle}>No Battles Yet</Text>
                            <Text style={s.emptySub}>Be the first to create a match!</Text>
                        </View>
                    )
                }
            />

            <Animated.View style={[s.fab, { transform: [{ scale: fabScale }] }]}>
                <TouchableOpacity
                    onPress={() => router.push('/create-match')}
                    onPressIn={() => Animated.spring(fabScale, { toValue: 0.9, useNativeDriver: true }).start()}
                    onPressOut={() => Animated.spring(fabScale, { toValue: 1, useNativeDriver: true }).start()}
                    activeOpacity={0.9}
                >
                    <Text style={s.fabText}>＋</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    )
}

function MetaChip({ icon, label, theme }: { icon: string; label: string; theme: any }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, marginTop: 8 }}>
            <Text style={{ fontSize: 13 }}>{icon} </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{label}</Text>
        </View>
    )
}

const makeStyles = (theme: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: {
        paddingTop: 56, paddingBottom: 16, paddingHorizontal: 24,
        backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    headerTitle: { fontSize: 26, fontWeight: '900', color: theme.accent, letterSpacing: 4 },
    headerSub: { fontSize: 13, color: theme.textSecondary, marginTop: 2, letterSpacing: 1 },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
        gap: 10, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    searchInput: {
        flex: 1, backgroundColor: theme.card, borderRadius: 12, paddingHorizontal: 16,
        paddingVertical: 12, color: theme.text, fontSize: 16, fontWeight: '800',
        letterSpacing: 4, textAlign: 'center', borderWidth: 1, borderColor: theme.border,
    },
    searchBtn: {
        backgroundColor: theme.accent, borderRadius: 12, paddingHorizontal: 20,
        paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
    },
    searchBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
    list: { padding: 16, paddingBottom: 100 },
    card: {
        backgroundColor: theme.surface, borderRadius: 16, padding: 18,
        marginBottom: 14, borderWidth: 1, borderColor: theme.border,
    },
    cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    categoryBadge: {
        backgroundColor: theme.accentSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginRight: 8,
    },
    categoryText: { color: theme.accent, fontWeight: '700', fontSize: 12 },
    stakeBadge: { backgroundColor: theme.card, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    stakeText: { color: theme.text, fontSize: 12, fontWeight: '600' },
    cardMeta: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 },
    joinBtn: { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    joinBtnDisabled: { opacity: 0.6 },
    joinBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
    emptyState: { alignItems: 'center', paddingTop: 80 },
    emptyIcon: { fontSize: 64, marginBottom: 16 },
    emptyTitle: { color: theme.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
    emptySub: { color: theme.textSecondary, fontSize: 14 },
    fab: {
        position: 'absolute', bottom: 32, right: 24, width: 60, height: 60,
        borderRadius: 30, backgroundColor: theme.accent, alignItems: 'center',
        justifyContent: 'center', elevation: 8, shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8,
    },
    fabText: { color: '#fff', fontSize: 30, fontWeight: '300', lineHeight: 34 },
})
