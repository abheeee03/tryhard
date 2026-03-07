import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface WalletState {
  isDevnet: boolean;
  publicKeyBase58: string | null;
  setPublicKeyBase58: (key: string | null) => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      isDevnet: true,
      publicKeyBase58: null,
      setPublicKeyBase58: (key) => set({ publicKeyBase58: key }),
    }),
    {
      name: "wallet-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
