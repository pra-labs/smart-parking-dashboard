/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        cyber: {
          dark: "#06080e",
          card: "#0c101d",
          cyan: "#00f0ff",
          emerald: "#00ff9d",
          rose: "#ff0055",
          amber: "#ffb703",
        },
      },
    },
  },
  plugins: [],
};
