/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Dynamic accent — driven by CSS variables set at runtime
        accent: {
          DEFAULT: "var(--accent)",
          dim:     "var(--accent-dim)",
          bright:  "var(--accent-bright)",
          muted:   "var(--accent-muted)",
        },
        // Surface hierarchy (glassmorphic dark)
        surface: {
          base:    "var(--surface-base)",     // deepest bg
          raised:  "var(--surface-raised)",   // cards, sidebar
          overlay: "var(--surface-overlay)",  // modals, tooltips
          glass:   "var(--surface-glass)",    // frosted glass panels
        },
        text: {
          primary:   "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted:     "var(--text-muted)",
          accent:    "var(--text-accent)",
        },
        border: {
          subtle: "var(--border-subtle)",
          glass:  "var(--border-glass)",
        },
      },
      fontFamily: {
        display: ["'Outfit'", "sans-serif"],
        body:    ["'DM Sans'", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      backdropBlur: {
        xs: "2px",
        glass: "16px",
        heavy: "32px",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        glass:       "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
        "glass-lg":  "0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
        accent:      "0 0 20px var(--accent-glow)",
        "accent-lg": "0 0 40px var(--accent-glow)",
        inset:       "inset 0 1px 0 rgba(255,255,255,0.05)",
      },
      animation: {
        "fade-in":    "fadeIn 0.2s ease-out",
        "slide-up":   "slideUp 0.25s ease-out",
        "slide-in":   "slideIn 0.3s cubic-bezier(0.16,1,0.3,1)",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "spin-slow":  "spin 8s linear infinite",
        "equalizer":  "equalizer 1.2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:   { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        slideIn:   { from: { opacity: 0, transform: "translateX(-12px)" }, to: { opacity: 1, transform: "translateX(0)" } },
        pulseGlow: { "0%,100%": { boxShadow: "0 0 12px var(--accent-glow)" }, "50%": { boxShadow: "0 0 32px var(--accent-glow)" } },
        equalizer: {
          "0%,100%": { height: "4px" },
          "50%":     { height: "16px" },
        },
      },
    },
  },
  plugins: [],
};
