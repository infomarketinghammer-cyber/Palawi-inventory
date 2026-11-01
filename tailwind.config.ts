import type { Config } from "tailwindcss";
// Generated from the logo by `npm run palette`; only these colours are used in the UI.
import tokens from "./src/styles/tokens.json" with { type: "json" };

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#ffffff",
      black: "#000000",
      ...tokens,
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-latin)", "var(--font-devanagari)", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "1rem" },
    },
  },
  plugins: [],
} satisfies Config;
