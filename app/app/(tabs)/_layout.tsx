// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0A0A0F",
          borderTopColor: "#2A2A4A",
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 12,
          height: 70,
        },
        tabBarActiveTintColor: "#E94560",
        tabBarInactiveTintColor: "#6B7280",
      }}
    >
      {/* Tab 1: Home / Battles */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>⚔</Text>
          ),
        }}
      />

      {/* Tab 2: Your Matches */}
      <Tabs.Screen
        name="matches"
        options={{
          title: "Matches",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size} color={color} />
          ),
        }}
      />

      {/* Tab 3: Profile / Account */}
      <Tabs.Screen
        name="account"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
