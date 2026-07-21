"use client";

import { useEffect } from "react";
import { usePwaInstall, type BeforeInstallPromptEvent } from "@/store/pwaInstall";

// Mounted once in the root layout — captures the `beforeinstallprompt` event
// as early as possible (it can fire before the user ever visits /account) and
// stashes it in a store so any page can trigger the install prompt later.
export function PwaInstallListener() {
  const setDeferredEvent = usePwaInstall((s) => s.setDeferredEvent);
  const setInstalled = usePwaInstall((s) => s.setInstalled);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(isStandalone);

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredEvent(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [setDeferredEvent, setInstalled]);

  return null;
}
