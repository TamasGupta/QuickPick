"use client";

import Link from "next/link";
import { Search, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-8">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="text-6xl font-bold text-brand-600">404</div>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-ink">Page not found</h1>
          <p className="text-ink-soft mt-2">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href="/"
          className="btn-primary flex items-center justify-center gap-2 px-6 py-3"
        >
          <Home className="h-4 w-4" />
          Go home
        </Link>
        <button
          onClick={() => window.history.back()}
          className="btn-outline flex items-center justify-center gap-2 px-6 py-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Go back
        </button>
      </div>
    </div>
  );
}
