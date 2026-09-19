// Why this file exists: Tailwind v4 runs as a PostCSS plugin; this registers it.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
