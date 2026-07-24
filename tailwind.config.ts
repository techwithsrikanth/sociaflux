import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#f8fafc",
        graphite: "#94a3b8",
        paper: "#030712",
        card: "#0f172a",
        line: "#1e293b",
        moss: "#6366f1",
        ai: "#6366f1",
        coral: "#c85f45",
        gold: "#b68b3c",
        sky: "#4d7c9a"
      },
      boxShadow: {
        panel: "0 18px 48px rgba(0, 0, 0, 0.28)"
      }
    }
  },
  plugins: []
};

export default config;
