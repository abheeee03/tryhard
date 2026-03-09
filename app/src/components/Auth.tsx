import React, { useState } from 'react'
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
    Image
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../context/ThemeContext'

export default function Auth() {
    const { theme } = useTheme()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [loading, setLoading] = useState(false)
    const [isSignUp, setIsSignUp] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit() {
        setLoading(true)
        setError('')

        if (isSignUp) {
            if (!username.trim()) {
                setError('Username is required')
                setLoading(false)
                return
            }

            const { data, error: e } = await supabase.auth.signUp({ email, password })
            if (e) {
                setError(e.message)
            } else if (data.user) {
                // Insert into profiles table
                const { error: profileError } = await supabase.from('profiles').upsert({
                    id: data.user.id,
                    username: username.trim()
                })

                if (profileError) {
                    console.error('Profile creation error:', profileError)
                }

                Alert.alert(
                    'Verify Email',
                    'Please check your email for a confirmation link and login again using the same credentials.',
                    [{ text: 'OK', onPress: () => setIsSignUp(false) }]
                )
            }
        } else {
            const { error: e } = await supabase.auth.signInWithPassword({ email, password })
            if (e) setError(e.message)
        }
        setLoading(false)
    }

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.content}>

                {/* Header Section */}
                <View style={styles.headerContainer}>
                    <Text style={styles.title}>Connect with TryHard</Text>
                    <Text style={styles.subtitle}>
                        {isSignUp
                            ? "Create an account to track your stats and compete."
                            : "Start by entering your credentials"}
                    </Text>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {/* Form Section */}
                <View style={styles.formContainer}>
                    {isSignUp && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Username</Text>
                            <TextInput
                                style={styles.input}
                                value={username}
                                onChangeText={setUsername}
                                placeholder="Enter username"
                                placeholderTextColor="#666666"
                                autoCapitalize="none"
                            />
                        </View>
                    )}

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={styles.input}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Enter email"
                            placeholderTextColor="#666666"
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <View style={styles.passwordHeader}>
                            <Text style={styles.label}>Password</Text>
                            {!isSignUp && (
                                <TouchableOpacity>
                                    <Text style={styles.forgotPassword}>Forgot Password?</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <TextInput
                            style={styles.input}
                            value={password}
                            onChangeText={setPassword}
                            placeholder="Enter password"
                            placeholderTextColor="#666666"
                            secureTextEntry
                            autoCapitalize="none"
                        />
                    </View>
                </View>

                {/* Submit Action */}
                <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={handleSubmit}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    {loading
                        ? <ActivityIndicator color="#000000" />
                        : <Text style={styles.primaryBtnText}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
                    }
                </TouchableOpacity>

                {/* Switch Mode */}
                <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); setError(''); setPassword('') }} style={styles.switchWrapper}>
                    <Text style={styles.switchText}>
                        {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                        <Text style={styles.switchLink}>{isSignUp ? 'Sign in' : 'Sign up'}</Text>
                    </Text>
                </TouchableOpacity>

            </View>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A0A', // Deep dark matching the image
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 60,
    },
    logoText: {
        fontFamily: 'CabinetGrotesk',
        fontWeight: "100",
        fontSize: 28,
        color: '#FFFFFF',
        marginLeft: 10,
    },
    headerContainer: {
        marginBottom: 32,
    },
    title: {
        fontFamily: 'CabinetGrotesk',
        fontSize: 24,
        color: '#FFFFFF',
        marginBottom: 8,
    },
    subtitle: {
        fontFamily: 'CabinetGrotesk',
        fontSize: 14,
        color: '#A1A1AA',
        lineHeight: 20,
    },
    errorText: {
        fontFamily: 'CabinetGrotesk',
        color: '#EF4444',
        fontSize: 14,
        marginBottom: 16,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 12,
        borderRadius: 8,
    },
    formContainer: {
        marginBottom: 32,
    },
    inputGroup: {
        marginBottom: 20,
    },
    passwordHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    label: {
        fontFamily: 'CabinetGrotesk',
        fontSize: 14,
        color: '#E4E4E7',
        marginBottom: 8,
    },
    forgotPassword: {
        fontFamily: 'CabinetGrotesk',
        fontSize: 12,
        color: '#A1A1AA',
    },
    input: {
        fontFamily: 'CabinetGrotesk',
        backgroundColor: '#18181B',
        borderRadius: 12,
        padding: 16,
        color: '#FFFFFF',
        fontSize: 16,
    },
    primaryBtn: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: 18,
        alignItems: 'center',
        marginBottom: 32,
    },
    primaryBtnText: {
        fontFamily: 'CabinetGrotesk',
        color: '#000000',
        fontSize: 16,
    },
    switchWrapper: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    switchText: {
        fontFamily: 'CabinetGrotesk',
        color: '#A1A1AA',
        fontSize: 14,
    },
    switchLink: {
        color: '#FFFFFF',
    },
})
