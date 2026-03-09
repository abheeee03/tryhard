import React, { useState, useRef } from 'react'
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator, Alert, Animated, Image, Switch
} from 'react-native'
import { useRouter } from 'expo-router'
import { PublicKey } from '@solana/web3.js'
import { useSession } from '../src/hooks/useSession'
import { useWallet } from '../src/hooks/useWallet'
import { useGameStore } from '../src/stores/useGameStore'
import { confirmDeposit, createMatch } from '../src/lib/api'
import { buildInitializeEscrowTx, matchIdToGameId, solToLamports } from '../src/lib/escrow'
import { ConnectButton } from '../src/components/ConnectButton'
import { useTheme } from '../src/context/ThemeContext'

// Backend authority pubkey — must match BACKEND_WALLET_SECRET on the server
const BACKEND_AUTH_PUBKEY = new PublicKey(
    process.env.EXPO_PUBLIC_BACKEND_AUTH_PUBKEY ?? '11111111111111111111111111111111'
)

type PickerOption = { label: string; value: any }

const TIME_OPTIONS: PickerOption[] = [
    { label: '5s', value: 5 }, { label: '8s', value: 8 }, { label: '10s', value: 10 },
]
const COUNT_OPTIONS: PickerOption[] = [
    { label: '5', value: 5 }, { label: '10', value: 10 }, { label: '15', value: 15 },
]
const DIFFICULTY_OPTIONS: PickerOption[] = [
    { label: 'Easy', value: 'easy' }, { label: 'Medium', value: 'medium' }, { label: 'Hard', value: 'hard' },
]

function SegmentedPicker({ options, value, onChange, theme }: {
    options: PickerOption[]; value: any; onChange: (v: any) => void; theme: any
}) {
    return (
        <View style={{ flexDirection: 'row', gap: 8 }}>
            {options.map((opt) => {
                const active = opt.value === value
                return (
                    <TouchableOpacity key={String(opt.value)} onPress={() => onChange(opt.value)}
                        style={{ flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: active ? '#3B82F6' : theme.surface, borderWidth: 1, borderColor: active ? '#3B82F6' : theme.border }}>
                        <Text style={{ fontFamily: 'CabinetGrotesk', color: active ? '#fff' : theme.textSecondary, fontSize: 14 }}>
                            {opt.label}
                        </Text>
                    </TouchableOpacity>
                )
            })}
        </View>
    )
}

export default function CreateMatchScreen() {
    const { theme } = useTheme()
    const { session } = useSession()
    const router = useRouter()
    const wallet = useWallet()
    const setMatchId = useGameStore((s) => s.setMatchId)
    const [category, setCategory] = useState('')
    const [timePerQ, setTimePerQ] = useState(5)
    const [totalQ, setTotalQ] = useState(5)
    const [difficulty, setDifficulty] = useState('easy')
    const [stake, setStake] = useState('0')
    const [isPrivate, setIsPrivate] = useState(false)
    const [loading, setLoading] = useState(false)
    const [status, setStatus] = useState<string | null>(null)
    const btnScale = useRef(new Animated.Value(1)).current
    const { isDemoMode } = useGameStore()

    const handleCreate = async () => {
        if (!session) return
        if (!category.trim()) { Alert.alert('Enter a category'); return }

        const stakeAmount = parseFloat(stake) || 0

        // If stake > 0, wallet must be connected, unless demo mode
        if (stakeAmount > 0 && !wallet.connected && !isDemoMode) {
            Alert.alert(
                'Wallet Required',
                'Connect your Solana wallet from the Profile tab to create a staked match.',
                [{ text: 'OK' }]
            )
            return
        }

        setLoading(true)

        try {
            // Step 1: Create match on backend
            setStatus(isDemoMode ? 'Creating Demo Match…' : 'Creating match…')
            console.log(`[create-match] Creating match… (demo: ${isDemoMode})`)
            const res = await createMatch(session.access_token, {
                time_per_que: timePerQ,
                category: category.trim(),
                total_questions: totalQ,
                stake_amount: stakeAmount,
                difficulty,
                player1_wallet: wallet.publicKey?.toBase58() ?? null,
                isDemoMode,
                is_private: isPrivate
            })

            if (res.status !== 'SUCCESS') {
                Alert.alert('Error', res.error ?? 'Failed to create match')
                setLoading(false)
                setStatus(null)
                return
            }

            const matchId = res.data.match.id
            console.log(`[create-match] Match created: ${matchId}`)

            // Step 2: If staked, deposit to escrow
            if (stakeAmount > 0) {
                if (isDemoMode) {
                    setStatus('Mocking Demo Deposit…')
                    console.log(`[create-match] Demo mode: simulating deposit confirm for ${stakeAmount} SOL…`)
                    await confirmDeposit(session.access_token, matchId, `DEMO_TX_${Date.now()}`, 'player1', true)
                    console.log(`[create-match] ✅ Demo Deposit confirmed`)
                } else if (wallet.publicKey) {
                    setStatus('Depositing to escrow…')
                    console.log(`[create-match] Building escrow initialize tx for ${stakeAmount} SOL…`)

                    const gameId = matchIdToGameId(matchId)
                    const tx = buildInitializeEscrowTx(
                        wallet.publicKey,
                        gameId,
                        solToLamports(stakeAmount),
                        BACKEND_AUTH_PUBKEY
                    )

                    const txSig = await wallet.signAndSendTransaction(tx)
                    console.log(`[create-match] ✅ Escrow deposit tx: ${txSig}`)

                    // Step 3: Confirm deposit on backend
                    setStatus('Confirming deposit…')
                    await confirmDeposit(session.access_token, matchId, txSig, 'player1', false)
                    console.log(`[create-match] ✅ Deposit confirmed on backend`)
                }
            }

            setMatchId(matchId, true)
            router.push('/waiting-room')
        } catch (err: any) {
            console.error('[create-match] Error:', err)

            // Provide more helpful error messages based on the error
            const errorMsg = err?.message || String(err)
            let userFriendlyMsg = 'Something went wrong'

            if (errorMsg.includes('Program') && errorMsg.includes('does not exist')) {
                userFriendlyMsg = 'The game program is not deployed. Please contact support.'
            } else if (errorMsg.includes('insufficient funds')) {
                userFriendlyMsg = 'Insufficient SOL balance. Please add more SOL to your wallet.'
            } else if (errorMsg.includes('User canceled')) {
                userFriendlyMsg = 'Transaction was cancelled.'
            } else if (errorMsg.includes('simulation failed')) {
                userFriendlyMsg = 'Transaction simulation failed. Please try again.'
            }

            Alert.alert('Error', userFriendlyMsg)
        } finally {
            setLoading(false)
            setStatus(null)
        }
    }

    const s = makeStyles(theme)

    return (
        <View style={s.container}>
            <View style={s.topBar}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Text style={s.backText}>← BACK</Text>
                </TouchableOpacity>
                <Text style={s.topBarTitle}>New Battle {isDemoMode ? '(Demo)' : ''}</Text>
                <View style={{ width: 60 }} />
            </View>
            <ScrollView contentContainerStyle={s.form}>
                <Text style={s.sectionLabel}>CATEGORY</Text>
                <TextInput style={s.input} value={category} onChangeText={setCategory}
                    placeholder="E.G. SCIENCE, GAMING…" placeholderTextColor={theme.textSecondary} autoCapitalize="characters" />

                <Text style={s.sectionLabel}>TIME PER QUESTION</Text>
                <SegmentedPicker options={TIME_OPTIONS} value={timePerQ} onChange={setTimePerQ} theme={theme} />

                <Text style={s.sectionLabel}>TOTAL QUESTIONS</Text>
                <SegmentedPicker options={COUNT_OPTIONS} value={totalQ} onChange={setTotalQ} theme={theme} />

                <Text style={s.sectionLabel}>DIFFICULTY</Text>
                <SegmentedPicker options={DIFFICULTY_OPTIONS} value={difficulty} onChange={setDifficulty} theme={theme} />

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.sectionLabel}>STAKE AMOUNT</Text>
                    <Image source={require('../assets/solana-icon.png')} style={{ width: 16, height: 16, tintColor: theme.textSecondary }} />
                </View>
                <TextInput style={s.input} value={stake} onChangeText={setStake}
                    keyboardType="numeric" placeholder="0.0" placeholderTextColor={theme.textSecondary} textAlign="center" />

                {parseFloat(stake) > 0 && !wallet.connected && !isDemoMode && (
                    <View style={s.warningCard}>
                        <Text style={s.warningText}>⚠ Connect your wallet to stake SOL</Text>
                    </View>
                )}

                <Text style={s.sectionLabel}>SOLANA WALLET</Text>
                <ConnectButton
                    connected={wallet.connected}
                    connecting={wallet.connecting}
                    publicKey={wallet.publicKey?.toBase58() ?? null}
                    onConnect={wallet.connect}
                    onDisconnect={wallet.disconnect}
                />



                {parseFloat(stake) > 0 && (wallet.connected || isDemoMode) && (
                    <View style={s.infoCard}>
                        <Text style={s.infoText}>
                            {isDemoMode ? `🎮 Demo: ${parseFloat(stake)} fake SOL staked!` : `💰 ${parseFloat(stake)} SOL will be deposited to escrow on creation`}
                        </Text>
                    </View>
                )}



                <View style={s.privateToggleRow}>
                    <View>
                        <Text style={s.settingLabel}>Private Match</Text>
                        <Text style={s.settingDesc}>Only players with the 6-digit code can join</Text>
                    </View>
                    <Switch
                        value={isPrivate}
                        onValueChange={setIsPrivate}
                        trackColor={{ false: '#1E293B', true: '#3B82F6' }}
                        thumbColor="#fff"
                    />
                </View>

                <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                    <TouchableOpacity style={[s.createBtn, loading && { opacity: 0.7 }]} onPress={handleCreate}
                        onPressIn={() => Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true }).start()}
                        onPressOut={() => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true }).start()}
                        disabled={loading} activeOpacity={0.9}>
                        {loading
                            ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <ActivityIndicator color="#fff" />
                                    <Text style={s.createBtnText}>{status ? status.toUpperCase() : 'LOADING...'}</Text>
                                </View>
                            )
                            : <Text style={s.createBtnText}>CREATE BATTLE ⚔</Text>
                        }
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
        </View>
    )
}

const makeStyles = (theme: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 64, paddingBottom: 24, paddingHorizontal: 20, backgroundColor: theme.bg },
    backBtn: { width: 80 },
    backText: { fontFamily: 'CabinetGrotesk', color: '#3B82F6', fontSize: 16 },
    topBarTitle: { fontFamily: 'CabinetGrotesk', fontSize: 20, color: theme.text },
    form: { padding: 20, gap: 16, paddingBottom: 60 },
    sectionLabel: { fontFamily: 'CabinetGrotesk', fontSize: 12, color: theme.textSecondary, letterSpacing: 1, marginBottom: -8 },
    input: { fontFamily: 'CabinetGrotesk', backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, color: theme.text, fontSize: 16 },
    createBtn: { backgroundColor: '#3B82F6', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 12, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 4 },
    createBtnText: { fontFamily: 'CabinetGrotesk', color: '#fff', fontSize: 16, letterSpacing: 1 },
    warningCard: { backgroundColor: 'rgba(255, 170, 0, 0.1)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255, 170, 0, 0.3)' },
    warningText: { fontFamily: 'CabinetGrotesk', color: '#FFAA00', fontSize: 14, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
    infoCard: { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)' },
    infoText: { fontFamily: 'CabinetGrotesk', color: '#3B82F6', fontSize: 14, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5 },
    statusCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#3B82F6' },
    statusText: { fontFamily: 'CabinetGrotesk', color: theme.text, fontSize: 14 },
    privateToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.border },
    settingLabel: { fontFamily: 'CabinetGrotesk', color: theme.text, fontSize: 16, marginBottom: 2 },
    settingDesc: { fontFamily: 'CabinetGrotesk', color: theme.textSecondary, fontSize: 12 },
})
