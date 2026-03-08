import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  connected: boolean;
  connecting: boolean;
  publicKey: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function ConnectButton({
  connected,
  connecting,
  publicKey,
  onConnect,
  onDisconnect,
}: Props) {
  if (connecting) {
    return (
      <View style={[styles.button, styles.connecting]}>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={styles.buttonText}>Connecting...</Text>
      </View>
    );
  }

  if (connected && publicKey) {
    return (
      <TouchableOpacity
        style={[styles.button, styles.connected]}
        onPress={onDisconnect}
      >
        <Ionicons name="wallet" size={18} color="#14F195" />
        <Text style={styles.connectedText}>
          {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
        </Text>
        <Ionicons name="close-circle-outline" size={16} color="#888" />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, styles.disconnected]}
      onPress={onConnect}
    >
      <Ionicons name="wallet-outline" size={18} color="#fff" />
      <Text style={styles.buttonText}>Connect Wallet</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16, // rounded-xl
    gap: 8,
  },
  disconnected: {
    backgroundColor: "#3B82F6", // blue-500
  },
  connected: {
    backgroundColor: "rgba(59, 130, 246, 0.15)", // slightly tinted background when connected
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  connecting: {
    backgroundColor: "#1E293B", // slate-800
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  connectedText: {
    color: "#3B82F6",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "monospace",
  },
});
