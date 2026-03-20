import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          root: "var(--bg-root)",
          surface: "var(--bg-surface)",
          elevated: "var(--bg-elevated)",
          overlay: "var(--bg-overlay)",
          subtle: "var(--bg-subtle)",
        },
        border: {
          default: "var(--border-default)",
          strong: "var(--border-strong)",
          focus: "var(--border-focus)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
        },
        accent: "var(--accent)",
        playhead: "var(--color-playhead)",
        selection: "var(--color-selection)",
        ayahMarker: "var(--color-ayah-marker)",
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"SF Mono"', "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
