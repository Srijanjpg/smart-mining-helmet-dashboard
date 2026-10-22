/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f3f6fb",
        panel: "#ffffff",
        panelSoft: "#f6f8fc",
        safe: "#16a34a",
        warn: "#d97706",
        danger: "#dc2626",
        textMain: "#0f172a",
        textSoft: "#475569"
      }
    }
  },
  plugins: []
};
