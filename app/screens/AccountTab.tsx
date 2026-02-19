import React, { useEffect, useState } from 'react'
import {
    View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert
} from 'react-native'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { useTheme } from '../context/ThemeContext'
import { PlayerProfile } from '../types/game'

type Props = { session: Session }

export default function AccountTab({ session }: Props) {
    const { theme, mode, toggleTheme } = useTheme()
    const [profile, setProfile] = useState<PlayerProfile | null>(null)

    useEffect(() => {
        supabase
            .from('profiles')
            .select('id, username, matches_played, wins, losses')
            .eq('id', session.user.id)
            .single()
            .then(({ data }) => setProfile(data as PlayerProfile))
    }, [session])

    const winRate = profile && profile.matches_played > 0
        ? Math.round((profile.wins / profile.matches_played) * 100)
        : 0

    const s = makeStyles(theme)

    return (
        <ScrollView style={s.container} contentContainerStyle={s.content}>
            <View style={s.header}>
                <View style={s.avatar}>
                    <Text style={s.avatarText}>
                        {(profile?.username ?? session.user.email ?? '?')[0].toUpperCase()}
                    </Text>
                </View>
                <Text style={s.username}>{profile?.username ?? 'Player'}</Text>
                <Text style={s.email}>{session.user.email}</Text>
            </View>

            {/* Stats */}
            <Text style={s.sectionTitle}>STATS</Text>
            <View style={s.statsRow}>
                <StatCard label="Played" value={profile?.matches_played ?? 0} theme={theme} />
                <StatCard label="Wins" value={profile?.wins ?? 0} theme={theme} color={theme.success} />
                <StatCard label="Losses" value={profile?.losses ?? 0} theme={theme} color={theme.danger} />
                <StatCard label="Win %" value={`${winRate}%`} theme={theme} color={theme.warning} />
            </View>

            {/* Settings */}
            <Text style={s.sectionTitle}>SETTINGS</Text>
            <View style={s.settingsCard}>
                <View style={s.settingRow}>
                    <View>
                        <Text style={s.settingLabel}>{mode === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}</Text>
                        <Text style={s.settingDesc}>Toggle app appearance</Text>
                    </View>
                    <Switch
                        value={mode === 'dark'}
                        onValueChange={toggleTheme}
                        trackColor={{ false: theme.border, true: theme.accent }}
                        thumbColor="#fff"
                    />
                </View>
            </View>

            {/* Sign Out */}
            <TouchableOpacity
                style={s.signOutBtn}
                onPress={() => {
                    Alert.alert('Sign Out', 'Are you sure?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
                    ])
                }}
                activeOpacity={0.8}
            >
                <Text style={s.signOutText}>Sign Out</Text>
            </TouchableOpacity>
        </ScrollView>
    )
}

function StatCard({ label, value, theme, color }: { label: string; value: any; theme: any; color?: string }) {
    return (
        <View style={[statCardStyles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[statCardStyles.value, { color: color ?? theme.text }]}>{value}</Text>
            <Text style={[statCardStyles.label, { color: theme.textSecondary }]}>{label}</Text>
        </View>
    )
}

const statCardStyles = StyleSheet.create({
    card: {
        flex: 1,
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        marginHorizontal: 4,
    },
    value: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
    label: { fontSize: 11, fontWeight: '600', letterSpacing: 1 },
})

const makeStyles = (theme: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 24, paddingTop: 56 },
    header: { alignItems: 'center', marginBottom: 32 },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: theme.accent,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    avatarText: { fontSize: 36, fontWeight: '800', color: '#fff' },
    username: { fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 4 },
    email: { fontSize: 13, color: theme.textSecondary },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: theme.textSecondary,
        letterSpacing: 2,
        marginBottom: 12,
        marginTop: 8,
    },
    statsRow: { flexDirection: 'row', marginBottom: 28 },
    settingsCard: {
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 4,
        borderWidth: 1,
        borderColor: theme.border,
        marginBottom: 32,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    settingLabel: { color: theme.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
    settingDesc: { color: theme.textSecondary, fontSize: 12 },
    signOutBtn: {
        backgroundColor: theme.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.danger,
        paddingVertical: 14,
        alignItems: 'center',
    },
    signOutText: { color: theme.danger, fontWeight: '700', fontSize: 15 },
})
