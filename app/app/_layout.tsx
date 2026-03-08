import "../src/polyfills";
import 'react-native-get-random-values';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useTheme } from "../src/context/ThemeContext";
import { supabase } from "../src/lib/supabase";
import { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Text, TextInput } from 'react-native';

SplashScreen.preventAutoHideAsync();

// Overriding defaultProps for React Native Text components 
// ensures the custom font applies globally without needing to edit every file
const customTextProps = { style: { fontFamily: 'CabinetGrotesk' } };
if ((Text as any).defaultProps) {
  (Text as any).defaultProps.style = { ...(Text as any).defaultProps.style, fontFamily: 'CabinetGrotesk' };
} else {
  (Text as any).defaultProps = customTextProps;
}
if ((TextInput as any).defaultProps) {
  (TextInput as any).defaultProps.style = { ...(TextInput as any).defaultProps.style, fontFamily: 'CabinetGrotesk' };
} else {
  (TextInput as any).defaultProps = customTextProps;
}

function RootLayoutNav() {
  const { mode } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  const [loaded] = useFonts({
    CabinetGrotesk: require('../assets/font/CabinetGrotesk.ttf'),
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    if (session === undefined || !loaded) return; // still loading
    const inAuth = segments[0] === 'auth';
    if (!session && !inAuth) {
      router.replace('/auth');
    } else if (session && inAuth) {
      router.replace('/(tabs)');
    }
  }, [session, segments]);

  if (!loaded) return null;

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
    <SafeAreaProvider>
      <ThemeProvider>
        <RootLayoutNav />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
