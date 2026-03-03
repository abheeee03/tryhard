import './src/polyfills';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ThemeProvider, useTheme } from '@/src/context/ThemeContext';
import { supabase } from '@/src/lib/supabase';
import { useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';

function RootLayoutNav() {
    const { mode } = useTheme();
    const router = useRouter();
    const segments = useSegments();
    const [session, setSession] = useState<Session | null | undefined>(undefined);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (session === undefined) return; // still loading
        const inAuth = segments[0] === 'auth';
        if (!session && !inAuth) {
            router.replace('/auth');
        } else if (session && inAuth) {
            router.replace('/(tabs)');
        }
    }, [session, segments]);

    return (
        <>
            <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="auth" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="create-match" />
                <Stack.Screen name="waiting-room" />
                <Stack.Screen name="game" />
                <Stack.Screen name="result" />
            </Stack>
        </>
    );
}

export default function RootLayout() {
    return (
        <ThemeProvider>
            <RootLayoutNav />
        </ThemeProvider>
    );
}
