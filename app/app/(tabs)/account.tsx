import React, { useEffect, useState } from 'react'
import {
    View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert, ActivityIndicator
} from 'react-native'
import { supabase } from '@/src/lib/supabase'
import { useTheme } from '@/src/context/ThemeContext'
import { PlayerProfile } from '@/src/types/game'
import { useWallet } from '@/src/hooks/useWallet'
import { useSession } from '@/src/hooks/useSession'

export default function AccountTab() {
    const { theme, mode, toggleTheme } = useTheme()
    const { session } = useSession()
    const [profile, setProfile] = useState<PlayerProfile | null>(null)
    const { publicKey, balance, connected, connecting, connect, disconnect, refreshBalance, isDevnet } = useWallet()

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

    const handleConnect = async () => {
        try { await connect() } catch (err: any) {
            Alert.alert('Connection Failed', err?.message ?? 'Could not connect to wallet.')
        }
    }
    const handleDisconnect = () => {
        Alert.alert('Disconnect Wallet', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Disconnect', style: 'destructive', onPress: disconnect },
        ])
    }
    const shortKey = publicKey
        ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : null

    const s = makeStyles(theme)

    return (
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
                {connected && publicKey ? (
                    <>
                        <View style={s.walletTopRow}>
                            <View style={[s.networkBadge, { backgroundColor: isDevnet ? theme.warning + '22' : theme.success + '22' }]}>
                                <View style={[s.networkDot, { backgroundColor: isDevnet ? theme.warning : theme.success }]} />
                                <Text style={[s.networkText, { color: isDevnet ? theme.warning : theme.success }]}>
                                    {isDevnet ? 'Devnet' : 'Mainnet'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={handleDisconnect} style={s.disconnectBtn}>
                                <Text style={s.disconnectText}>Disconnect</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={s.walletLabel}>ADDRESS</Text>
                        <Text style={s.walletAddress}>{shortKey}</Text>
                        <View style={s.balanceRow}>
                            <View>
                                <Text style={s.walletLabel}>BALANCE</Text>
                                <Text style={s.balanceValue}>{balance !== null ? `◎ ${balance.toFixed(4)}` : '—'}</Text>
                            </View>
                            <TouchableOpacity onPress={refreshBalance} style={s.refreshBtn}>
                                <Text style={s.refreshText}>↻ Refresh</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    <View style={s.connectContainer}>
                        <Text style={s.walletIcon}>◎</Text>
                        <Text style={s.connectTitle}>Connect Wallet</Text>
                        <Text style={s.connectSub}>Link your Solana wallet to participate in staked battles</Text>
                        <TouchableOpacity
                            style={[s.connectBtn, connecting && { opacity: 0.6 }]}
                            onPress={handleConnect}
                            disabled={connecting}
                            activeOpacity={0.8}
                        >
                            {connecting
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <Text style={s.connectBtnText}>Connect Phantom</Text>
                            }
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <Text style={s.sectionTitle}>SETTINGS</Text>
            <View style={s.settingsCard}>
                <View style={s.settingRow}>
                    <View>
                        <Text style={s.settingLabel}>{mode === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}</Text>
                        <Text style={s.settingDesc}>Toggle app appearance</Text>
                    </View>
                    <Switch value={mode === 'dark'} onValueChange={toggleTheme}
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
    card: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, marginHorizontal: 4 },
    value: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
    label: { fontSize: 11, fontWeight: '600', letterSpacing: 1 },
})
const makeStyles = (theme: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 24, paddingTop: 56 },
    header: { alignItems: 'center', marginBottom: 32 },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    avatarText: { fontSize: 36, fontWeight: '800', color: '#fff' },
    username: { fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 4 },
    email: { fontSize: 13, color: theme.textSecondary },
    sectionTitle: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, letterSpacing: 2, marginBottom: 12, marginTop: 8 },
    statsRow: { flexDirection: 'row', marginBottom: 28 },
    walletCard: { backgroundColor: theme.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: theme.border, marginBottom: 28 },
    walletTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    networkBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 6 },
    networkDot: { width: 7, height: 7, borderRadius: 4 },
    networkText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
    disconnectBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: theme.danger },
    disconnectText: { color: theme.danger, fontSize: 12, fontWeight: '700' },
    walletLabel: { fontSize: 10, fontWeight: '700', color: theme.textSecondary, letterSpacing: 2, marginBottom: 4 },
    walletAddress: { fontSize: 20, fontWeight: '800', color: theme.text, letterSpacing: 2, marginBottom: 16 },
    balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    balanceValue: { fontSize: 28, fontWeight: '900', color: theme.accent },
    refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.card },
    refreshText: { color: theme.textSecondary, fontSize: 13, fontWeight: '600' },
    connectContainer: { alignItems: 'center', paddingVertical: 8 },
    walletIcon: { fontSize: 40, marginBottom: 12, color: theme.accent },
    connectTitle: { fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 6 },
    connectSub: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
    connectBtn: { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', shadowColor: theme.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
    connectBtnText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
    settingsCard: { backgroundColor: theme.surface, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: theme.border, marginBottom: 32 },
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    settingLabel: { color: theme.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
    settingDesc: { color: theme.textSecondary, fontSize: 12 },
    signOutBtn: { backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.danger, paddingVertical: 14, alignItems: 'center' },
    signOutText: { color: theme.danger, fontWeight: '700', fontSize: 15 },
})
