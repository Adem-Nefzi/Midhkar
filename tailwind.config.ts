import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0c0a09",
          light: "#1c1917",
        },
        parchment: {
          DEFAULT: "#f5f0e8",
          muted: "#a8a29e",
        },
        gold: {
          DEFAULT: "#d4af37",
          soft: "#e5c76b",
        },
        verdant: {
          DEFAULT: "#5f8d6e",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        arabic: ["Amiri", "Scheherazade New", "serif"],
      },
      animation: {
        "fade-up": "fadeUp 0.8s ease-out forwards",
        "draw-line": "drawLine 1.2s ease-out forwards",
        "glow-pulse": "glowPulse 4s ease-in-out infinite",
        "spin-slow": "spin 60s linear infinite",
        "spin-slow-reverse": "spin 45s linear infinite reverse",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        drawLine: {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        glowPulse: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
