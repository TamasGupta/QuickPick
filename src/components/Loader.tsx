// Full-page loader: a solid brand-colored dot with a pulsing ring behind it.
export function Loader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <span className="relative flex h-8 w-8 items-center justify-center">
        <img src="/icons/loader.gif" alt="Brand Logo" />
      </span>
      <p className="animate-pulse text-sm font-semibold text-ink-soft">
        {label}
      </p>
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
