import React, { useEffect, useState, useRef } from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity,
    ActivityIndicator, Clipboard, Animated, Alert, ScrollView
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../src/lib/supabase'
import { startMatch, confirmDeposit } from '../src/lib/api'
import { useTheme } from '../src/context/ThemeContext'
import { Match, MatchQuestion } from '../src/types/game'
import { useSession } from '../src/hooks/useSession'
import { useGameStore } from '../src/stores/useGameStore'
import { useWallet } from '../src/hooks/useWallet'
import { buildJoinEscrowTx, matchIdToGameId } from '../src/lib/escrow'

export default function WaitingRoomScreen() {
    const { theme } = useTheme()
    const { session } = useSession()
    const router = useRouter()
    const wallet = useWallet()
    const { matchId, isPlayer1, setGameData, setMatch: storeSetMatch } = useGameStore()
    const [match, setMatch] = useState<Match | null>(null)
    const [starting, setStarting] = useState(false)
    const [depositing, setDepositing] = useState(false)
    const [logs, setLogs] = useState<string[]>([])
    const dotAnim = useRef(new Animated.Value(0)).current

    const addLog = (msg: string) => {
        console.log(`[waiting-room] ${msg}`)
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} • ${msg}`])
    }

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
                Animated.timing(dotAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
            ])
        ).start()
    }, [])

    const navigateToGame = async (matchRow: Match) => {
        if (!matchId) return
        const { data: questions, error } = await supabase
            .from('match_questions')
            .select('id, match_id, question_index, question_text, options, created_at')
            .eq('match_id', matchId)
            .order('question_index', { ascending: true })

        if (error || !questions || questions.length === 0) {
            addLog(`❌ Failed to load questions: ${error?.message ?? 'no data'}`)
            return
        }

        storeSetMatch(matchRow)
        setGameData(questions as MatchQuestion[], matchRow)
        router.push('/game')
    }

    // Player 2 escrow deposit
    const handlePlayer2Deposit = async (matchData: Match) => {
        if (!session || !wallet.connected || !wallet.publicKey || !matchData) return
        if (matchData.stake_amount <= 0) return
        if (matchData.player2_deposit_tx) return // already deposited

        setDepositing(true)
        addLog(`Depositing ${matchData.stake_amount} SOL to escrow…`)

        try {
            const gameId = matchIdToGameId(matchData.id)
            const tx = buildJoinEscrowTx(wallet.publicKey, gameId)
            const txSig = await wallet.signAndSendTransaction(tx)
            addLog(`✅ Escrow deposit tx: ${txSig.slice(0, 8)}…`)

            await confirmDeposit(session.access_token, matchData.id, txSig, 'player2')
            addLog('✅ Deposit confirmed on backend')

            // Refresh match state so deposit status updates immediately for player 2
            const { data: latest, error } = await supabase
                .from('matches')
                .select('*')
                .eq('id', matchData.id)
                .single()
            if (latest && !error) {
                const refreshed = latest as Match
                setMatch(refreshed)
                storeSetMatch(refreshed)
                addLog('🔄 Match state refreshed after deposit')
            }
        } catch (err: any) {
            addLog(`❌ Deposit failed: ${err.message}`)
            Alert.alert('Deposit Failed', err.message ?? 'Could not deposit to escrow')
        } finally {
            setDepositing(false)
        }
    }

    useEffect(() => {
        if (!matchId) return
        addLog('Loading match data…')

        supabase.from('matches').select('*').eq('id', matchId).single()
            .then(({ data }) => {
                if (data) {
                    const m = data as Match
                    setMatch(m)
                    addLog(`Match loaded: status=${m.status}`)
                    if (m.status === 'starting' || m.status === 'active') {
                        navigateToGame(m)
                    }
                }
            })

        const channel = supabase
            .channel(`waiting-${matchId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
                async ({ new: updated }) => {
                    const m = updated as Match
                    setMatch(m)
                    addLog(`Match updated: status=${m.status}`)
                    if (m.status === 'starting' || m.status === 'active') {
                        navigateToGame(m)
                    }
                })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [matchId])

    const handleStart = async () => {
        if (!session || !matchId) return
        setStarting(true)
        addLog('Starting match…')
        const res = await startMatch(session.access_token, matchId)
        if (res.status !== 'SUCCESS') {
            setStarting(false)
            addLog(`❌ Start failed: ${res.error}`)
        }
    }

    const s = makeStyles(theme)
    const isReady = match?.status === 'ready'
    const isStaked = (match?.stake_amount ?? 0) > 0

    // Deposit status
    const p1Deposited = !!match?.player1_deposit_tx
    const p2Deposited = !!match?.player2_deposit_tx
    const bothDeposited = !isStaked || (p1Deposited && p2Deposited)

    // Can start: player1, match is ready, and deposits are done
    const canStart = isPlayer1 && isReady && bothDeposited && !starting

    // Player2 needs to deposit
    const needsP2Deposit = !isPlayer1 && isStaked && !p2Deposited && match?.status === 'ready'

    return (
        <View style={s.container}>
            <View style={s.topBar}>
                <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={s.backBtn}>
                    <Text style={s.backText}>← Leave</Text>
                </TouchableOpacity>
                <Text style={s.topBarTitle}>Waiting Room</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={s.body}>
                <View style={s.idCard}>
                    <Text style={s.idLabel}>MATCH CODE</Text>
                    <TouchableOpacity onPress={() => Clipboard.setString(match?.match_code ?? matchId ?? '')}>
                        <Text style={s.idValue}>{match?.match_code ?? matchId?.slice(0, 8).toUpperCase()}</Text>
                        <Text style={s.idHint}>Tap to copy — share with a friend!</Text>
                    </TouchableOpacity>
                </View>

                <View style={s.statusBlock}>
                    <Animated.Text style={[s.bigIcon, { opacity: isReady ? 1 : dotAnim }]}>
                        {isReady ? '🎮' : '⏳'}
                    </Animated.Text>
                    <Text style={s.statusTitle}>{isReady ? 'Opponent Joined!' : 'Waiting for opponent…'}</Text>
                    <Text style={s.statusSub}>
                        {isPlayer1
                            ? isReady
                                ? bothDeposited ? 'You can now start the match' : 'Waiting for deposits…'
                                : 'Share the Match Code with a friend'
                            : needsP2Deposit
                                ? 'Deposit SOL to escrow to play'
                                : 'Waiting for Player 1 to start…'
                        }
                    </Text>
                </View>

                {/* Players row with deposit status */}
                <View style={s.playersRow}>
                    <View style={s.playerSlot}>
                        <View style={[s.playerDot, { backgroundColor: theme.accent }]} />
                        <Text style={s.playerLabel}>YOU</Text>
                        {isStaked && (
                            <Text style={[s.depositBadge, { color: isPlayer1 ? (p1Deposited ? '#14F195' : '#FFAA00') : (p2Deposited ? '#14F195' : '#FFAA00') }]}>
                                {(isPlayer1 ? p1Deposited : p2Deposited) ? '✅ Paid' : '⏳ Pending'}
                            </Text>
                        )}
                    </View>
                    <Text style={s.vs}>VS</Text>
                    <View style={s.playerSlot}>
                        <View style={[s.playerDot, { backgroundColor: isReady ? theme.success : theme.border }]} />
                        <Text style={s.playerLabel}>{isReady ? 'READY' : '???'}</Text>
                        {isStaked && isReady && (
                            <Text style={[s.depositBadge, { color: (isPlayer1 ? p2Deposited : p1Deposited) ? '#14F195' : '#FFAA00' }]}>
                                {(isPlayer1 ? p2Deposited : p1Deposited) ? '✅ Paid' : '⏳ Pending'}
                            </Text>
                        )}
                    </View>
                </View>

                {/* Stake info */}
                {isStaked && (
                    <View style={s.stakeCard}>
                        <Text style={s.stakeLabel}>💰 STAKE</Text>
                        <Text style={s.stakeValue}>{match?.stake_amount} SOL</Text>
                        <Text style={s.stakeDesc}>Winner takes {((match?.stake_amount ?? 0) * 2).toFixed(4)} SOL</Text>
                    </View>
                )}

                {/* Player 2 deposit button */}
                {needsP2Deposit && (
                    <TouchableOpacity
                        style={[s.depositBtn, depositing && { opacity: 0.7 }]}
                        onPress={() => match && handlePlayer2Deposit(match)}
                        disabled={depositing || !wallet.connected}
                        activeOpacity={0.85}
                    >
                        {depositing
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={s.depositBtnText}>DEPOSIT {match?.stake_amount} SOL ⚡</Text>
                        }
                    </TouchableOpacity>
                )}

                {needsP2Deposit && !wallet.connected && (
                    <View style={s.warningCard}>
                        <Text style={s.warningText}>⚠ Connect wallet from Profile tab first</Text>
                    </View>
                )}

                {/* Start button (player 1 only) */}
                {isPlayer1 && isReady && (
                    <TouchableOpacity
                        style={[s.startBtn, !canStart && { opacity: 0.5 }]}
                        onPress={handleStart}
                        disabled={!canStart}
                        activeOpacity={0.85}
                    >
                        {starting
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={s.startBtnText}>START BATTLE ⚔</Text>
                        }
                    </TouchableOpacity>
                )}

                {/* Activity log */}
                {logs.length > 0 && (
                    <View style={s.logSection}>
                        <Text style={s.logTitle}>ACTIVITY LOG</Text>
                        {logs.slice(-8).map((log, i) => (
                            <Text key={i} style={s.logLine}>{log}</Text>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    )
}

const makeStyles = (theme: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
    backBtn: { width: 60 },
    backText: { color: theme.danger, fontSize: 15, fontWeight: '600' },
    topBarTitle: { fontSize: 17, fontWeight: '800', color: theme.text },
    body: { padding: 24, alignItems: 'center' },
    idCard: { backgroundColor: theme.surface, borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: theme.border, marginBottom: 32, width: '100%' },
    idLabel: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, letterSpacing: 2, marginBottom: 8 },
    idValue: { fontSize: 28, fontWeight: '900', color: theme.accent, letterSpacing: 4, textAlign: 'center' },
    idHint: { color: theme.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 6 },
    statusBlock: { alignItems: 'center', marginBottom: 32 },
    bigIcon: { fontSize: 64, marginBottom: 16 },
    statusTitle: { fontSize: 22, fontWeight: '800', color: theme.text, textAlign: 'center', marginBottom: 8 },
    statusSub: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
    playersRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24, gap: 20 },
    playerSlot: { alignItems: 'center', gap: 6 },
    playerDot: { width: 14, height: 14, borderRadius: 7 },
    playerLabel: { color: theme.textSecondary, fontWeight: '700', fontSize: 12, letterSpacing: 1 },
    depositBadge: { fontSize: 11, fontWeight: '700' },
    vs: { fontSize: 18, fontWeight: '900', color: theme.accent },
    stakeCard: { backgroundColor: theme.surface, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: theme.border, marginBottom: 20, width: '100%' },
    stakeLabel: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, letterSpacing: 2, marginBottom: 4 },
    stakeValue: { fontSize: 28, fontWeight: '900', color: '#14F195', marginBottom: 4 },
    stakeDesc: { color: theme.textSecondary, fontSize: 12 },
    depositBtn: { backgroundColor: '#14F195', borderRadius: 14, paddingVertical: 18, paddingHorizontal: 40, alignItems: 'center', marginBottom: 12, width: '100%' },
    depositBtnText: { color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
    warningCard: { backgroundColor: 'rgba(255, 170, 0, 0.1)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255, 170, 0, 0.3)', marginBottom: 12, width: '100%' },
    warningText: { color: '#FFAA00', fontSize: 12, fontWeight: '600', textAlign: 'center' },
    startBtn: { backgroundColor: theme.accent, borderRadius: 14, paddingVertical: 18, paddingHorizontal: 40, alignItems: 'center', shadowColor: theme.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, marginBottom: 24, width: '100%' },
    startBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1.5 },
    logSection: { width: '100%', backgroundColor: theme.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: theme.border, marginTop: 8 },
    logTitle: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, letterSpacing: 2, marginBottom: 10 },
    logLine: { color: theme.textSecondary, fontSize: 11, fontFamily: 'monospace', lineHeight: 18 },
})
