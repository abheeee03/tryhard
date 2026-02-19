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
            <View style={s.header}>
                <Text style={s.logo}>⚔</Text>
                <Text style={s.title}>TRYHARD</Text>
                <Text style={s.subtitle}>1v1 Quiz Battles</Text>
            </View>

            <View style={s.card}>
                <Text style={s.cardTitle}>{isSignUp ? 'Create Account' : 'Welcome Back'}</Text>

                {error ? <Text style={s.errorText}>{error}</Text> : null}

                <View style={s.inputGroup}>
                    <Text style={s.label}>EMAIL</Text>
                    <TextInput
                        style={s.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@example.com"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                <View style={s.inputGroup}>
                    <Text style={s.label}>PASSWORD</Text>
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
                            : <Text style={s.primaryBtnText}>{isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}</Text>
                        }
                    </TouchableOpacity>
                </Animated.View>

                <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); setError('') }}>
                    <Text style={s.switchText}>
                        {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                        <Text style={s.switchLink}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    )
}

const makeStyles = (theme: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.bg,
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logo: {
        fontSize: 56,
        marginBottom: 8,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: theme.accent,
        letterSpacing: 6,
    },
    subtitle: {
        fontSize: 14,
        color: theme.textSecondary,
        letterSpacing: 2,
        marginTop: 4,
    },
    card: {
        backgroundColor: theme.surface,
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: theme.border,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.text,
        marginBottom: 20,
        textAlign: 'center',
    },
    errorText: {
        color: theme.danger,
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 12,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 11,
        fontWeight: '700',
        color: theme.textSecondary,
        letterSpacing: 2,
        marginBottom: 8,
    },
    input: {
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 12,
        padding: 14,
        color: theme.text,
        fontSize: 15,
    },
    primaryBtn: {
        backgroundColor: theme.accent,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 16,
    },
    primaryBtnText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 14,
        letterSpacing: 1.5,
    },
    switchText: {
        textAlign: 'center',
        color: theme.textSecondary,
        fontSize: 14,
    },
    switchLink: {
        color: theme.accent,
        fontWeight: '700',
    },
})