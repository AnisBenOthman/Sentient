import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Design tokens added feature-by-feature
    },
  },
  plugins: [],
};

export default config;
