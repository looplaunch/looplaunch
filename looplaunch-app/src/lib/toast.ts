/**
 * App-wide toasts. Call toast() from any client component; <Toaster /> in the root layout shows them
 * (React Bits SwipeToast: swipe down to dismiss, a thin fuse burns for the time left).
 */

export type ToastTone = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

const MAX_VISIBLE = 3;
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export function toast(title: string, options: { description?: string; tone?: ToastTone } = {}) {
  items = [...items, { id: nextId++, title, description: options.description, tone: options.tone ?? "success" }].slice(-MAX_VISIBLE);
  emit();
}

export function dismissToast(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

export function subscribeToasts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getToasts = () => items;
