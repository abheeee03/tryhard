import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface WalletState {
  isDevnet: true;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      isDevnet: true,
    }),
    {
      name: "wallet-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
