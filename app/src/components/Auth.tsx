import React, { useState } from 'react'
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Animated
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../context/ThemeContext'

export default function Auth() {
    const { theme } = useTheme()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [isSignUp, setIsSignUp] = useState(false)
    const [error, setError] = useState('')

    const scaleAnim = React.useRef(new Animated.Value(1)).current

    const pressIn = () => Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start()
    const pressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()

    async function handleSubmit() {
        setLoading(true)
        setError('')
        if (isSignUp) {
            const { data: { session }, error: e } = await supabase.auth.signUp({ email, password })
            if (e) setError(e.message)
            else if (!session) setError('Check your inbox for a verification email!')
        } else {
            const { error: e } = await supabase.auth.signInWithPassword({ email, password })
            if (e) setError(e.message)
        }
        setLoading(false)
    }

    const s = makeStyles(theme)

    return (
        <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={s.decorativeCircle} />
            <View style={s.decorativeBox} />

            <View style={s.header}>
                <Text style={s.logo}>⚔</Text>
                <Text style={s.title}>TRYHARD</Text>
                <Text style={s.subtitle}>PVP TRIVIA RUN ON SOLANA</Text>
            </View>

            <View style={s.card}>
                <Text style={s.cardTitle}>{isSignUp ? 'CREATE ACCOUNT' : 'LOGIN'}</Text>

                {error ? <Text style={s.errorText}>{error}</Text> : null}

                <View style={s.inputGroup}>
                    <Text style={s.label}>EMAIL ADDRESS</Text>
                    <TextInput
                        style={s.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="PLAYER@DOMAIN.COM"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                <View style={s.inputGroup}>
                    <Text style={s.label}>SECURE PASSWORD</Text>
                    <TextInput
                        style={s.input}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="••••••••"
                        placeholderTextColor={theme.textSecondary}
                        secureTextEntry
                        autoCapitalize="none"
                    />
                </View>

                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                    <TouchableOpacity
                        style={s.primaryBtn}
                        onPress={handleSubmit}
                        onPressIn={pressIn}
                        onPressOut={pressOut}
                        disabled={loading}
                        activeOpacity={0.9}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={s.primaryBtnText}>{isSignUp ? 'JOIN THE ARENA' : 'ENTER MATCH'}</Text>
                        }
                    </TouchableOpacity>
                </Animated.View>

                <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); setError('') }} style={s.switchWrapper}>
                    <Text style={s.switchText}>
                        {isSignUp ? 'ALREADY REGISTERED? ' : "NEW CHALLENGER? "}
                        <Text style={s.switchLink}>{isSignUp ? 'LOG IN' : 'SIGN UP'}</Text>
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    )
}

const makeStyles = (theme: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A', // Extremely dark blue slate to make blue-500 pop
        justifyContent: 'center',
        padding: 24,
    },
    decorativeCircle: {
        position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: '#3B82F6', opacity: 0.1, top: -100, right: -50,
    },
    decorativeBox: {
        position: 'absolute', width: 200, height: 200, backgroundColor: '#3B82F6', opacity: 0.05, bottom: -50, left: -50, transform: [{ rotate: '45deg' }]
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logo: {
        fontSize: 64,
        marginBottom: 16,
        color: '#3B82F6'
    },
    title: {
        fontFamily: 'CabinetGrotesk',
        fontSize: 48,
        fontWeight: '900',
        color: '#FFF',
        letterSpacing: 8,
        textAlign: 'center'
    },
    subtitle: {
        fontFamily: 'CabinetGrotesk',
        fontSize: 14,
        fontWeight: '800',
        color: '#3B82F6',
        letterSpacing: 4,
        marginTop: 8,
    },
    card: {
        backgroundColor: theme.surface,
        borderRadius: 24,
        padding: 32,
        borderWidth: 2,
        borderColor: '#3B82F6',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
    },
    cardTitle: {
        fontFamily: 'CabinetGrotesk',
        fontSize: 28,
        fontWeight: '900',
        color: theme.text,
        marginBottom: 24,
        textAlign: 'center',
        letterSpacing: 2,
    },
    errorText: {
        fontFamily: 'CabinetGrotesk',
        color: theme.danger,
        fontSize: 14,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 16,
        backgroundColor: 'rgba(255, 71, 87, 0.1)',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.danger,
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        fontFamily: 'CabinetGrotesk',
        fontSize: 12,
        fontWeight: '900',
        color: theme.textSecondary,
        letterSpacing: 2,
        marginBottom: 10,
    },
    input: {
        fontFamily: 'CabinetGrotesk',
        backgroundColor: theme.bg,
        borderWidth: 2,
        borderColor: theme.border,
        borderRadius: 16,
        padding: 18,
        color: theme.text,
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 1,
    },
    primaryBtn: {
        backgroundColor: '#3B82F6',
        borderRadius: 16,
        paddingVertical: 20,
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 24,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    primaryBtnText: {
        fontFamily: 'CabinetGrotesk',
        color: '#fff',
        fontWeight: '900',
        fontSize: 18,
        letterSpacing: 2,
    },
    switchWrapper: { paddingVertical: 8 },
    switchText: {
        fontFamily: 'CabinetGrotesk',
        textAlign: 'center',
        color: theme.textSecondary,
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 1,
    },
    switchLink: {
        color: '#3B82F6',
        fontWeight: '900',
    },
})
