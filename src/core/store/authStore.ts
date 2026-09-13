// Auth session state (PRD §47.1). Subscribed once in root layout via initAuthListener().
import { create } from 'zustand';
import type { AppUser } from '@/src/core/firebase/session';
import { subscribeToAuthChanges } from '@/src/core/firebase/auth';
import { clearHomeDataCache } from '@/src/core/services/homePrefetch';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useQotdStore } from '@/src/core/store/qotdStore';
import { useNotificationStore } from '@/src/core/store/notificationStore';

interface AuthState {
  user: AppUser | null;
  initializing: boolean;
  setUser: (user: AppUser | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initializing: true,
  setUser: (user) => {
    const previousUser = useAuthStore.getState().user;
    if (previousUser?.uid !== user?.uid) {
      // Clear all session-bound Home data on both logout and account switch.
      // This prevents the next user from seeing the previous user's snapshot or
      // a second fetch caused by a stale course/profile dependency.
      clearHomeDataCache();
      useProfileStore.getState().clear();
      // The bell badge count is per-user too — drop it so the next account (or
      // the signed-out state) never inherits the previous user's unread count.
      useNotificationStore.getState().reset();
      useQotdStore.getState().reset();
    }
    set({ user, initializing: false });
  },
}));

let unsubscribe: (() => void) | null = null;

/** Call once (root layout) to keep authStore in sync with Firebase auth state. */
export function initAuthListener() {
  if (unsubscribe) return unsubscribe;
  unsubscribe = subscribeToAuthChanges((user) => {
    useAuthStore.getState().setUser(user);
  });
  return unsubscribe;
}
