import { Tabs } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { Text } from 'react-native';

export default function TabLayout() {
    const { theme } = useTheme();
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: theme.surface,
                    borderTopColor: theme.border,
                    borderTopWidth: 1,
                    paddingBottom: 24,
                    paddingTop: 10,
                    height: 72,
                },
                tabBarActiveTintColor: theme.accent,
                tabBarInactiveTintColor: theme.textSecondary,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 0.5,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ focused }) => (
                        <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>⚔</Text>
                    ),
                }}
            />
            <Tabs.Screen
                name="account"
                options={{
                    title: 'Account',
                    tabBarIcon: ({ focused }) => (
                        <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>👤</Text>
                    ),
                }}
            />
        </Tabs>
    );
}
