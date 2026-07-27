"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";

export function OfflineScreen() {
  const [isOnline, setIsOnline] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Only render after hydration to prevent mismatch
  if (!isMounted || isOnline) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="card mx-4 space-y-4 p-6 text-center max-w-sm">
        <div className="flex justify-center">
          <div className="rounded-full bg-amber-50 p-4">
            <WifiOff className="h-8 w-8 text-amber-600" />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-ink">No internet connection</h2>
          <p className="text-sm text-ink-soft mt-1">
            Please check your network connection and try again.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    </div>
  );
}
