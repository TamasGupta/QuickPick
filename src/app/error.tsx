"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-8">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-50 p-4">
            <AlertTriangle className="h-12 w-12 text-red-600" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-ink">Something went wrong</h1>
          <p className="text-ink-soft mt-2">We encountered an unexpected error. Please try again.</p>
        </div>

        {error.message && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-left">
            <p className="text-xs font-medium text-red-700">{error.message}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={reset}
          className="btn-primary flex items-center justify-center gap-2 px-6 py-3"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
        <Link href="/" className="btn-outline flex items-center justify-center gap-2 px-6 py-3">
          <Home className="h-4 w-4" />
          Go home
        </Link>
      </div>
    </div>
  );
}
