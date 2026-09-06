// Global toast/snackbar queue (PRD §8.4, §9.5). Call showToast() from anywhere;
// <ToastHost /> (mounted once in root layout) renders the active toast.
import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastState {
  queue: ToastItem[];
  show: (message: string, variant?: ToastVariant, opts?: { actionLabel?: string; onAction?: () => void }) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  queue: [],
  show: (message, variant = 'info', opts) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((state) => ({ queue: [...state.queue, { id, message, variant, ...opts }] }));
  },
  dismiss: (id) => set((state) => ({ queue: state.queue.filter((t) => t.id !== id) })),
}));

export const showToast = (message: string, variant?: ToastVariant, opts?: { actionLabel?: string; onAction?: () => void }) =>
  useToastStore.getState().show(message, variant, opts);
