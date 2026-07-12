import { LottieIcon } from "@/components/LottieIcon";

// Branded animated loader: the loading-dots Lottie animation.
export function Loader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16">
      <LottieIcon name="loading-dots" className="h-28 w-28" />
      <p className="animate-pulse text-sm font-semibold text-ink-soft">{label}</p>
    </div>
  );
}

// Small inline spinner for buttons/inline states.
export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-white/40 border-t-white ${className}`}
      role="status"
      aria-label="loading"
    />
  );
}
