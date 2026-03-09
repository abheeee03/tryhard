import React, { useEffect, useState } from 'react'
import {
    View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../src/lib/supabase'
import { useTheme } from '../../src/context/ThemeContext'
import { PlayerProfile } from '../../src/types/game'
import { useSession } from '../../src/hooks/useSession'
import { ConnectButton } from '../../src/components/ConnectButton'
import { useWallet } from '../../src/hooks/useWallet'
import { useGameStore } from '../../src/stores/useGameStore'

export default function AccountTab() {
    const { theme, mode, toggleTheme } = useTheme()
    const { session } = useSession()
    const [profile, setProfile] = useState<PlayerProfile | null>(null)
    const wallet = useWallet()
    const { isDemoMode, setIsDemoMode } = useGameStore()

    useEffect(() => {
        if (!session) return
        supabase
            .from('profiles')
            .select('id, username, matches_played, wins, losses')
            .eq('id', session.user.id)
            .single()
            .then(({ data }) => setProfile(data as PlayerProfile))
    }, [session])

    const winRate = profile && profile.matches_played > 0
        ? Math.round((profile.wins / profile.matches_played) * 100) : 0

    const s = makeStyles(theme)

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
            <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
                <View style={s.header}>
                    <View style={s.avatar}>
                        <Text style={s.avatarText}>
                            {(profile?.username ?? session?.user.email ?? '?')[0].toUpperCase()}
                        </Text>
                    </View>
                    <Text style={s.username}>{profile?.username ?? 'Player'}</Text>
                    <Text style={s.email}>{session?.user.email}</Text>
                </View>

                {/* Stats in small squares */}
                <View style={s.statsGrid}>
                    <StatCard label="Played" value={profile?.matches_played ?? 0} theme={theme} />
                    <StatCard label="Wins" value={profile?.wins ?? 0} theme={theme} />
                    <StatCard label="Losses" value={profile?.losses ?? 0} theme={theme} />
                    <StatCard label="Win %" value={`${winRate}%`} theme={theme} />
                </View>

                {/* Floating Connect Card */}
                <View style={[s.walletConnectCard, mode === 'light' && s.walletConnectCardLight]}>
                    <ConnectButton
                        connected={wallet.connected}
                        connecting={wallet.connecting}
                        publicKey={wallet.publicKey?.toBase58() ?? null}
                        onConnect={wallet.connect}
                        onDisconnect={wallet.disconnect}
                    />
                </View>

                {/* Minimalist Menu */}
                <View style={s.menuCard}>
                    {/* Theme Toggle */}
                    <View style={s.menuItem}>
                        <Text style={s.menuIcon}>⚙️</Text>
                        <Text style={s.menuText}>Dark Mode</Text>
                        <Switch value={mode === 'dark'} onValueChange={toggleTheme}
                            trackColor={{ false: '#E2E8F0', true: '#3B82F6' }} thumbColor="#fff" />
                    </View>

                    {/* Demo Toggle */}
                    <View style={s.menuItem}>
                        <Text style={s.menuIcon}>🎮</Text>
                        <Text style={s.menuText}>Demo Mode</Text>
                        <Switch value={isDemoMode} onValueChange={setIsDemoMode}
                            trackColor={{ false: '#E2E8F0', true: '#3B82F6' }} thumbColor="#fff" />
                    </View>

                    {/* Sign Out */}
                    <TouchableOpacity style={[s.menuItem, s.menuItemNoBorder]} activeOpacity={0.7}
                        onPress={() => Alert.alert('Sign Out', 'Are you sure?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
                        ])}>
                        <Text style={s.menuIcon}>🚪</Text>
                        <Text style={[s.menuText, { color: theme.danger }]}>Sign Out</Text>
                        <Text style={s.menuChevron}>›</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    )
}

function StatCard({ label, value, theme }: { label: string; value: any; theme: any }) {
    return (
        <View style={[statCardStyles.card, { backgroundColor: theme.surface }]}>
            <Text style={[statCardStyles.value, { color: theme.text }]}>{value}</Text>
            <Text style={[statCardStyles.label, { color: theme.textSecondary }]}>{label}</Text>
        </View>
    )
}

const statCardStyles = StyleSheet.create({
    card: {
        width: '48%',
        aspectRatio: 1.1,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        marginBottom: 16,
    },
    value: { fontFamily: 'CabinetGrotesk', fontSize: 32, marginBottom: 4 },
    label: { fontFamily: 'CabinetGrotesk', fontSize: 13, letterSpacing: 0.5 },
})

const makeStyles = (theme: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 24, paddingTop: 32 },
    header: { alignItems: 'center', marginBottom: 10 },
    avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12 },
    avatarText: { fontFamily: 'CabinetGrotesk', fontSize: 48, color: '#fff' },
    username: { fontFamily: 'CabinetGrotesk', fontSize: 28, color: theme.text, marginBottom: 2 },
    email: { fontFamily: 'CabinetGrotesk', fontSize: 13, color: theme.textSecondary, letterSpacing: 0.5, opacity: 0 },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },

    walletConnectCard: {
        backgroundColor: '#1C1C1E', // Dark brutal approach
        borderRadius: 28,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    walletConnectCardLight: {
        backgroundColor: '#E2E8F0', // Explicit light color for visibility contrast
    },

    menuCard: {
        backgroundColor: theme.surface,
        borderRadius: 28,
        paddingHorizontal: 16,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
        marginBottom: 32,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        paddingHorizontal: 8,
    },
    menuItemNoBorder: {
        borderBottomWidth: 0,
    },
    menuIcon: {
        fontSize: 20,
        marginRight: 16,
    },
    menuText: {
        fontFamily: 'CabinetGrotesk',
        fontSize: 16,
        color: theme.text,
        flex: 1,
    },
    menuChevron: {
        fontFamily: 'CabinetGrotesk',
        fontSize: 24,
        color: theme.textSecondary,
        lineHeight: 24,
    },
})
