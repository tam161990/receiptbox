import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/pages/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#e0eefe",
          200: "#bae0fd",
          300: "#7cc8fc",
          400: "#36abf8",
          500: "#0d8de9",
          600: "#0070c7",
          700: "#0159a1",
          800: "#064b85",
          900: "#0b3f6e",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
