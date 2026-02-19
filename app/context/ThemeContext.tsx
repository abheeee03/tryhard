import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'dark' | 'light';

export const DarkTheme = {
    bg: '#0A0A0F',
    surface: '#1A1A2E',
    card: '#16213E',
    accent: '#E94560',
    accentSoft: 'rgba(233,69,96,0.15)',
    text: '#FFFFFF',
    textSecondary: '#A0A0B8',
    border: '#2A2A4A',
    success: '#00C9A7',
    warning: '#FFB800',
    danger: '#FF4757',
};

export const LightTheme = {
    bg: '#F0F2F5',
    surface: '#FFFFFF',
    card: '#E8EAF6',
    accent: '#E94560',
    accentSoft: 'rgba(233,69,96,0.10)',
    text: '#0A0A0F',
    textSecondary: '#5A5A7A',
    border: '#D0D0E0',
    success: '#00A882',
    warning: '#E6A800',
    danger: '#E53935',
};

interface ThemeContextType {
    mode: ThemeMode;
    theme: typeof DarkTheme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    mode: 'dark',
    theme: DarkTheme,
    toggleTheme: () => { },
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [mode, setMode] = useState<ThemeMode>('dark');

    useEffect(() => {
        AsyncStorage.getItem('theme_mode').then((val) => {
            if (val === 'light' || val === 'dark') setMode(val);
        });
    }, []);

    const toggleTheme = () => {
        setMode((prev) => {
            const next = prev === 'dark' ? 'light' : 'dark';
            AsyncStorage.setItem('theme_mode', next);
            return next;
        });
    };

    return (
        <ThemeContext.Provider value={{ mode, theme: mode === 'dark' ? DarkTheme : LightTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
