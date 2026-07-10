import { Zap } from "lucide-react";

// Branded animated loader: a pulsing ring around the QuickPick bolt.
export function Loader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="relative flex h-16 w-16 items-center justify-center">
        {/* expanding pulse rings */}
        <span className="absolute inset-0 rounded-2xl bg-brand-400/40 animate-pulse-ring" />
        <span
          className="absolute inset-0 rounded-2xl bg-accent-400/30 animate-pulse-ring"
          style={{ animationDelay: "0.6s" }}
        />
        {/* spinning gradient ring */}
        <span className="absolute inset-0 animate-spin rounded-2xl bg-gradient-to-tr from-brand-600 via-accent-500 to-brand-400 [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] [mask-composite:exclude] p-[3px]" />
        {/* core */}
        <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-pop">
          <Zap className="h-6 w-6 animate-pulse fill-white" />
        </span>
      </div>
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
