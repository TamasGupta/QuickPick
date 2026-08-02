// GrabOn's mark: a circular motion arc (speed/continuous restocking) wrapped
// around a shopping cart — the same concept as the source logo (a hand-traced
// picsvg.com export with a placeholder "STORE JM" wordmark baked into ~300
// tiny untouchable path fragments), rebuilt as clean, crisp, themeable vector
// paths instead. Uses currentColor so it inherits whatever text color its
// container sets (white on the brand-gradient badge in Header). No
// arrowhead on the arc — read as clutter/a stray mark, removed.
export function LogoMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M24 4 A20 20 0 1 0 42 15"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path
        d="M13 15 H16 L18 29 H32 L35 19 H19"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="21" cy="34" r="2.4" fill="currentColor" />
      <circle cx="30" cy="34" r="2.4" fill="currentColor" />
    </svg>
  );
}
