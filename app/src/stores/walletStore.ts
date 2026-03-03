import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { asyncStorageAdapter } from "../lib/storage";

interface WalletState {
    favorites: string[];
    searchHistory: string[];
    isDevnet: boolean;

    addFavorite: (address: string) => void;
    removeFavorite: (address: string) => void;
    isFavorite: (address: string) => boolean;
    addToHistory: (address: string) => void;
    clearHistory: () => void;
    toggleNetwork: () => void;
}

export const useWalletStore = create<WalletState>()(
    persist(
        (set, get) => ({
            favorites: [],
            searchHistory: [],
            isDevnet: false,

            addFavorite: (address) =>
                set((state) => ({
                    favorites: state.favorites.includes(address)
                        ? state.favorites
                        : [address, ...state.favorites],
                })),

            removeFavorite: (address) =>
                set((state) => ({
                    favorites: state.favorites.filter((a) => a !== address),
                })),

            isFavorite: (address) => get().favorites.includes(address),

            addToHistory: (address) =>
                set((state) => ({
                    searchHistory: [
                        address,
                        ...state.searchHistory.filter((a) => a !== address),
                    ].slice(0, 20),
                })),

            clearHistory: () => set({ searchHistory: [] }),

            toggleNetwork: () =>
                set((state) => ({ isDevnet: !state.isDevnet })),
        }),
        {
            name: "wallet-storage",  // key name in MMKV
            storage: createJSONStorage(() => asyncStorageAdapter),
        }
    )
);