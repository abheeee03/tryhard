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
            <ScrollView style={s.container} contentContainerStyle={s.content}>
                <View style={s.header}>
                    <View style={s.avatar}>
                        <Text style={s.avatarText}>
                            {(profile?.username ?? session?.user.email ?? '?')[0].toUpperCase()}
                        </Text>
                    </View>
                    <Text style={s.username}>{profile?.username ?? 'Player'}</Text>
                    <Text style={s.email}>{session?.user.email}</Text>
                </View>

                <Text style={s.sectionTitle}>STATS</Text>
                <View style={s.statsRow}>
                    <StatCard label="Played" value={profile?.matches_played ?? 0} theme={theme} />
                    <StatCard label="Wins" value={profile?.wins ?? 0} theme={theme} color={theme.success} />
                    <StatCard label="Losses" value={profile?.losses ?? 0} theme={theme} color={theme.danger} />
                    <StatCard label="Win %" value={`${winRate}%`} theme={theme} color={theme.warning} />
                </View>

                <Text style={s.sectionTitle}>SOLANA WALLET</Text>
                <View style={s.walletCard}>
                    <ConnectButton
                        connected={wallet.connected}
                        connecting={wallet.connecting}
                        publicKey={wallet.publicKey?.toBase58() ?? null}
                        onConnect={wallet.connect}
                        onDisconnect={wallet.disconnect}
                    />
                </View>

                <Text style={s.sectionTitle}>SETTINGS</Text>
                <View style={s.settingsCard}>
                    <View style={[s.settingRow, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                        <View>
                            <Text style={s.settingLabel}>{mode === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}</Text>
                            <Text style={s.settingDesc}>Toggle app appearance</Text>
                        </View>
                        <Switch value={mode === 'dark'} onValueChange={toggleTheme}
                            trackColor={{ false: theme.border, true: theme.accent }} thumbColor="#fff" />
                    </View>
                    <View style={s.settingRow}>
                        <View>
                            <Text style={s.settingLabel}>🎮 Demo Mode</Text>
                            <Text style={s.settingDesc}>Play without real SOL</Text>
                        </View>
                        <Switch value={isDemoMode} onValueChange={setIsDemoMode}
                            trackColor={{ false: theme.border, true: theme.accent }} thumbColor="#fff" />
                    </View>
                </View>

                <TouchableOpacity style={s.signOutBtn} activeOpacity={0.8}
                    onPress={() => Alert.alert('Sign Out', 'Are you sure?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
                    ])}>
                    <Text style={s.signOutText}>Sign Out</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
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
    card: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, marginHorizontal: 4, shadowColor: '#000', shadowOffset: { width:0, height:2 }, shadowOpacity:0.05, shadowRadius:4 },
    value: { fontFamily: 'CabinetGrotesk', fontSize: 28, fontWeight: '900', marginBottom: 4 },
    label: { fontFamily: 'CabinetGrotesk', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
})

const makeStyles = (theme: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 24, paddingTop: 16 },
    header: { alignItems: 'center', marginBottom: 32 },
    avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    avatarText: { fontFamily: 'CabinetGrotesk', fontSize: 42, fontWeight: '900', color: '#fff' },
    username: { fontFamily: 'CabinetGrotesk', fontSize: 28, fontWeight: '900', color: theme.text, marginBottom: 4 },
    email: { fontFamily: 'CabinetGrotesk', fontSize: 14, color: theme.textSecondary, fontWeight: '600' },
    sectionTitle: { fontFamily: 'CabinetGrotesk', fontSize: 13, fontWeight: '900', color: theme.textSecondary, letterSpacing: 2, marginBottom: 12, marginTop: 12 },
    statsRow: { flexDirection: 'row', marginBottom: 32 },
    walletCard: { backgroundColor: theme.surface, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: theme.border, marginBottom: 32 },
    settingsCard: { backgroundColor: theme.surface, borderRadius: 20, padding: 8, borderWidth: 1, borderColor: theme.border, marginBottom: 32 },
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    settingLabel: { fontFamily: 'CabinetGrotesk', color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
    settingDesc: { fontFamily: 'CabinetGrotesk', color: theme.textSecondary, fontSize: 14, fontWeight: '600' },
    signOutBtn: { backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.danger, paddingVertical: 18, alignItems: 'center', marginBottom: 40 },
    signOutText: { fontFamily: 'CabinetGrotesk', color: theme.danger, fontWeight: '900', fontSize: 16, letterSpacing: 1 },
})
