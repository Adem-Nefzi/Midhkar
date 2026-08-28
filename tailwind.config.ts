import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          light: "rgb(var(--ink-soft) / <alpha-value>)",
          softer: "rgb(var(--ink-soft) / <alpha-value>)",
          raise: "rgb(var(--ink-raise) / <alpha-value>)",
        },
        parchment: {
          DEFAULT: "rgb(var(--parchment) / <alpha-value>)",
          muted: "rgb(var(--parchment-muted) / <alpha-value>)",
          dim: "rgb(var(--parchment-dim) / <alpha-value>)",
          soft: "rgb(var(--parchment) / <alpha-value>)",
        },
        gold: {
          DEFAULT: "rgb(var(--gold) / <alpha-value>)",
          soft: "rgb(var(--gold-soft) / <alpha-value>)",
          deep: "rgb(var(--gold) / <alpha-value>)",
          pale: "rgb(var(--gold) / 0.15)",
          glow: "rgb(var(--gold) / 0.08)",
        },
        ember: {
          DEFAULT: "rgb(var(--ember) / <alpha-value>)",
        },
        verdant: {
          DEFAULT: "rgb(var(--verdant) / <alpha-value>)",
          soft: "rgb(var(--verdant) / <alpha-value>)",
          deep: "rgb(var(--verdant) / <alpha-value>)",
        },
        azure: {
          DEFAULT: "rgb(74 124 140 / <alpha-value>)",
          soft: "rgb(106 156 172 / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        ruqaa: ["var(--font-ruqaa)", "'Aref Ruqaa'", "serif"],
        arabic: ["var(--font-arabic)", "'Scheherazade New'", "serif"],
      },
      animation: {
        "spin-slow": "spin 60s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
