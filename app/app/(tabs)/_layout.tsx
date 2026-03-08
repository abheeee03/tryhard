// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/context/ThemeContext";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          elevation: 0,
          shadowOpacity: 0,
          height: Platform.OS === 'ios' ? 88 : 70 + insets.bottom,
          paddingBottom: Platform.OS === 'ios' ? 24 : insets.bottom + 10,
          paddingTop: 10,
        },
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontFamily: 'CabinetGrotesk',
          fontWeight: '800',
          fontSize: 11,
          marginTop: 4,
        },
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: theme.textSecondary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="matches"
        options={{
          title: "Matches",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "layers" : "layers-outline"} size={26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="account"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  createTabContainer: {
    top: -15, // Lift the button up
    justifyContent: "center",
    alignItems: "center",
  },
  createTabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#3B82F6", // Consistent blue-500
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    borderWidth: 4,
    borderColor: '#1A1A2E' // matches Dark surface, ideally dynamic but fine for now
  }
});
