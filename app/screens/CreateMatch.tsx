import React, { useState, useRef } from 'react'
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator, Alert, Animated
} from 'react-native'
import { createMatch } from '../lib/api'
import { Session } from '@supabase/supabase-js'
import { useTheme } from '../context/ThemeContext'

type Props = {
    session: Session
    onNavigate: (screen: string, params?: any) => void
    onBack: () => void
}

type PickerOption = { label: string; value: any }

const TIME_OPTIONS: PickerOption[] = [
    { label: '5s', value: 5 },
    { label: '8s', value: 8 },
    { label: '10s', value: 10 },
]
const COUNT_OPTIONS: PickerOption[] = [
    { label: '5', value: 5 },
    { label: '10', value: 10 },
    { label: '15', value: 15 },
]
const DIFFICULTY_OPTIONS: PickerOption[] = [
    { label: 'Easy', value: 'easy' },
    { label: 'Medium', value: 'medium' },
    { label: 'Hard', value: 'hard' },
]

function SegmentedPicker({ options, value, onChange, theme }: {
    options: PickerOption[]; value: any; onChange: (v: any) => void; theme: any
}) {
    return (
        <View style={{ flexDirection: 'row', gap: 8 }}>
            {options.map((opt) => {
                const active = opt.value === value
                return (
                    <TouchableOpacity
                        key={String(opt.value)}
                        onPress={() => onChange(opt.value)}
                        style={{
                            flex: 1,
                            paddingVertical: 10,
                            borderRadius: 10,
                            alignItems: 'center',
                            backgroundColor: active ? theme.accent : theme.card,
                            borderWidth: 1,
                            borderColor: active ? theme.accent : theme.border,
                        }}
                    >
                        <Text style={{ color: active ? '#fff' : theme.textSecondary, fontWeight: '700', fontSize: 13 }}>
                            {opt.label}
                        </Text>
                    </TouchableOpacity>
                )
            })}
        </View>
    )
}

export default function CreateMatch({ session, onNavigate, onBack }: Props) {
    const { theme } = useTheme()
    const [category, setCategory] = useState('')
    const [timePerQ, setTimePerQ] = useState(5)
    const [totalQ, setTotalQ] = useState(5)
    const [difficulty, setDifficulty] = useState('easy')
    const [stake, setStake] = useState('0')
    const [loading, setLoading] = useState(false)
    const btnScale = useRef(new Animated.Value(1)).current

    const handleCreate = async () => {
        if (!category.trim()) { Alert.alert('Enter a category'); return }
        setLoading(true)
        const res = await createMatch(session.access_token, {
            time_per_que: timePerQ,
            category: category.trim(),
            total_questions: totalQ,
            stake_amount: parseFloat(stake) || 0,
            difficulty,
        })
        setLoading(false)
        if (res.status === 'SUCCESS') {
            onNavigate('waitingRoom', { matchId: res.data.match.id, isPlayer1: true })
        } else {
            Alert.alert('Error', res.error ?? 'Failed to create match')
        }
    }

    const s = makeStyles(theme)

    return (
        <View style={s.container}>
            <View style={s.topBar}>
                <TouchableOpacity onPress={onBack} style={s.backBtn}>
                    <Text style={s.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={s.topBarTitle}>New Battle</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={s.form}>
                <Text style={s.sectionLabel}>CATEGORY</Text>
                <TextInput
                    style={s.input}
                    value={category}
                    onChangeText={setCategory}
                    placeholder="e.g. Science, History, Movies…"
                    placeholderTextColor={theme.textSecondary}
                />

                <Text style={s.sectionLabel}>TIME PER QUESTION</Text>
                <SegmentedPicker options={TIME_OPTIONS} value={timePerQ} onChange={setTimePerQ} theme={theme} />

                <Text style={s.sectionLabel}>TOTAL QUESTIONS</Text>
                <SegmentedPicker options={COUNT_OPTIONS} value={totalQ} onChange={setTotalQ} theme={theme} />

                <Text style={s.sectionLabel}>DIFFICULTY</Text>
                <SegmentedPicker options={DIFFICULTY_OPTIONS} value={difficulty} onChange={setDifficulty} theme={theme} />

                <Text style={s.sectionLabel}>STAKE AMOUNT</Text>
                <TextInput
                    style={s.input}
                    value={stake}
                    onChangeText={setStake}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                />

                <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                    <TouchableOpacity
                        style={[s.createBtn, loading && { opacity: 0.7 }]}
                        onPress={handleCreate}
                        onPressIn={() => Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true }).start()}
                        onPressOut={() => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true }).start()}
                        disabled={loading}
                        activeOpacity={0.9}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
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
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 56,
        paddingBottom: 16,
        paddingHorizontal: 20,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    backBtn: { width: 60 },
    backText: { color: theme.accent, fontSize: 15, fontWeight: '600' },
    topBarTitle: { fontSize: 17, fontWeight: '800', color: theme.text },
    form: { padding: 24, gap: 16 },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: theme.textSecondary,
        letterSpacing: 2,
        marginBottom: -6,
    },
    input: {
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 12,
        padding: 14,
        color: theme.text,
        fontSize: 15,
    },
    createBtn: {
        backgroundColor: theme.accent,
        borderRadius: 14,
        paddingVertical: 18,
        alignItems: 'center',
        marginTop: 8,
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    createBtnText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 1.5 },
})
