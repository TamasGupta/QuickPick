// Full-page loader: a simple rounded spinner matching the app's brand color.
export function Loader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
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
