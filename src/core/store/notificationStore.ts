// Global unread-notification count — the single source of truth for the Home
// bell badge. WHY this store exists: Home reads its inbox slice from a CACHED
// snapshot (homePrefetch), so once a fresh notification lands (seen on the
// Notifications page) the Home badge would otherwise stay stale until a manual
// refresh. Every screen that touches the inbox pushes the live count here, and
// the Home header simply subscribes — so the badge is always current without
// spending extra Firestore reads.
import { create } from 'zustand';

interface NotificationState {
  unreadCount: number;
  /** True once any screen has supplied a real count (before that the badge trusts Home's seed). */
  hydrated: boolean;
  /** Set an exact count (e.g. from a fresh fetch). */
  setUnreadCount: (n: number) => void;
  /** Derive the count from a freshly-fetched list of notifications. */
  setFromList: (items: { read?: boolean }[]) => void;
  /** Optimistically drop the count when a notification is marked read. */
  decrement: (by?: number) => void;
  /** Bump the count the moment a push arrives while the app is foregrounded, so
   *  the Home bell blinks live without waiting for a fetch. */
  increment: (by?: number) => void;
  /** Wipe on logout / account switch so the next user never sees a stale count. */
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  hydrated: false,
  setUnreadCount: (n) => set({ unreadCount: Math.max(0, n), hydrated: true }),
  setFromList: (items) => set({ unreadCount: items.filter((n) => !n.read).length, hydrated: true }),
  decrement: (by = 1) => set((s) => ({ unreadCount: Math.max(0, s.unreadCount - by) })),
  increment: (by = 1) => set((s) => ({ unreadCount: Math.max(0, s.unreadCount + by), hydrated: true })),
  reset: () => set({ unreadCount: 0, hydrated: false }),
}));
