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
          softer: "#292524",
        },
        parchment: {
          DEFAULT: "#f5f0e8",
          muted: "#a8a29e",
          soft: "#e7e2da",
        },
        gold: {
          DEFAULT: "#d4af37",
          soft: "#e5c76b",
          deep: "#b8941f",
          pale: "rgba(212, 175, 55, 0.15)",
          glow: "rgba(212, 175, 55, 0.08)",
        },
        verdant: {
          DEFAULT: "#5f8d6e",
          soft: "#7aad8a",
          deep: "#4a7056",
        },
        azure: {
          DEFAULT: "#4a7c8c",
          soft: "#6a9cac",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        arabic: ["Amiri", "Scheherazade New", "serif"],
        kufi: ["'Traditional Arabic'", "serif"],
      },
      animation: {
        "fade-up": "fadeUp 0.8s ease-out forwards",
        "draw-line": "drawLine 1.2s ease-out forwards",
        "glow-pulse": "glowPulse 4s ease-in-out infinite",
        "spin-slow": "spin 60s linear infinite",
        "spin-slow-reverse": "spin 45s linear infinite reverse",
        shimmer: "shimmer 20s linear infinite",
        "float-1": "float1 12s ease-in-out infinite",
        "float-2": "float2 15s ease-in-out infinite",
        "float-3": "float3 18s ease-in-out infinite",
        "shamsah-pulse": "shamsahPulse 6s ease-in-out infinite",
        "geometric-rotate": "geometricRotate 30s linear infinite",
        "lantern-flicker": "lanternFlicker 3s ease-in-out infinite",
        "crescent-glow": "crescentGlow 5s ease-in-out infinite",
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
        shimmer: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        float1: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "25%": { transform: "translate(30px, -40px) scale(1.1)" },
          "50%": { transform: "translate(-20px, -20px) scale(0.95)" },
          "75%": { transform: "translate(15px, 30px) scale(1.05)" },
        },
        float2: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(-40px, 25px) scale(1.15)" },
          "66%": { transform: "translate(25px, -35px) scale(0.9)" },
        },
        float3: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "20%": { transform: "translate(20px, 30px) scale(1.08)" },
          "40%": { transform: "translate(-30px, 10px) scale(0.92)" },
          "60%": { transform: "translate(10px, -25px) scale(1.05)" },
          "80%": { transform: "translate(-15px, 20px) scale(0.98)" },
        },
        shamsahPulse: {
          "0%, 100%": { opacity: "0.5", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
        geometricRotate: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        lanternFlicker: {
          "0%, 100%": { opacity: "0.6", filter: "brightness(1)" },
          "50%": { opacity: "0.9", filter: "brightness(1.2)" },
        },
        crescentGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(212, 175, 55, 0.1)" },
          "50%": { boxShadow: "0 0 40px rgba(212, 175, 55, 0.2)" },
        },
      },
      backgroundImage: {
        "girih-pattern":
          "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L33 27L60 30L33 33L30 60L27 33L0 30L27 27Z' fill='none' stroke='%23d4af37' stroke-width='0.3' opacity='0.15'/%3E%3C/svg%3E\")",
        "arabesque-dots":
          "radial-gradient(circle, rgba(212,175,55,0.1) 1px, transparent 1px)",
      },
      backgroundSize: {
        girih: "60px 60px",
        dots: "24px 24px",
      },
    },
  },
  plugins: [],
};

export default config;
