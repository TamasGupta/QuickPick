"use client";

import { useEffect, useState } from "react";

const SLIDE_MS = 4000;
const TRANSITION_MS = 700;

// Auto-advancing background image slider — fills its positioned parent
// (absolute inset-0), meant to sit behind overlaid hero text/CTA content.
// Loops seamlessly (not just snapping back to slide 1): a clone of the
// first image is appended after the real last one, so sliding "past the
// end" glides straight into slide 1 visually. Once that clone is fully in
// view, we instantly (no transition) rewind the track to the real slide 1
// sitting at the same visual position — the viewer never sees the jump.
export function HeroCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  const [transitionOn, setTransitionOn] = useState(true);
  const slides = [...images, images[0]];

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setIndex((i) => i + 1), SLIDE_MS);
    return () => clearInterval(id);
  }, [images.length]);

  // After the rewind (transition off), re-enable it on the next frame so
  // the *next* real advance animates again instead of also snapping.
  useEffect(() => {
    if (transitionOn) return;
    const raf = requestAnimationFrame(() => setTransitionOn(true));
    return () => cancelAnimationFrame(raf);
  }, [transitionOn]);

  function handleTransitionEnd() {
    if (index === slides.length - 1) {
      setTransitionOn(false);
      setIndex(0);
    }
  }

  return (
    <div className="absolute inset-0">
      <div
        onTransitionEnd={handleTransitionEnd}
        className="hero-carousel-track flex h-full will-change-transform transition-transform ease-in-out"
        style={
          {
            transform: `translateX(-${index * 100}%)`,
            // Read by the .hero-carousel-track rule in globals.css, which
            // deliberately overrides the site-wide prefers-reduced-motion
            // reset for this element — see the comment there.
            "--hero-duration": transitionOn ? `${TRANSITION_MS}ms` : "0ms",
          } as React.CSSProperties
        }
      >
        {slides.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt={`Promotional banner ${(i % images.length) + 1}`} className="h-full w-full shrink-0 object-cover" />
        ))}
      </div>

      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Go to banner ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                index % images.length === i ? "w-5 bg-white" : "w-1.5 bg-white/60"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
