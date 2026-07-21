"use client";

import { create } from "zustand";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaInstallState {
  deferredEvent: BeforeInstallPromptEvent | null;
  installed: boolean;
  setDeferredEvent: (e: BeforeInstallPromptEvent | null) => void;
  setInstalled: (v: boolean) => void;
}

export const usePwaInstall = create<PwaInstallState>((set) => ({
  deferredEvent: null,
  installed: false,
  setDeferredEvent: (e) => set({ deferredEvent: e }),
  setInstalled: (v) => set({ installed: v }),
}));
