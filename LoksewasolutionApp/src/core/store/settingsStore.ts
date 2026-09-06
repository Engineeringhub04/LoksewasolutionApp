// Local device preferences that must survive restarts but aren't tied to a Firestore user doc.
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'loksewa:onboardingSeen';
const RECENT_SEARCHES_KEY = 'loksewa:recentSearches';
const MAX_RECENT_SEARCHES = 8;

interface SettingsState {
  onboardingSeen: boolean;
  recentSearches: string[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  completeOnboarding: () => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  onboardingSeen: false,
  recentSearches: [],
  hydrated: false,
  hydrate: async () => {
    const [onboarding, recent] = await Promise.all([
      AsyncStorage.getItem(ONBOARDING_KEY),
      AsyncStorage.getItem(RECENT_SEARCHES_KEY),
    ]);
    set({
      onboardingSeen: onboarding === 'true',
      recentSearches: recent ? JSON.parse(recent) : [],
      hydrated: true,
    });
  },
  completeOnboarding: () => {
    set({ onboardingSeen: true });
    AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => {});
  },
  addRecentSearch: (query) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const next = [trimmed, ...get().recentSearches.filter((q) => q !== trimmed)].slice(0, MAX_RECENT_SEARCHES);
    set({ recentSearches: next });
    AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(() => {});
  },
  clearRecentSearches: () => {
    set({ recentSearches: [] });
    AsyncStorage.removeItem(RECENT_SEARCHES_KEY).catch(() => {});
  },
}));
