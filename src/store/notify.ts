import { create } from "zustand";

export type NotifyType = "error" | "success" | "info";

interface NotifyItem {
  id: number;
  type: NotifyType;
  message: string;
}

interface NotifyState {
  queue: NotifyItem[];
  push: (type: NotifyType, message: string) => void;
  shift: () => void;
}

let counter = 0;

// Not persisted — notifications are purely transient, nothing here should
// survive a reload.
const useNotifyStore = create<NotifyState>((set) => ({
  queue: [],
  push: (type, message) => set((s) => ({ queue: [...s.queue, { id: ++counter, type, message }] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}));

export { useNotifyStore };

// Plain functions, not hooks — callable from event handlers, catch blocks,
// or any non-component code (e.g. a fetch error handler) without needing to
// be inside a React component tree.
export const notify = {
  error: (message: string) => useNotifyStore.getState().push("error", message),
  success: (message: string) => useNotifyStore.getState().push("success", message),
  info: (message: string) => useNotifyStore.getState().push("info", message),
};
