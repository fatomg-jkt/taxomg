import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        masterplan: {
          bone: "#F6F3EE",
          ink: "#101011",
          plum: "#4F2958",
          blue: "#24358C",
          acid: "#D5D846",
          magenta: "#D6396F",
          pale: "#DCE9F2",
          sage: "#B0D6A7",
        },
      },
      fontFamily: {
        sans: ["Archivo", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["DM Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        serif: ["Archivo", "Helvetica Neue", "Arial", "sans-serif"],
      },
      borderRadius: {
        none: "0px",
        sm: "12px",
        md: "12px",
        lg: "12px",
        xl: "12px",
        "2xl": "12px",
        "3xl": "12px",
        full: "999px",
      },
      boxShadow: {
        soft: "none",
      },
      spacing: {
        mp1: "16px",
        mp2: "32px",
        mp3: "64px",
        mp4: "128px",
      },
    },
  },
  plugins: [],
};

export default config;
