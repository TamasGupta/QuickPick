"use client";

import { useEffect, useState } from "react";
import { useNotifyStore, type NotifyType } from "@/store/notify";

// Errors stay up longer — a buyer needs time to actually read why something
// failed, not just notice it flashed by.
const DURATIONS: Record<NotifyType, number> = { error: 5000, success: 2800, info: 3200 };
// No icon glyphs — type is conveyed by a subtle text tint instead.
const TEXT_COLOR: Record<NotifyType, string> = {
  error: "text-red-300",
  success: "text-brand-300",
  info: "text-accent-300",
};
// Collapse animation must finish before the next queued item takes over, or
// the transition looks like a jump-cut — keep in sync with the duration-*
// class below.
const COLLAPSE_MS = 220;

// A single floating capsule, mounted once at the app root, that every page
// pushes into via `notify.error/success/info(...)` (src/store/notify.ts)
// instead of each screen rolling its own error banner. iOS Dynamic
// Island-style, one notification at a time — a queue, not a stack, so
// messages never overlap illegibly.
//
// Animates only opacity/transform (never width/padding/max-width) — those
// layout-affecting properties force a reflow on every frame and look janky;
// transform+opacity are GPU-composited and stay smooth regardless of device.
export function DynamicIsland() {
  const queue = useNotifyStore((s) => s.queue);
  const shift = useNotifyStore((s) => s.shift);
  const current = queue[0] ?? null;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!current) return;
    // A single requestAnimationFrame often fires before the browser has
    // actually painted the initial (collapsed) state, so the two class
    // changes get coalesced into one frame and no transition is ever
    // visible. Nesting two RAFs guarantees a real paint happens in between.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setExpanded(true));
    });
    const hideTimer = setTimeout(() => setExpanded(false), DURATIONS[current.type]);
    const advanceTimer = setTimeout(() => shift(), DURATIONS[current.type] + COLLAPSE_MS);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(hideTimer);
      clearTimeout(advanceTimer);
    };
  }, [current, shift]);

  if (!current) return null;

  function dismiss() {
    setExpanded(false);
    setTimeout(() => shift(), COLLAPSE_MS);
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[200] flex justify-center px-4">
      <button
        onClick={dismiss}
        className={`pointer-events-auto rounded-full bg-ink/95 px-3.5 py-2 text-white shadow-pop backdrop-blur-sm transition-[opacity,transform] duration-[220ms] ease-out will-change-transform ${
          expanded ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1.5 scale-[0.85] opacity-0"
        }`}
      >
        <span className={`max-w-[75vw] truncate text-[12.5px] font-medium leading-none tracking-tight ${TEXT_COLOR[current.type]}`}>
          {current.message}
        </span>
      </button>
    </div>
  );
}
