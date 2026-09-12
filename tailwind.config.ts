import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Operational Stitch Tokens
        primary: {
          DEFAULT: "#0F172A",
          container: "#131B2E",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#2563EB",
          container: "#316BF3",
          foreground: "#FFFFFF",
        },
        surface: {
          DEFAULT: "#F8F9FF",
          dim: "#CBDBF5",
          bright: "#F8F9FF",
          "container-lowest": "#FFFFFF",
          "container-low": "#EFF4FF",
          container: "#E5EEFF",
          "container-high": "#DCE9FF",
          "container-highest": "#D3E4FE",
        },
        // Tri-Factor Status Tokens
        status: {
          new: { bg: "#EFF6FF", border: "#3B82F6", text: "#1D4ED8" },
          approved: { bg: "#EEF2FF", border: "#6366F1", text: "#4338CA" },
          prep: { bg: "#FFFBEB", border: "#F59E0B", text: "#B45309", flame: "#EA580C" },
          ready: { bg: "#ECFDF5", border: "#10B981", text: "#047857" },
          delivery: { bg: "#F0F9FF", border: "#0284C7", text: "#0369A1" },
          fulfilled: { bg: "#F1F5F9", border: "#94A3B8", text: "#334155" },
          cancelled: { bg: "#FEF2F2", border: "#EF4444", text: "#B91C1C" },
        },
      },
      fontFamily: {
        sans: ["Rubik", "system-ui", "-apple-system", "sans-serif"],
        heading: ["Rubik", "sans-serif"],
      },
      minHeight: {
        "touch-min": "44px",
        "touch-pos": "52px",
        "touch-kds": "64px",
      },
      minWidth: {
        "touch-min": "44px",
        "touch-pos": "52px",
        "touch-kds": "64px",
      },
      borderRadius: {
        sm: "0.125rem",
        DEFAULT: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
    },
  },
  plugins: [],
};

export default config;
