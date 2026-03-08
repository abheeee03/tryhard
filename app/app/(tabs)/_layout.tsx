// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: 80,
          bottom: 20,
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
        },
        tabBarShowLabel: false,
        tabBarItemStyle: {
          marginTop: 15,
        },
      }}
    >
      {/* Tab 1: Home / Battles */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tabIconContainer, focused && styles.activeTab]}>
              <Ionicons name="home" size={24} color="#FFF" />
            </View>
          ),
        }}
      />

      {/* Tab 2: Your Matches */}
      <Tabs.Screen
        name="matches"
        options={{
          title: "Matches",
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tabIconContainer, focused && styles.activeTab]}>
              <Ionicons name="layers" size={24} color="#FFF" />
            </View>
          ),
        }}
      />

      {/* Tab 3: Profile / Account */}
      <Tabs.Screen
        name="account"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tabIconContainer, focused && styles.activeTab]}>
              <Ionicons name="person" size={24} color="#FFF" />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(30, 30, 30, 0.9)", // Dark transparent for inactive
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: -5, 
  },
  activeTab: {
    backgroundColor: "#3B82F6", // blue-500
  },
});
