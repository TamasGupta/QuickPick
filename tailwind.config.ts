import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Youthful vibrant violet
        brand: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
        },
        // Electric fuchsia/pink accent
        accent: {
          50: "#fdf4ff",
          100: "#fae8ff",
          200: "#f5d0fe",
          300: "#f0abfc",
          400: "#e879f9",
          500: "#d946ef",
          600: "#c026d3",
        },
        ink: {
          DEFAULT: "#18181b",
          soft: "#52525b",
          faint: "#a1a1aa",
        },
      },
      fontFamily: {
        sans: [
          "ui-rounded",
          "'Segoe UI'",
          "system-ui",
          "-apple-system",
          "'Helvetica Neue'",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 3px rgba(24,24,27,0.06), 0 1px 2px rgba(24,24,27,0.04)",
        pop: "0 10px 30px rgba(124,58,237,0.14)",
        nav: "0 -1px 14px rgba(24,24,27,0.06)",
        glow: "0 0 0 4px rgba(139,92,246,0.15)",
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
      },
      keyframes: {
        // Opacity-only on purpose: this animates PageTransition's wrapper,
        // which sits around every page's content. A `transform` here —
        // even a no-op `translateY(0)` at the end state — creates a new
        // containing block for the rest of that animation's lifetime,
        // silently breaking `position: fixed` for anything nested inside
        // (modals, toasts) by confining it to the page div instead of the
        // real viewport. Confirmed live: ProductEditModal rendered off-
        // screen at the bottom of the page until this was removed.
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.96)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%,100%": { transform: "scale(1.7)", opacity: "0" },
        },
        wiggle: {
          "0%,100%": { transform: "rotate(-8deg)" },
          "50%": { transform: "rotate(8deg)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "100% 0" },
          "100%": { backgroundPosition: "0 0" },
        },
        "bounce-in": {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "60%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "confetti-fall": {
          "0%": { transform: "translateY(-10px) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(240px) rotate(420deg)", opacity: "0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "scale-in": "scale-in 0.15s ease-out",
        float: "float 3s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
        wiggle: "wiggle 0.6s ease-in-out",
        "bounce-in": "bounce-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
        "confetti-fall": "confetti-fall 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
      },
    },
  },
  plugins: [],
};

export default config;
