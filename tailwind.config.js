/** @type {import('tailwindcss').Config} */

/* Every colour is driven by the Material 3 tonal tokens in globals.css, so a
   scheme change happens in exactly one place. `<alpha-value>` keeps Tailwind's
   opacity modifiers (bg-primary/12) working against the HSL triplets. */
const token = (name) => `hsl(var(--${name}) / <alpha-value>)`;

module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1200px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },

      colors: {
        /* ── Material 3 roles ─────────────────────────────────────────── */
        surface: {
          DEFAULT: token("surface"),
          dim: token("surface-dim"),
          bright: token("surface-bright"),
          container: {
            DEFAULT: token("surface-container"),
            lowest: token("surface-container-lowest"),
            low: token("surface-container-low"),
            high: token("surface-container-high"),
            highest: token("surface-container-highest"),
          },
        },
        "on-surface": {
          DEFAULT: token("on-surface"),
          variant: token("on-surface-variant"),
        },
        outline: {
          DEFAULT: token("outline"),
          variant: token("outline-variant"),
        },

        primary: {
          DEFAULT: token("primary"),
          container: token("primary-container"),
        },
        "on-primary": {
          DEFAULT: token("on-primary"),
          container: token("on-primary-container"),
        },

        secondary: {
          DEFAULT: token("secondary"),
          container: token("secondary-container"),
        },
        "on-secondary": {
          DEFAULT: token("on-secondary"),
          container: token("on-secondary-container"),
        },

        tertiary: {
          DEFAULT: token("tertiary"),
          container: token("tertiary-container"),
        },
        "on-tertiary": {
          DEFAULT: token("on-tertiary"),
          container: token("on-tertiary-container"),
        },

        error: {
          DEFAULT: token("error"),
          container: token("error-container"),
        },
        "on-error": {
          DEFAULT: token("on-error"),
          container: token("on-error-container"),
        },

        success: {
          DEFAULT: token("success"),
          container: token("success-container"),
        },
        "on-success": {
          DEFAULT: token("on-success"),
          container: token("on-success-container"),
        },

        "inverse-surface": token("inverse-surface"),
        "inverse-on-surface": token("inverse-on-surface"),

        /* ── shadcn compatibility aliases, mapped onto the M3 roles ───── */
        background: token("surface"),
        foreground: token("on-surface"),
        card: {
          DEFAULT: token("surface-container-low"),
          foreground: token("on-surface"),
        },
        popover: {
          DEFAULT: token("surface-container-high"),
          foreground: token("on-surface"),
        },
        muted: {
          DEFAULT: token("surface-container-high"),
          foreground: token("on-surface-variant"),
        },
        accent: {
          DEFAULT: token("tertiary"),
          foreground: token("on-tertiary"),
        },
        destructive: {
          DEFAULT: token("error"),
          foreground: token("on-error"),
        },
        border: token("outline-variant"),
        input: token("outline"),
        ring: token("primary"),
      },

      /* Material 3 shape scale. */
      borderRadius: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "28px",
        "2xl": "32px",
        "3xl": "40px",
      },

      /* Material 3 elevation. Restrained shadows — height is communicated
         primarily by the tonal surface step, not by the shadow. */
      boxShadow: {
        "e-0": "none",
        "e-1": "0 1px 2px 0 rgb(0 0 0 / 0.30), 0 1px 3px 1px rgb(0 0 0 / 0.15)",
        "e-2": "0 1px 2px 0 rgb(0 0 0 / 0.30), 0 2px 6px 2px rgb(0 0 0 / 0.15)",
        "e-3": "0 1px 3px 0 rgb(0 0 0 / 0.30), 0 4px 8px 3px rgb(0 0 0 / 0.15)",
        "e-4": "0 2px 3px 0 rgb(0 0 0 / 0.30), 0 6px 10px 4px rgb(0 0 0 / 0.15)",
        "e-5": "0 4px 4px 0 rgb(0 0 0 / 0.30), 0 8px 12px 6px rgb(0 0 0 / 0.15)",
      },

      /* Material 3 easing tokens. */
      transitionTimingFunction: {
        standard: "cubic-bezier(0.2, 0, 0, 1)",
        "standard-decelerate": "cubic-bezier(0, 0, 0, 1)",
        "standard-accelerate": "cubic-bezier(0.3, 0, 1, 1)",
        emphasized: "cubic-bezier(0.2, 0, 0, 1)",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        /* M3 linear progress: an indeterminate bar sweeping the track. */
        "progress-indeterminate": {
          "0%": { transform: "translateX(-100%) scaleX(0.4)" },
          "50%": { transform: "translateX(20%) scaleX(0.7)" },
          "100%": { transform: "translateX(140%) scaleX(0.4)" },
        },
        "pulse-dot": {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.82)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
        /* Used by the Oracle bolt on reveal. */
        "bolt-strike": {
          "0%": { opacity: "0", transform: "translateY(-14px) scale(0.85)" },
          "45%": { opacity: "1", transform: "translateY(0) scale(1.06)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },

      animation: {
        "accordion-down": "accordion-down 0.2s cubic-bezier(0.2,0,0,1)",
        "accordion-up": "accordion-up 0.2s cubic-bezier(0.2,0,0,1)",
        "progress-indeterminate":
          "progress-indeterminate 1.6s cubic-bezier(0.2,0,0,1) infinite",
        "pulse-dot": "pulse-dot 1.6s cubic-bezier(0.2,0,0,1) infinite",
        shimmer: "shimmer 1.8s cubic-bezier(0.2,0,0,1) infinite",
        "spin-slow": "spin-slow 8s linear infinite",
        "bolt-strike": "bolt-strike 0.5s cubic-bezier(0,0,0,1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
