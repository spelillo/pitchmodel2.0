import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        win: {
          face: "#C0C0C0", // classic button-face gray / desktop bg
          faceDark: "#B8B8B8",
          white: "#FFFFFF",
          lightGray: "#DFDFDF",
          midGray: "#808080",
          darkGray: "#404040",
          black: "#000000",
          navy: "#000080",
          navyLight: "#1084D0",
          paper: "#FFFFCC", // notepad/help yellow panel
          blue: "#0000FF",
          red: "#FF0000",
          yellow: "#FFFF00",
          amber: "#FF8000",
          green: "#00FF00",
          rowAlt: "#E8E8E8",
        },
      },
      fontFamily: {
        sans: ['"MS Sans Serif"', "Tahoma", '"Segoe UI"', "Geneva", "sans-serif"],
        heading: ['"Arial Black"', "Impact", '"Franklin Gothic Bold"', "sans-serif"],
        mono: ['"Courier New"', "Courier", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      transitionDuration: {
        DEFAULT: "0ms",
      },
    },
  },
  plugins: [],
};

export default config;
