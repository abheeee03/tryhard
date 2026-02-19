import React, { useState, useEffect, useRef } from 'react'
import {
    View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator,
    RefreshControl, Animated, Alert
} from 'react-native'
import { supabase } from '../lib/supabase'
import { joinMatch } from '../lib/api'
import { Match } from '../types/game'
import { useTheme } from '../context/ThemeContext'
import { Session } from '@supabase/supabase-js'

const DIFFICULTY_COLOR: Record<string, string> = {
    easy: '#00C9A7',
    medium: '#FFB800',
    hard: '#FF4757',
}

type Props = {
    session: Session
    onNavigate: (screen: string, params?: any) => void
}

export default function HomeTab({ session, onNavigate }: Props) {
    const { theme } = useTheme()
    const [matches, setMatches] = useState<Match[]>([])
    const [loading, setLoading] = useState(true)
    const [joining, setJoining] = useState<string | null>(null)
    const fabScale = useRef(new Animated.Value(1)).current

    const fetchMatches = async () => {
        setLoading(true)
        const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/ping`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        })
        console.log("res from ping : ", res);

        const { data } = await supabase
            .from('matches')
            .select('*')
            .eq('status', 'waiting')
            .neq('player1_id', session.user.id)
            .order('created_at', { ascending: false })
        setMatches((data as Match[]) ?? [])
        setLoading(false)
    }

    useEffect(() => {
        fetchMatches()
        const channel = supabase
            .channel('public:matches')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
                fetchMatches()
            })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [])

    const handleJoin = async (matchId: string) => {
        setJoining(matchId)
        const token = session.access_token
        console.log("joining match");
        const res = await joinMatch(token, matchId)
        console.log("res from joining : ", res);
        setJoining(null)
        if (res.status === 'SUCCESS') {
            onNavigate('waitingRoom', { matchId, isPlayer1: false })
            console.log("navigating to waiting room");
        } else {
            Alert.alert('Could not join', res.error ?? 'Unknown error')
        }
    }

    const s = makeStyles(theme)

    const renderCard = ({ item }: { item: Match }) => {
        const diffColor = DIFFICULTY_COLOR[item.category?.toLowerCase?.()] ?? theme.accent
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

            {/* FAB */}
            <Animated.View style={[s.fab, { transform: [{ scale: fabScale }] }]}>
                <TouchableOpacity
                    onPress={() => onNavigate('createMatch')}
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
        paddingTop: 56,
        paddingBottom: 16,
        paddingHorizontal: 24,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '900',
        color: theme.accent,
        letterSpacing: 4,
    },
    headerSub: {
        fontSize: 13,
        color: theme.textSecondary,
        marginTop: 2,
        letterSpacing: 1,
    },
    list: { padding: 16, paddingBottom: 100 },
    card: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 18,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: theme.border,
    },
    cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    categoryBadge: {
        backgroundColor: theme.accentSoft,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginRight: 8,
    },
    categoryText: { color: theme.accent, fontWeight: '700', fontSize: 12 },
    stakeBadge: {
        backgroundColor: theme.card,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    stakeText: { color: theme.text, fontSize: 12, fontWeight: '600' },
    cardMeta: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 },
    joinBtn: {
        backgroundColor: theme.accent,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
    },
    joinBtnDisabled: { opacity: 0.6 },
    joinBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
    emptyState: { alignItems: 'center', paddingTop: 80 },
    emptyIcon: { fontSize: 64, marginBottom: 16 },
    emptyTitle: { color: theme.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
    emptySub: { color: theme.textSecondary, fontSize: 14 },
    fab: {
        position: 'absolute',
        bottom: 32,
        right: 24,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: theme.accent,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
    },
    fabText: { color: '#fff', fontSize: 30, fontWeight: '300', lineHeight: 34 },
})
